import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Enrollment } from "@/models/Enrollment";
import { CourseSection } from "@/models/CourseSection";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  const { sectionId } = await params;
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();

  // Ensure teacher owns this section
  const section = await CourseSection.findById(sectionId).lean();
  if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });
  if (section.teacherId?.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Find all sections for the same course in the same semester/year (any teacher)
  const siblingIds = await CourseSection.find({
    courseId: section.courseId,
    semesterLabel: section.semesterLabel,
    academicYear: section.academicYear,
    teacherId: { $exists: true, $ne: null },
  }).distinct("_id");

  // Return students enrolled in ANY of those sibling sections
  const enrollments = await Enrollment.find({ courseOfferingId: { $in: siblingIds } })
    .populate("studentId", "name userId email currentSemester")
    .sort({ createdAt: 1 })
    .lean();

  const students = enrollments.map((e) => e.studentId);

  // Deduplicate by studentId (a student may be enrolled in multiple sibling sections)
  const seen = new Set<string>();
  const uniqueStudents = students.filter((s) => {
    const id = (s as { _id: object })._id?.toString();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return NextResponse.json({ success: true, data: uniqueStudents, total: uniqueStudents.length });
}
