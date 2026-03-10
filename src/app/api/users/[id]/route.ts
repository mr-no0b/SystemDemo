import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const user = await User.findById(id).select("-password").populate("departmentId", "name code").populate("advisorId", "name userId").lean();
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: user });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const body = await req.json();
  const { name, email, role, departmentId, advisorId, currentSemester, isActive, password, session: userSession } = body;

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (email !== undefined) update.email = email;
  if (role !== undefined) update.role = role;
  if (departmentId !== undefined) update.departmentId = departmentId || null;
  if (advisorId !== undefined) update.advisorId = advisorId || null;
  if (currentSemester !== undefined) update.currentSemester = currentSemester;
  if (isActive !== undefined) update.isActive = isActive;
  if (password) update.password = await bcrypt.hash(password, 12);
  if (userSession !== undefined) update.session = userSession || null;

  const user = await User.findByIdAndUpdate(id, { $set: update }, { new: true })
    .select("-password")
    .populate("advisorId", "name userId")
    .lean();

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: user });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.id === id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }
  await connectDB();
  const deleted = await User.findByIdAndDelete(id);
  if (!deleted) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
