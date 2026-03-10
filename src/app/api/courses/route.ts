import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Course } from "@/models/Course";
import { CourseSection } from "@/models/CourseSection";

export async function GET(req: NextRequest) {
  await connectDB();
  const url = new URL(req.url);
  const dept = url.searchParams.get("dept");
  const sem = url.searchParams.get("semester");
  const query: Record<string, unknown> = {};
  if (dept) query.departmentId = dept;
  if (sem) query.semesterLabel = sem;
  const courses = await Course.find(query).populate("departmentId", "name code").populate("teacherId", "name userId").lean();
  return NextResponse.json({ success: true, data: courses });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const body = await req.json();

  let course;
  try {
    course = await Course.create(body);
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 11000) {
      return NextResponse.json(
        { error: `A course with code "${body.code}" already exists in this department.` },
        { status: 409 }
      );
    }
    throw err;
  }

  // Auto-create a default section so students can register immediately.
  // teacherId is left unset (TBA) — assign a teacher later via scheduling.
  const currentYear = new Date().getFullYear();
  const academicYear = `${currentYear}-${currentYear + 1}`;
  await CourseSection.create({
    courseId: course._id,
    departmentId: course.departmentId,
    semesterLabel: course.semesterLabel,
    academicYear,
    section: "A",
    isActive: true,
  }).catch(() => {
    // Silently ignore duplicate if section already exists
  });

  return NextResponse.json({ success: true, data: course }, { status: 201 });
}
