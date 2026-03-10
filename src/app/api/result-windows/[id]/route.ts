import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { ResultWindow } from "@/models/ResultWindow";
import { MarkEntry } from "@/models/MarkEntry";
import { Result } from "@/models/Result";
import { User } from "@/models/User";
import { CourseSection } from "@/models/CourseSection";
import { Enrollment } from "@/models/Enrollment";
import { AttendanceRecord } from "@/models/AttendanceRecord";
import { AttendanceSession } from "@/models/AttendanceSession";
import { calculateGPA, getGrade } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { id } = await params;

  const resultWindow = await ResultWindow.findById(id).lean();
  if (!resultWindow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // All teacher-assigned course offerings for this semester/year
  const offerings = await CourseSection.find({
    semesterLabel: resultWindow.semesterLabel,
    academicYear: resultWindow.academicYear,
    teacherId: { $exists: true, $ne: null },
  })
    .populate("courseId", "code title")
    .populate("teacherId", "name")
    .lean();

  // For each offering: enrolled count + how many distinct students have a MarkEntry
  const statuses = await Promise.all(
    offerings.map(async (o) => {
      const [enrolledCount, submittedCount] = await Promise.all([
        Enrollment.countDocuments({
          courseOfferingId: o._id,
          semesterLabel: resultWindow.semesterLabel,
          academicYear: resultWindow.academicYear,
        }),
        MarkEntry.countDocuments({ resultWindowId: id, courseOfferingId: o._id }),
      ]);
      const course = o.courseId as unknown as { code: string; title: string };
      const teacher = o.teacherId as unknown as { _id: unknown; name: string };
      return {
        offeringId: (o._id as { toString(): string }).toString(),
        courseCode: course?.code ?? "—",
        courseTitle: course?.title ?? "—",
        teacherName: teacher?.name ?? "Unassigned",
        enrolledCount,
        submittedCount,
      };
    })
  );

  // Group by teacher name
  const teacherMap = new Map<string, typeof statuses>();
  for (const s of statuses) {
    if (!teacherMap.has(s.teacherName)) teacherMap.set(s.teacherName, []);
    teacherMap.get(s.teacherName)!.push(s);
  }

  const data = Array.from(teacherMap.entries()).map(([teacherName, courses]) => ({
    teacherName,
    courses,
  }));

  // Sort teachers: those with incomplete submissions first
  data.sort((a, b) => {
    const aIncomplete = a.courses.some((c) => c.submittedCount < c.enrolledCount);
    const bIncomplete = b.courses.some((c) => c.submittedCount < c.enrolledCount);
    if (aIncomplete && !bIncomplete) return -1;
    if (!aIncomplete && bIncomplete) return 1;
    return a.teacherName.localeCompare(b.teacherName);
  });

  return NextResponse.json({ success: true, data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const { id } = await params;
  const win = await ResultWindow.findById(id);
  if (!win) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (win.isOpen) {
    return NextResponse.json(
      { error: "Cannot delete an open result window. Close it first." },
      { status: 400 }
    );
  }
  await win.deleteOne();
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const { action } = body;

  if (action !== "close") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const resultWindow = await ResultWindow.findById(id);
  if (!resultWindow) {
    return NextResponse.json({ error: "Result window not found" }, { status: 404 });
  }
  if (!resultWindow.isOpen) {
    return NextResponse.json({ error: "Window is already closed" }, { status: 400 });
  }

  // Load all mark entries for this window with full course info
  const entries = await MarkEntry.find({ resultWindowId: id })
    .populate({
      path: "courseOfferingId",
      select: "courseId semesterLabel academicYear",
      populate: { path: "courseId", select: "code title credits" },
    })
    .populate("studentId", "name departmentId")
    .lean();

  if (entries.length === 0) {
    // Close the window with 0 published, but still run semester cleanup
    resultWindow.isOpen = false;
    resultWindow.closedAt = new Date();
    resultWindow.publishedCount = 0;
    await resultWindow.save();
    await runSemesterCleanup(resultWindow.semesterLabel, resultWindow.academicYear);
    return NextResponse.json({ success: true, published: 0 });
  }

  // Group entries by studentId
  const byStudent = new Map<string, typeof entries>();
  for (const entry of entries) {
    const sid = (entry.studentId as unknown as { _id: { toString(): string } })._id.toString();
    if (!byStudent.has(sid)) byStudent.set(sid, []);
    byStudent.get(sid)!.push(entry);
  }

  const publishOps: Promise<unknown>[] = [];

  for (const [studentId, studentEntries] of byStudent) {
    const studentDoc = studentEntries[0].studentId as unknown as {
      _id: unknown;
      departmentId: unknown;
    };
    const departmentId = studentDoc.departmentId;

    const rawCourses = studentEntries.map((e) => {
      const offering = e.courseOfferingId as unknown as {
        _id: unknown;
        courseId: { code: string; title: string; credits: number };
      };
      const course = offering.courseId;
      // Convert achieved/total to percentage (0-100 scale)
      const percentage = Math.min(
        100,
        Math.round((e.achievedMarks / e.totalMarks) * 100)
      );
      return {
        courseOfferingId: offering._id,
        courseCode: course.code,
        courseTitle: course.title,
        credits: course.credits,
        marks: percentage,
      };
    });

    // Merge duplicate courseCode rows (same course, multiple teachers)
    // → average the marks, keep one row per course
    const mergeMap = new Map<string, { courseOfferingId: unknown; courseCode: string; courseTitle: string; credits: number; marksSum: number; count: number }>();
    for (const rc of rawCourses) {
      if (mergeMap.has(rc.courseCode)) {
        mergeMap.get(rc.courseCode)!.marksSum += rc.marks;
        mergeMap.get(rc.courseCode)!.count += 1;
      } else {
        mergeMap.set(rc.courseCode, { ...rc, marksSum: rc.marks, count: 1 });
      }
    }

    const courses = Array.from(mergeMap.values()).map(({ marksSum, count, ...rest }) => {
      const avgMarks = Math.round(marksSum / count);
      const grade = getGrade(avgMarks);
      return {
        courseOfferingId: rest.courseOfferingId,
        courseCode: rest.courseCode,
        courseTitle: rest.courseTitle,
        credits: rest.credits,
        marks: avgMarks,
        gradePoint: grade.point,
        gradeLetter: grade.letter,
      };
    });

    const semesterGPA = calculateGPA(courses);

    // CGPA: include this semester in calculation with all prior published
    const prevResults = await Result.find({
      studentId,
      isPublished: true,
    }).lean();

    const allCourses = [
      ...prevResults.flatMap((r) => r.courses),
      ...courses,
    ];
    const cgpa = calculateGPA(allCourses);

    publishOps.push(
      Result.findOneAndUpdate(
        {
          studentId,
          semesterLabel: resultWindow.semesterLabel,
          academicYear: resultWindow.academicYear,
        },
        {
          $set: {
            studentId,
            departmentId,
            semesterLabel: resultWindow.semesterLabel,
            academicYear: resultWindow.academicYear,
            courses,
            semesterGPA,
            cgpa,
            isPublished: true,
            publishedBy: session.user.id,
            publishedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      )
    );
  }

  const publishedResults = (await Promise.all(publishOps)) as {
    _id: unknown;
    departmentId: { toString(): string };
    semesterGPA: number;
  }[];

  // Calculate department ranks for this semester
  const byDept = new Map<string, typeof publishedResults>();
  for (const r of publishedResults) {
    const dId = r.departmentId.toString();
    if (!byDept.has(dId)) byDept.set(dId, []);
    byDept.get(dId)!.push(r);
  }

  const rankOps: Promise<unknown>[] = [];
  for (const [, deptResults] of byDept) {
    deptResults.sort((a, b) => b.semesterGPA - a.semesterGPA);
    deptResults.forEach((r, idx) => {
      rankOps.push(
        Result.findByIdAndUpdate(r._id, { departmentRank: idx + 1 })
      );
    });
  }
  await Promise.all(rankOps);

  // Mark window as closed
  resultWindow.isOpen = false;
  resultWindow.closedAt = new Date();
  resultWindow.publishedCount = publishedResults.length;
  await resultWindow.save();

  // Semester-end cleanup: unassign teachers, delete attendance & enrollments
  await runSemesterCleanup(resultWindow.semesterLabel, resultWindow.academicYear);

  return NextResponse.json({
    success: true,
    published: publishedResults.length,
  });
}

async function runSemesterCleanup(semesterLabel: string, academicYear: string) {
  // Collect all offering IDs for this semester so we can delete by them
  const offeringIds = await CourseSection.distinct("_id", {
    semesterLabel,
    academicYear,
  });

  await Promise.all([
    // Wipe all attendance records for every offering in this semester
    AttendanceRecord.deleteMany({ courseOfferingId: { $in: offeringIds } }),
    // Wipe all live attendance sessions
    AttendanceSession.deleteMany({ courseOfferingId: { $in: offeringIds } }),
    // Remove all student enrollments for this semester
    Enrollment.deleteMany({ semesterLabel, academicYear }),
    // Unassign teachers and deactivate every course offering for this semester
    CourseSection.updateMany(
      { semesterLabel, academicYear },
      { $unset: { teacherId: "" }, $set: { isActive: false } }
    ),
  ]);
}
