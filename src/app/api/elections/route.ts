import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Election } from "@/models/Election";
import { ElectionCandidate } from "@/models/ElectionCandidate";
import { ElectionVote } from "@/models/ElectionVote";
import { Department } from "@/models/Department";

async function isHead(userId: string, deptId: string): Promise<boolean> {
  const dept = await Department.findById(deptId).lean();
  return dept?.headId?.toString() === userId;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  await connectDB();
  const url = new URL(req.url);
  const dept = url.searchParams.get("dept") ?? session?.user?.departmentId;

  const query: Record<string, unknown> = {};
  if (dept) query.departmentId = dept;

  const elections = await Election.find(query)
    .populate("departmentId", "name code")
    .populate("createdBy", "name")
    .populate({ path: "selectedCandidateId", populate: { path: "studentId", select: "name userId" } })
    .sort({ positionType: 1, session: 1, createdAt: -1 })
    .lean();

  return NextResponse.json({ success: true, data: elections });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const { positionType, positionLabel, session: sessionLabel, academicYear, departmentId } = await req.json();
  const deptId = departmentId ?? session.user.departmentId;
  if (!deptId) return NextResponse.json({ error: "No department assigned" }, { status: 400 });

  // Only the dept head can create elections
  if (!(await isHead(session.user.id, deptId))) {
    return NextResponse.json({ error: "Only the department head can create elections." }, { status: 403 });
  }

  if (!positionType || !positionLabel) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const election = await Election.create({
    departmentId: deptId,
    positionType,
    positionLabel,
    session: sessionLabel ?? undefined,
    academicYear: academicYear ?? undefined,
    createdBy: session.user.id,
  });
  return NextResponse.json({ success: true, data: election }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const deptId = session.user.departmentId;
  if (!deptId) return NextResponse.json({ error: "No department assigned" }, { status: 400 });

  // Only dept head can bulk-delete
  if (!(await isHead(session.user.id, deptId))) {
    return NextResponse.json({ error: "Only the department head can delete elections." }, { status: 403 });
  }

  const elections = await Election.find({ departmentId: deptId }).select("_id").lean();
  const ids = elections.map(e => e._id);
  await ElectionCandidate.deleteMany({ electionId: { $in: ids } });
  await ElectionVote.deleteMany({ electionId: { $in: ids } });
  await Election.deleteMany({ departmentId: deptId });
  return NextResponse.json({ success: true, deleted: elections.length });
}
