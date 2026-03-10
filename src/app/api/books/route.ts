import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { BookRecommendation } from "@/models/BookRecommendation";

export async function GET(req: NextRequest) {
  await connectDB();
  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");
  const teacherId = url.searchParams.get("teacherId");

  const query: Record<string, unknown> = {};
  if (courseId) query.courseId = courseId;
  if (teacherId) query.teacherId = teacherId;

  const books = await BookRecommendation.find(query)
    .populate("teacherId", "name")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ success: true, data: books });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "teacher") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const body = await req.json();
    const { courseId, title, author, link, comment } = body;
    if (!courseId || !title?.trim()) {
      return NextResponse.json({ error: "courseId and title are required" }, { status: 400 });
    }
    const book = await BookRecommendation.create({
      courseId,
      teacherId: session.user.id,
      title: title.trim(),
      author: author?.trim() || undefined,
      link: link?.trim() || undefined,
      comment: comment?.trim() || undefined,
    });
    const populated = await book.populate("teacherId", "name");
    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("POST /api/books error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
