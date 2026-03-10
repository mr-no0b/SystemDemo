import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Result } from "@/models/Result";
import { calculateGPA, getGrade } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const studentId = url.searchParams.get("studentId");
  const dept = url.searchParams.get("dept");
  const sem = url.searchParams.get("semester");
  const rankings = url.searchParams.get("rankings") === "true";

  if (session.user.role === "student") {
    const results = await Result.find({
      studentId: session.user.id,
      isPublished: true,
    })
      .sort({ semesterLabel: 1 })
      .lean();

    // Merge duplicate courseCode entries (same course, multiple teachers)
    // → average marks, one row per course, recompute GPA
    const merged = results.map((r) => {
      const mergeMap = new Map<string, { courseOfferingId: unknown; courseCode: string; courseTitle: string; credits: number; marksSum: number; count: number }>();
      for (const c of r.courses as { courseOfferingId: unknown; courseCode: string; courseTitle: string; credits: number; marks: number }[]) {
        if (mergeMap.has(c.courseCode)) {
          mergeMap.get(c.courseCode)!.marksSum += c.marks;
          mergeMap.get(c.courseCode)!.count += 1;
        } else {
          mergeMap.set(c.courseCode, { courseOfferingId: c.courseOfferingId, courseCode: c.courseCode, courseTitle: c.courseTitle, credits: c.credits, marksSum: c.marks, count: 1 });
        }
      }
      const courses = Array.from(mergeMap.values()).map(({ marksSum, count, ...rest }) => {
        const avgMarks = Math.round(marksSum / count);
        const grade = getGrade(avgMarks);
        return { ...rest, marks: avgMarks, gradePoint: grade.point, gradeLetter: grade.letter };
      });
      const semesterGPA = calculateGPA(courses);
      return { ...r, courses, semesterGPA };
    });

    // Recompute CGPA rolling across semesters with merged data
    let allPrior: { credits: number; gradePoint: number }[] = [];
    const withCGPA = merged.map((r) => {
      allPrior = [...allPrior, ...r.courses];
      return { ...r, cgpa: calculateGPA(allPrior) };
    });

    return NextResponse.json({ success: true, data: withCGPA });
  }

  // Teacher/Admin: get results for ranking or specific student
  const query: Record<string, unknown> = { isPublished: true };
  if (studentId) query.studentId = studentId;
  if (dept) query.departmentId = dept;
  if (sem) query.semesterLabel = sem;

  const results = await Result.find(query)
    .populate("studentId", "name userId")
    .sort({ semesterGPA: -1 })
    .lean();

  if (rankings && sem && dept) {
    const ranked = results.map((r, i) => ({ ...r, departmentRank: i + 1 }));
    return NextResponse.json({ success: true, data: ranked });
  }

  return NextResponse.json({ success: true, data: results });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const body = await req.json();
  const { studentId, departmentId, semesterLabel, academicYear, courses } = body;

  // Calculate GPA
  const processedCourses = courses.map((c: { marks: number; credits: number; courseCode: string; courseTitle: string; courseOfferingId: string }) => {
    const grade = getGrade(c.marks);
    return { ...c, gradePoint: grade.point, gradeLetter: grade.letter };
  });

  const semGPA = calculateGPA(processedCourses);

  // Calculate CGPA from all previous published results
  const prevResults = await Result.find({ studentId, isPublished: true }).lean();
  const allCourses = [
    ...prevResults.flatMap((r) => r.courses),
    ...processedCourses,
  ];
  const cgpa = calculateGPA(allCourses);

  const result = await Result.findOneAndUpdate(
    { studentId, semesterLabel, academicYear },
    {
      $set: {
        studentId,
        departmentId,
        semesterLabel,
        academicYear,
        courses: processedCourses,
        semesterGPA: semGPA,
        cgpa,
        isPublished: false,
      },
    },
    { upsert: true, new: true }
  );

  return NextResponse.json({ success: true, data: result }, { status: 201 });
}
