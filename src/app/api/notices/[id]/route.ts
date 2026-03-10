import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Notice } from "@/models/Notice";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role === "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const notice = await Notice.findById(id);
  if (!notice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.user.role !== "admin" && notice.publishedBy?.toString() !== session.user.id) {
    return NextResponse.json({ error: "You can only edit your own notices" }, { status: 403 });
  }
  const body = await req.json();
  const updated = await Notice.findByIdAndUpdate(id, { $set: body }, { new: true });
  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role === "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const notice = await Notice.findById(id);
  if (!notice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.user.role === "teacher" && notice.publishedBy?.toString() !== session.user.id) {
    return NextResponse.json({ error: "You can only delete your own notices" }, { status: 403 });
  }
  await Notice.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
