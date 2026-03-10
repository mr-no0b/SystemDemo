import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Registration } from "@/models/Registration";
import { Enrollment } from "@/models/Enrollment";
import { User } from "@/models/User";
import { Result } from "@/models/Result";
import { CourseSection } from "@/models/CourseSection";
import { RegistrationWindow } from "@/models/RegistrationWindow";
import { SEMESTERS } from "@/types";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const studentId = url.searchParams.get("studentId");
  const status = url.searchParams.get("status");
  const dept = url.searchParams.get("dept");

  const advisorId = url.searchParams.get("advisorId");
  const headId = url.searchParams.get("headId");

  const query: Record<string, unknown> = {};

  // Students can only see their own
  if (session.user.role === "student") {
    query.studentId = session.user.id;
  } else {
    if (studentId) query.studentId = studentId;
    if (dept) query.departmentId = dept;
    if (advisorId) query.advisorId = advisorId;
    if (headId) query.headId = headId;
  }
  if (status) query.status = status;

  const registrations = await Registration.find(query)
    .populate("studentId", "name userId")
    .populate({
      path: "courseOfferingIds",
      select: "courseId section teacherId semesterLabel",
      populate: [
        { path: "courseId", select: "code title credits" },
        { path: "teacherId", select: "name" },
      ],
    })
    .populate("advisorId", "name")
    .populate("headId", "name")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ success: true, data: registrations });
}

/**
 * POST — Admin initiates a course registration for a student.
 * Body: { studentId, semesterLabel, academicYear, advisorId }
 * - advisorId is required (admin picks from dept advisors)
 * Student self-applies for a semester.
 * Body: { semesterLabel, academicYear, courseOfferingIds }
 * Rules:
 *   - Registration window must be open for that semester + year
 *   - Student must have a published result for the previous semester (except 1-1)
 *   - advisorId is auto-taken from the student's profile
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "student") {
    return NextResponse.json({ error: "Only students can submit registrations" }, { status: 403 });
  }

  await connectDB();
  const body = await req.json();
  const { semesterLabel, academicYear, courseOfferingIds = [] } = body;

  if (!semesterLabel || !academicYear) {
    return NextResponse.json(
      { error: "semesterLabel and academicYear are required" },
      { status: 400 }
    );
  }

  // Registration window must be open
  const win = await RegistrationWindow.findOne({ semesterLabel, academicYear, isOpen: true }).lean();
  if (!win) {
    return NextResponse.json(
      { error: `Registration for semester ${semesterLabel} (${academicYear}) is not currently open.` },
      { status: 400 }
    );
  }

  const studentId = session.user.id;
  const student = await User.findById(studentId).lean();
  if (!student || student.role !== "student") {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  const departmentId = student.departmentId;
  if (!departmentId) {
    return NextResponse.json({ error: "Student has no department assigned" }, { status: 400 });
  }
  const advisorId = student.advisorId;
  if (!advisorId) {
    return NextResponse.json(
      { error: "No advisor is assigned to your profile. Contact your department." },
      { status: 400 }
    );
  }

  // Previous semester result check (skip for 1-1)
  const semIdx = SEMESTERS.indexOf(semesterLabel as typeof SEMESTERS[number]);
  if (semIdx > 0) {
    const prevSem = SEMESTERS[semIdx - 1];
    const prevResult = await Result.findOne({ studentId, semesterLabel: prevSem, isPublished: true }).lean();
    if (!prevResult) {
      return NextResponse.json(
        { error: `Results for semester ${prevSem} have not been published yet. You cannot register for ${semesterLabel} until then.` },
        { status: 400 }
      );
    }
  }

  // No duplicate registration
  const existing = await Registration.findOne({ studentId, semesterLabel, academicYear }).lean();
  if (existing) {
    return NextResponse.json({ error: "You already have a registration for this semester." }, { status: 409 });
  }

  // Use provided sections, or auto-select all active ones for dept+semester
  let finalIds: unknown[] = courseOfferingIds;
  if (finalIds.length === 0) {
    const sections = await CourseSection.find({ departmentId, semesterLabel, isActive: true }).lean();
    finalIds = sections.map((s) => s._id);
  }

  const reg = await Registration.create({
    studentId,
    semesterLabel,
    academicYear,
    departmentId,
    advisorId,
    courseOfferingIds: finalIds,
    status: "pending_advisor",
  });

  return NextResponse.json({ success: true, data: reg }, { status: 201 });
}
