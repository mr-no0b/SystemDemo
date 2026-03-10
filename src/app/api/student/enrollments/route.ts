import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Enrollment } from "@/models/Enrollment";

/**
 * GET /api/student/enrollments
 * Returns the authenticated student's enrollments (minimal fields).
 * Used for eligibility checks (e.g. elections).
 */
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();

  const enrollments = await Enrollment.find({ studentId: session.user.id })
    .select("semesterLabel academicYear")
    .lean();

  return NextResponse.json({ success: true, data: enrollments });
}
