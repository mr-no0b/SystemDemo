import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Course } from "@/models/Course";
import { CourseSection } from "@/models/CourseSection";
import { Enrollment } from "@/models/Enrollment";
import { AttendanceRecord } from "@/models/AttendanceRecord";
import { AttendanceSession } from "@/models/AttendanceSession";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const { id } = await params;
  const body = await req.json();

  // Only allow patching teacherId
  const update: Record<string, unknown> = {};
  if ("teacherId" in body) update.teacherId = body.teacherId || null;

  const course = await Course.findByIdAndUpdate(id, update, { new: true })
    .populate("departmentId", "name code")
    .populate("teacherId", "name userId");

  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Sync all sections of this course so ?mine=true stays accurate
  if ("teacherId" in body) {
    await CourseSection.updateMany(
      { courseId: id },
      { teacherId: body.teacherId || null }
    );
  }

  return NextResponse.json({ success: true, data: course });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const { id } = await params;

  const course = await Course.findById(id);
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Find all sections for this course and cascade-delete related records
  const sections = await CourseSection.find({ courseId: id }).lean();
  const sectionIds = sections.map((s) => s._id);

  await Promise.all([
    Enrollment.deleteMany({ courseOfferingId: { $in: sectionIds } }),
    AttendanceRecord.deleteMany({ courseOfferingId: { $in: sectionIds } }),
    AttendanceSession.deleteMany({ courseOfferingId: { $in: sectionIds } }),
    CourseSection.deleteMany({ courseId: id }),
  ]);

  await Course.findByIdAndDelete(id);

  return NextResponse.json({ success: true });
}
