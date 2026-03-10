import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { CourseSection } from "@/models/CourseSection";

/**
 * PATCH /api/sections/[id]
 * Admin only. Assigns or changes the teacher for a course section.
 * Body: { teacherId }  — pass null/empty to unassign.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session || (session.user.role !== "admin" && session.user.role !== "teacher")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  await connectDB();

  const body = await req.json();

  // ── Teacher: may only update plannedClasses for their own section ─────────
  if (session.user.role === "teacher") {
    if (!("plannedClasses" in body)) {
      return NextResponse.json({ error: "Teachers may only update plannedClasses" }, { status: 403 });
    }
    const sec = await CourseSection.findById(id).lean();
    if (!sec || sec.teacherId?.toString() !== session.user.id) {
      return NextResponse.json({ error: "Not your section" }, { status: 403 });
    }
    const updated = await CourseSection.findByIdAndUpdate(
      id,
      { $set: { plannedClasses: Number(body.plannedClasses) } },
      { new: true }
    ).lean();
    return NextResponse.json({ success: true, data: updated });
  }

  // ── Admin: full update ────────────────────────────────────────────────────
  const update: Record<string, unknown> = {};

  if ("teacherId" in body) {
    update.teacherId = body.teacherId || null;
  }
  if ("isActive" in body) {
    update.isActive = body.isActive;
  }
  if ("plannedClasses" in body) {
    update.plannedClasses = Number(body.plannedClasses);
  }

  const section = await CourseSection.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true }
  )
    .populate("courseId", "code title credits")
    .populate("teacherId", "name userId")
    .lean();

  if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: section });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  await connectDB();
  await CourseSection.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
