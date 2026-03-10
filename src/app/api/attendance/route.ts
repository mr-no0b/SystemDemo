import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { AttendanceRecord } from "@/models/AttendanceRecord";
import { Enrollment } from "@/models/Enrollment";
import { CourseSection } from "@/models/CourseSection";
import { Result } from "@/models/Result";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const offeringId = url.searchParams.get("offeringId");
  const studentId = url.searchParams.get("studentId");
  const date = url.searchParams.get("date");

  if (session.user.role === "student") {
    // Step 1 — which exact sections is this student enrolled in?
    const enrollments = await Enrollment.find({ studentId: session.user.id }).lean();

    const enrolledSectionIds = [
      ...new Set(
        enrollments
          .map((e) => e.courseOfferingId?.toString())
          .filter((id): id is string => Boolean(id))
      ),
    ];

    if (enrolledSectionIds.length === 0) {
      return NextResponse.json({ success: true, data: {} });
    }

    // Step 2 — fetch only those specific sections (must have a teacher assigned)
    let allOfferings = await CourseSection.find(
      { _id: { $in: enrolledSectionIds }, isActive: true, teacherId: { $exists: true, $ne: null } },
    )
      .populate("courseId", "code title")
      .populate("teacherId", "name")
      .lean();

    // Exclude offerings from semesters that already have published results
    // (handles stale DB data from before semester-cleanup was in place)
    if (allOfferings.length > 0) {
      const combos = [...new Set(allOfferings.map((o) => `${o.semesterLabel}::${o.academicYear}`))];
      const completedCombos = new Set<string>();
      await Promise.all(
        combos.map(async (key) => {
          const [semLabel, acYear] = key.split("::");
          const exists = await Result.exists({ semesterLabel: semLabel, academicYear: acYear, isPublished: true });
          if (exists) completedCombos.add(key);
        })
      );
      allOfferings = allOfferings.filter((o) => !completedCombos.has(`${o.semesterLabel}::${o.academicYear}`));
    }

    if (allOfferings.length === 0) {
      return NextResponse.json({ success: true, data: {} });
    }

    // Step 3 — attendance records for all those offerings
    const allOfferingIds = allOfferings.map((o) => o._id);
    const records = await AttendanceRecord.find({
      courseOfferingId: { $in: allOfferingIds },
    }).lean();

    // Step 4 — build summary keyed by offeringId
    const summary: Record<
      string,
      { present: number; total: number; plannedClasses: number; code: string; title: string; teacher: string; lectures: { lectureNumber: number; date: string; status: string }[] }
    > = {};

    for (const off of allOfferings) {
      const oid = (off._id as object).toString();
      summary[oid] = {
        present: 0,
        total: 0,
        plannedClasses: off.plannedClasses ?? 40,
        code: (off.courseId as { code: string })?.code ?? "",
        title: (off.courseId as { title: string })?.title ?? "",
        teacher: (off.teacherId as { name: string } | null)?.name ?? "",
        lectures: [],
      };
    }

    for (const record of records) {
      const oid = record.courseOfferingId.toString();
      if (!summary[oid]) continue;
      summary[oid].total++;
      const entry = record.records.find(
        (r: { studentId: { toString(): string }; status: string }) =>
          r.studentId.toString() === session.user.id
      );
      const status = entry?.status ?? "absent";
      if (entry && (status === "present" || status === "late")) {
        summary[oid].present++;
      }
      summary[oid].lectures.push({
        lectureNumber: record.lectureNumber,
        date: record.date.toString(),
        status,
      });
    }

    // Sort lectures by lecture number within each offering
    for (const oid of Object.keys(summary)) {
      summary[oid].lectures.sort((a, b) => a.lectureNumber - b.lectureNumber);
    }

    return NextResponse.json({ success: true, data: summary });
  }

  // Teacher fetching
  const students = url.searchParams.get("students") === "true";
  if (students && offeringId) {
    // Include students enrolled in any sibling offering (same course, different teacher slot)
    const thisOffering = await CourseSection.findById(offeringId).select("courseId").lean();
    const siblingIds = thisOffering
      ? (await CourseSection.find({ courseId: thisOffering.courseId, isActive: true }, "_id").lean()).map((s) => s._id)
      : [offeringId];
    const allEnrollments = await Enrollment.find({ courseOfferingId: { $in: siblingIds } })
      .populate("studentId", "name userId")
      .lean();
    // Deduplicate by studentId
    const seen = new Set<string>();
    const enrollments = allEnrollments.filter((en) => {
      const sid = (en.studentId as { _id: { toString(): string } })._id.toString();
      if (seen.has(sid)) return false;
      seen.add(sid);
      return true;
    });
    return NextResponse.json({ success: true, data: enrollments });
  }

  const query: Record<string, unknown> = {};
  if (offeringId) query.courseOfferingId = offeringId;
  if (date) {
    const d = new Date(date);
    const nextDay = new Date(d);
    nextDay.setDate(d.getDate() + 1);
    query.date = { $gte: d, $lt: nextDay };
  }

  const records = await AttendanceRecord.find(query).sort({ date: -1 }).lean();
  return NextResponse.json({ success: true, data: records });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const body = await req.json();
  const { courseOfferingId, date, records } = body;

  // Get existing lecture count for this offering
  const lastRecord = await AttendanceRecord.findOne({ courseOfferingId })
    .sort({ lectureNumber: -1 })
    .select("lectureNumber")
    .lean();

  const lectureNumber = lastRecord ? lastRecord.lectureNumber + 1 : 1;

  const record = await AttendanceRecord.create({
    courseOfferingId,
    teacherId: session.user.id,
    date: new Date(date),
    lectureNumber,
    records,
  });

  return NextResponse.json({ success: true, data: record }, { status: 201 });
}
