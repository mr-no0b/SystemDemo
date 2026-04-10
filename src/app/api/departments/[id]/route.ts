import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Department } from "@/models/Department";
import { User } from "@/models/User";

async function attachDerivedAdvisors(dept: {
  _id: { toString(): string };
} | null) {
  if (!dept) return null;

  const advisors = await User.find({
    role: "teacher",
    isActive: true,
    departmentId: dept._id,
  })
    .select("name userId")
    .lean();

  return {
    ...dept,
    advisorIds: advisors
      .map((advisor) => ({
        _id: advisor._id.toString(),
        name: advisor.name,
        userId: advisor.userId,
      }))
      .sort((left, right) => left.userId.localeCompare(right.userId, undefined, { numeric: true })),
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const dept = await Department.findById(id)
    .populate("headId", "name userId")
    .lean();
  if (!dept) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: await attachDerivedAdvisors(dept) });
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
    ).populate("headId", "name userId").lean();
    return NextResponse.json({ success: true, data: await attachDerivedAdvisors(dept) });
  }

  if (action === "remove_advisor" && teacherId) {
    const dept = await Department.findByIdAndUpdate(
      id,
      { $pull: { advisorIds: teacherId } },
      { new: true }
    ).populate("headId", "name userId").lean();
    return NextResponse.json({ success: true, data: await attachDerivedAdvisors(dept) });
  }

  if (action === "set_head") {
    // teacherId can be null to unset
    const dept = await Department.findByIdAndUpdate(
      id,
      { $set: { headId: teacherId || null } },
      { new: true }
    ).populate("headId", "name userId").lean();
    return NextResponse.json({ success: true, data: await attachDerivedAdvisors(dept) });
  }

  // Generic field update (name, code)
  const update: Record<string, unknown> = {};
  if (name) update.name = name;
  if (code) update.code = code;
  const dept = await Department.findByIdAndUpdate(id, { $set: update }, { new: true })
    .populate("headId", "name userId").lean();
  return NextResponse.json({ success: true, data: await attachDerivedAdvisors(dept) });
}
