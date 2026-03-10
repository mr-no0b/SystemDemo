import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Notice } from "@/models/Notice";
import { CourseSection } from "@/models/CourseSection";

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
