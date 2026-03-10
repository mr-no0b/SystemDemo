import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Submission } from "@/models/Submission";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const assignmentId = url.searchParams.get("assignmentId");

  if (session.user.role === "student") {
    const sub = await Submission.findOne({ assignmentId, studentId: session.user.id }).lean();
    return NextResponse.json({ success: true, data: sub });
  }

  // Teacher: all submissions for an assignment
  const submissions = await Submission.find({ assignmentId })
    .populate("studentId", "name userId")
    .lean();
  return NextResponse.json({ success: true, data: submissions });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const { assignmentId, driveLink } = await req.json();
  const existing = await Submission.findOne({ assignmentId, studentId: session.user.id });
  if (existing) {
    return NextResponse.json({ error: "Already submitted" }, { status: 409 });
  }
  const sub = await Submission.create({
    assignmentId,
    studentId: session.user.id,
    driveLink,
    submittedAt: new Date(),
  });
  return NextResponse.json({ success: true, data: sub }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const { submissionId, marks, feedback } = await req.json();
  const sub = await Submission.findByIdAndUpdate(
    submissionId,
    { $set: { marks, feedback, gradedBy: session.user.id, gradedAt: new Date() } },
    { new: true }
  );
  return NextResponse.json({ success: true, data: sub });
}
