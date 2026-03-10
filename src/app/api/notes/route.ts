import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Note } from "@/models/Note";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const dept = url.searchParams.get("dept");
  const sem = url.searchParams.get("semester");
  const course = url.searchParams.get("course");

  const query: Record<string, unknown> = {};
  if (dept) query.departmentId = dept;
  if (sem) query.semesterLabel = sem;
  if (course) query.courseId = course;

  const notes = await Note.find(query)
    .populate("uploadedBy", "name userId role")
    .populate("courseId", "code title")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ success: true, data: notes });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    // Notes are student-only
    if (!session || session.user.role !== "student") {
      return NextResponse.json({ error: "Only students can share notes" }, { status: 403 });
    }

    await connectDB();
    const { title, description, driveLink, tags } = await req.json();

    if (!title?.trim() || !driveLink?.trim()) {
      return NextResponse.json({ error: "Title and Drive link are required" }, { status: 400 });
    }

    const note = await Note.create({
      title: title.trim(),
      description: description?.trim() || undefined,
      driveLink: driveLink.trim(),
      tags: Array.isArray(tags) ? tags : [],
      uploadedBy: session.user.id,
      // departmentId and semesterLabel come from the authenticated student's session
      departmentId: session.user.departmentId,
      semesterLabel: session.user.currentSemester,
    });

    const populated = await Note.findById(note._id)
      .populate("uploadedBy", "name userId")
      .lean();

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("POST /api/notes error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
