import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Assignment } from "@/models/Assignment";
import { Submission } from "@/models/Submission";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const offeringId = url.searchParams.get("offeringId");

  const query: Record<string, unknown> = { isPublished: true };
  if (offeringId) query.courseOfferingId = offeringId;

  const assignments = await Assignment.find(query).sort({ dueDate: 1 }).lean();
  return NextResponse.json({ success: true, data: assignments });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const body = await req.json();
  const assignment = await Assignment.create({ ...body, teacherId: session.user.id, isPublished: true });
  return NextResponse.json({ success: true, data: assignment }, { status: 201 });
}
