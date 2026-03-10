import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { AttendanceSession } from "@/models/AttendanceSession";
import { AttendanceRecord } from "@/models/AttendanceRecord";
import { Enrollment } from "@/models/Enrollment";
import { CourseSection } from "@/models/CourseSection";

/** Generates a 6-character uppercase alphanumeric code (no ambiguous chars) */
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ---------------------------------------------------------------------------
// GET /api/attendance/session
// Teacher:  ?offeringId=X  → returns active session (code + live student list)
// Student:  ?studentView=true → returns open session offeringIds (NO code)
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);

  // ── Teacher ──────────────────────────────────────────────────────────────
  if (session.user.role === "teacher") {
    const offeringId = url.searchParams.get("offeringId");
    if (!offeringId) return NextResponse.json({ error: "offeringId required" }, { status: 400 });

    const activeSession = await AttendanceSession.findOne({
      courseOfferingId: offeringId,
      isOpen: true,
    }).lean();

    if (!activeSession) return NextResponse.json({ success: true, data: null });

    // Build student list — include students enrolled in any sibling offering (same course)
    const thisOffering = await CourseSection.findById(offeringId).select("courseId").lean();
    const siblingIds = thisOffering
      ? (await CourseSection.find({ courseId: thisOffering.courseId, isActive: true }, "_id").lean()).map((s) => s._id)
      : [offeringId];
    const enrollments = await Enrollment.find({ courseOfferingId: { $in: siblingIds } })
      .populate("studentId", "name userId")
      .lean();
    // Deduplicate by studentId (student may have enrollment in multiple sibling slots)
    const seenStudents = new Set<string>();
    const uniqueEnrollments = enrollments.filter((en) => {
      const sid = (en.studentId as { _id: object })._id.toString();
      if (seenStudents.has(sid)) return false;
      seenStudents.add(sid);
      return true;
    });

    const presentIds = (activeSession.presentStudentIds ?? []).map((id: { toString(): string }) =>
      id.toString()
    );

    const students = uniqueEnrollments.map((en) => {
      const s = en.studentId as { _id: object; name: string; userId: string };
      return {
        _id: s._id.toString(),
        name: s.name,
        userId: s.userId,
        marked: presentIds.includes(s._id.toString()),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        _id: (activeSession._id as object).toString(),
        code: activeSession.code,
        date: activeSession.date,
        lectureNumber: activeSession.lectureNumber,
        isOpen: activeSession.isOpen,
        students,
      },
    });
  }

  // ── Student ───────────────────────────────────────────────────────────────
  if (session.user.role === "student") {
    // Direct enrollments
    const enrollments = await Enrollment.find({ studentId: session.user.id }).lean();
    const directOfferingIds = enrollments.map((e) => e.courseOfferingId);

    // Sibling offerings — same courses, all teachers
    const directOfferings = await CourseSection.find(
      { _id: { $in: directOfferingIds } },
      "courseId"
    ).lean();
    const courseIds = [...new Set(directOfferings.map((o) => o.courseId.toString()))];
    const siblingOfferings = await CourseSection.find(
      { courseId: { $in: courseIds }, isActive: true },
      "_id"
    ).lean();
    const allOfferingIds = [
      ...directOfferingIds,
      ...siblingOfferings
        .map((o) => o._id)
        .filter((id) => !directOfferingIds.some((d) => d.toString() === id.toString())),
    ];

    const openSessions = await AttendanceSession.find({
      courseOfferingId: { $in: allOfferingIds },
      isOpen: true,
    }).lean();

    return NextResponse.json({
      success: true,
      data: openSessions.map((s) => ({
        sessionId: (s._id as object).toString(),
        offeringId: s.courseOfferingId.toString(),
        alreadyMarked: (s.presentStudentIds ?? []).some(
          (id: { toString(): string }) => id.toString() === session.user.id
        ),
      })),
    });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ---------------------------------------------------------------------------
// POST /api/attendance/session
// Teacher starts a live attendance session for a course.
// Body: { offeringId, date? }
// Returns: { sessionId, code, lectureNumber }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { offeringId, date } = await req.json();
  if (!offeringId) return NextResponse.json({ error: "offeringId required" }, { status: 400 });

  // Close any existing open session for this offering (safety)
  await AttendanceSession.updateMany(
    { courseOfferingId: offeringId, isOpen: true },
    { $set: { isOpen: false } }
  );

  // Auto-increment lecture number based on saved records
  const lastRecord = await AttendanceRecord.findOne({ courseOfferingId: offeringId })
    .sort({ lectureNumber: -1 })
    .select("lectureNumber")
    .lean();

  const lectureNumber = lastRecord ? lastRecord.lectureNumber + 1 : 1;
  const code = generateCode();

  const newSession = await AttendanceSession.create({
    courseOfferingId: offeringId,
    teacherId: session.user.id,
    code,
    date: date ? new Date(date) : new Date(),
    lectureNumber,
    presentStudentIds: [],
    isOpen: true,
  });

  return NextResponse.json({
    success: true,
    data: {
      sessionId: (newSession._id as object).toString(),
      code,
      lectureNumber,
    },
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/attendance/session
// Student submits code to mark their own attendance.
// Body: { sessionId, code }
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { sessionId, code } = await req.json();
  if (!sessionId || !code) {
    return NextResponse.json({ error: "sessionId and code required" }, { status: 400 });
  }

  const activeSession = await AttendanceSession.findById(sessionId);
  if (!activeSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (!activeSession.isOpen) {
    return NextResponse.json({ error: "Session is closed" }, { status: 400 });
  }
  if (activeSession.code !== (code as string).toUpperCase().trim()) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  // Verify the student is enrolled in this course (direct slot OR any sibling offering)
  const directEnrollment = await Enrollment.findOne({
    studentId: session.user.id,
    courseOfferingId: activeSession.courseOfferingId,
  });

  let enrolled = !!directEnrollment;
  if (!enrolled) {
    // Check sibling offerings — same courseId, different teacher slot
    const sessionOffering = await CourseSection.findById(activeSession.courseOfferingId).select("courseId").lean();
    if (sessionOffering) {
      const siblingIds = await CourseSection.find(
        { courseId: sessionOffering.courseId, isActive: true },
        "_id"
      ).lean();
      const siblingEnrollment = await Enrollment.findOne({
        studentId: session.user.id,
        courseOfferingId: { $in: siblingIds.map((s) => s._id) },
      });
      enrolled = !!siblingEnrollment;
    }
  }

  if (!enrolled) {
    return NextResponse.json({ error: "Not enrolled in this course" }, { status: 403 });
  }

  // Idempotent — use $addToSet so double-submissions are harmless
  const alreadyMarked = activeSession.presentStudentIds.some(
    (id: { toString(): string }) => id.toString() === session.user.id
  );

  if (!alreadyMarked) {
    await AttendanceSession.findByIdAndUpdate(sessionId, {
      $addToSet: {
        presentStudentIds: new mongoose.Types.ObjectId(session.user.id),
      },
    });
  }

  return NextResponse.json({ success: true, alreadyMarked });
}

// ---------------------------------------------------------------------------
// DELETE /api/attendance/session
// Teacher closes the session → saves AttendanceRecord → deletes session.
// Body: { sessionId }
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const activeSession = await AttendanceSession.findById(sessionId);
  if (!activeSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Fetch all enrolled students — include siblings (same course, different teacher slot)
  const closingOffering = await CourseSection.findById(activeSession.courseOfferingId).select("courseId").lean();
  const closingSiblingIds = closingOffering
    ? (await CourseSection.find({ courseId: closingOffering.courseId, isActive: true }, "_id").lean()).map((s) => s._id)
    : [activeSession.courseOfferingId];
  const allEnrollments = await Enrollment.find({ courseOfferingId: { $in: closingSiblingIds } }).lean();
  // Deduplicate by studentId
  const seenClose = new Set<string>();
  const enrollments = allEnrollments.filter((en) => {
    const sid = en.studentId.toString();
    if (seenClose.has(sid)) return false;
    seenClose.add(sid);
    return true;
  });

  const presentIds = (activeSession.presentStudentIds ?? []).map((id: { toString(): string }) =>
    id.toString()
  );

  const records = enrollments.map((en) => ({
    studentId: en.studentId,
    status: presentIds.includes(en.studentId.toString()) ? "present" : "absent",
  }));

  // Persist as an official AttendanceRecord
  await AttendanceRecord.create({
    courseOfferingId: activeSession.courseOfferingId,
    teacherId: activeSession.teacherId,
    date: activeSession.date,
    lectureNumber: activeSession.lectureNumber,
    records,
  });

  // Remove the live session
  await AttendanceSession.findByIdAndDelete(sessionId);

  return NextResponse.json({
    success: true,
    lectureNumber: activeSession.lectureNumber,
    presentCount: presentIds.length,
    totalCount: enrollments.length,
  });
}
