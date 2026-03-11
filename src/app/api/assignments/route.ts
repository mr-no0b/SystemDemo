import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Assignment } from "@/models/Assignment";
import { Submission } from "@/models/Submission";
import { Enrollment } from "@/models/Enrollment";
import { User } from "@/models/User";
import { CourseSection } from "@/models/CourseSection";
import { createNotificationsForMany } from "@/lib/notify";
import { sendEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const offeringId = url.searchParams.get("offeringId");

  const query: Record<string, unknown> = { isPublished: true };
  if (offeringId) query.courseOfferingId = offeringId;

  const assignments = await Assignment.find(query).sort({ dueDate: 1 }).lean();
  return NextResponse.json({ success: true, data: assignments });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const body = await req.json();
  const assignment = await Assignment.create({ ...body, teacherId: session.user.id, isPublished: true });

  // Notify enrolled students
  try {
    const enrollments = await Enrollment.find({ courseOfferingId: body.courseOfferingId }).select("studentId").lean();
    const studentIds = enrollments.map((e) => e.studentId);
    const section = await CourseSection.findById(body.courseOfferingId).populate("courseId", "code title").lean() as { courseId?: { code?: string; title?: string } } | null;
    const courseCode = section?.courseId?.code ?? "Course";
    const courseTitle = section?.courseId?.title ?? "";
    const teacher = await User.findById(session.user.id).lean();
    const teacherName = teacher?.name ?? "Teacher";
    const due = new Date(body.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

    await createNotificationsForMany(studentIds, {
      title: `New Assignment in ${courseCode}`,
      message: `${body.title} — Due: ${due}`,
      type: "announcement",
      link: "/student/classroom",
    });

    const students = await User.find({ _id: { $in: studentIds }, email: { $exists: true, $ne: "" } }).select("name email").lean();
    for (const student of students) {
      if (student.email) {
        sendEmail({
          to: student.email,
          subject: `New Assignment: ${body.title} (${courseCode})`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;background:#f8fafc;border-radius:12px">
            <div style="background:#4f46e5;padding:16px 24px;border-radius:8px 8px 0 0"><h1 style="color:#fff;margin:0;font-size:20px">AcademiaOne</h1></div>
            <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
              <h2 style="color:#1e293b;margin-top:0">New Assignment Posted</h2>
              <p>Dear <strong>${student.name}</strong>,</p>
              <p><strong>${teacherName}</strong> posted a new assignment in <strong>${courseCode} — ${courseTitle}</strong>:</p>
              <div style="background:#f1f5f9;padding:16px;border-radius:8px;margin:16px 0">
                <h3 style="margin-top:0;color:#1e293b">${body.title}</h3>
                <p style="color:#475569">${body.description ?? ""}</p>
                <p style="color:#dc2626;font-weight:600">Due: ${due}</p>
              </div>
              <p>Log in to AcademiaOne to view and submit the assignment.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
              <p style="color:#94a3b8;font-size:12px;margin:0">This is an automated message from AcademiaOne.</p>
            </div>
          </div>`,
        });
      }
    }
  } catch (err) {
    console.error("[assignment] notification/email error:", err);
  }

  return NextResponse.json({ success: true, data: assignment }, { status: 201 });
}
