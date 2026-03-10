import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Session } from "@/models/Session";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const sessions = await Session.find({})
    .sort({ year: -1 })
    .lean();
  return NextResponse.json({ success: true, data: sessions });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const body = await req.json();
  const { year } = body;

  if (!year?.trim()) {
    return NextResponse.json({ error: "Session year is required (e.g. 2025-26)" }, { status: 400 });
  }

  const existing = await Session.findOne({ year: year.trim() });
  if (existing) {
    return NextResponse.json({ error: "This session already exists" }, { status: 409 });
  }

  const newSession = await Session.create({
    year: year.trim(),
    isActive: true,
    createdBy: session.user.id,
  });

  return NextResponse.json({ success: true, data: newSession }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const body = await req.json();
  const { id, isActive } = body;

  const updated = await Session.findByIdAndUpdate(
    id,
    { $set: { isActive } },
    { new: true }
  );
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: updated });
}
