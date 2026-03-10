import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Department } from "@/models/Department";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const dept = await Department.findById(id)
    .populate("headId", "name userId")
    .populate("advisorIds", "name userId")
    .lean();
  if (!dept) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: dept });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const body = await req.json();
  const { action, teacherId, name, code } = body;

  // Named actions for advisor/head management
  if (action === "add_advisor" && teacherId) {
    const dept = await Department.findByIdAndUpdate(
      id,
      { $addToSet: { advisorIds: teacherId } },
      { new: true }
    ).populate("headId", "name userId").populate("advisorIds", "name userId").lean();
    return NextResponse.json({ success: true, data: dept });
  }

  if (action === "remove_advisor" && teacherId) {
    const dept = await Department.findByIdAndUpdate(
      id,
      { $pull: { advisorIds: teacherId } },
      { new: true }
    ).populate("headId", "name userId").populate("advisorIds", "name userId").lean();
    return NextResponse.json({ success: true, data: dept });
  }

  if (action === "set_head") {
    // teacherId can be null to unset
    const dept = await Department.findByIdAndUpdate(
      id,
      { $set: { headId: teacherId || null } },
      { new: true }
    ).populate("headId", "name userId").populate("advisorIds", "name userId").lean();
    return NextResponse.json({ success: true, data: dept });
  }

  // Generic field update (name, code)
  const update: Record<string, unknown> = {};
  if (name) update.name = name;
  if (code) update.code = code;
  const dept = await Department.findByIdAndUpdate(id, { $set: update }, { new: true })
    .populate("headId", "name userId").populate("advisorIds", "name userId").lean();
  return NextResponse.json({ success: true, data: dept });
}
