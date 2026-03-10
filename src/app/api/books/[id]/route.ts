import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { BookRecommendation } from "@/models/BookRecommendation";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const { id } = await params;
  const book = await BookRecommendation.findById(id);
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (book.teacherId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await book.deleteOne();
  return NextResponse.json({ success: true });
}
