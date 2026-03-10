import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Department } from "@/models/Department";

export async function GET() {
  await connectDB();
  const depts = await Department.find()
    .populate("headId", "name userId")
    .populate("advisorIds", "name userId")
    .lean();
  return NextResponse.json({ success: true, data: depts });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const body = await req.json();
  const dept = await Department.create(body);
  return NextResponse.json({ success: true, data: dept }, { status: 201 });
}
