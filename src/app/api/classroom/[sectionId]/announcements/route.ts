import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Notice } from "@/models/Notice";
import { CourseSection } from "@/models/CourseSection";
import { Enrollment } from "@/models/Enrollment";
import { User } from "@/models/User";
import { createNotificationsForMany } from "@/lib/notify";
import { sendEmail, announcementEmail } from "@/lib/email";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  const { sectionId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();

  const notices = await Notice.find({ courseSectionId: sectionId, isActive: true })
    .populate("publishedBy", "name userId")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ success: true, data: notices });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  const { sectionId } = await params;
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();

  // Verify this teacher owns this section
  const section = await CourseSection.findById(sectionId).lean();
  if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });
  if (section.teacherId?.toString() !== session.user.id) {
    return NextResponse.json({ error: "You are not the teacher of this section" }, { status: 403 });
  }

  const { title, content } = await req.json();
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
  }

  const notice = await Notice.create({
    title: title.trim(),
    content: content.trim(),
    scope: "classroom",
    target: "students",
    courseSectionId: sectionId,
    departmentId: section.departmentId ?? undefined,
    publishedBy: session.user.id,
    isPinned: false,
  });

  const populated = await notice.populate("publishedBy", "name userId");

  // Notify enrolled students
  try {
    const enrollments = await Enrollment.find({ courseOfferingId: sectionId }).select("studentId").lean();
    const studentIds = enrollments.map((e) => e.studentId);
    const teacher = await User.findById(session.user.id).lean();
    const coursePopulated = await CourseSection.findById(sectionId).populate("courseId", "code title").lean() as { courseId?: { code?: string; title?: string } } | null;
    const courseCode = coursePopulated?.courseId?.code ?? "Course";
    const courseTitle = coursePopulated?.courseId?.title ?? "";
    const teacherName = teacher?.name ?? "Teacher";

    await createNotificationsForMany(studentIds, {
      title: `Announcement in ${courseCode}`,
      message: title.slice(0, 100),
      type: "announcement",
      link: "/student/classroom",
    });

    const students = await User.find({ _id: { $in: studentIds }, email: { $exists: true, $ne: "" } }).select("name email").lean();
    for (const student of students) {
      if (student.email) {
        sendEmail({
          to: student.email,
          subject: `New Announcement in ${courseCode}`,
          html: announcementEmail({ recipientName: student.name, courseCode, courseTitle, announcementTitle: title, announcementContent: content, teacherName }),
        });
      }
    }
  } catch (err) {
    console.error("[announcement] notification/email error:", err);
  }

  return NextResponse.json({ success: true, data: populated }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  const { sectionId } = await params;
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();

  const { noticeId } = await req.json();
  const notice = await Notice.findById(noticeId);
  if (!notice) return NextResponse.json({ error: "Notice not found" }, { status: 404 });
  if (notice.courseSectionId?.toString() !== sectionId || notice.publishedBy.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await notice.deleteOne();
  return NextResponse.json({ success: true });
}
