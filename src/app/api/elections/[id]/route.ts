import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Election } from "@/models/Election";
import { ElectionCandidate } from "@/models/ElectionCandidate";
import { ElectionVote } from "@/models/ElectionVote";
import { Department } from "@/models/Department";
import { User } from "@/models/User";
import { createNotificationsForMany } from "@/lib/notify";
import { sendEmail, electionUpdateEmail } from "@/lib/email";

const NEXT_STATUS: Record<string, string> = {
  draft: "applications_open",
  applications_open: "voting",
  voting: "completed",
};

async function isHead(userId: string, deptId: string): Promise<boolean> {
  const dept = await Department.findById(deptId).lean();
  return dept?.headId?.toString() === userId;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const body = await req.json();
  const { action, candidateId } = body;

  const election = await Election.findById(id);
  if (!election) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Head-only actions
  const headOnlyActions = ["advance", "select_winner", "mark_empty"];
  if (headOnlyActions.includes(action)) {
    if (!(await isHead(session.user.id, election.departmentId.toString()))) {
      return NextResponse.json({ error: "Only the department head can perform this action." }, { status: 403 });
    }
  }

  if (action === "advance") {
    const next = NEXT_STATUS[election.status];
    if (!next) return NextResponse.json({ error: "Already at final stage" }, { status: 400 });

    let winnerId: string | null = null;
    if (election.status === "voting") {
      const top = await ElectionCandidate.findOne({ electionId: id, status: "approved" })
        .sort({ voteCount: -1 })
        .lean();
      if (top && (top.voteCount ?? 0) > 0) {
        election.selectedCandidateId = top._id as unknown as typeof election.selectedCandidateId;
        winnerId = top._id.toString();
      }
    }

    election.status = next as typeof election.status;
    await election.save();

    // Notify all students + teachers in the department
    try {
      const deptUsers = await User.find({ departmentId: election.departmentId, isActive: true }).select("_id name email").lean();
      const userIds = deptUsers.map((u) => u._id);
      const statusLabels: Record<string, string> = { applications_open: "Applications are now open", voting: "Voting has started", completed: "Election results are out" };
      const statusLabel = statusLabels[next] ?? next;
      await createNotificationsForMany(userIds, { title: `Election Update: ${election.title ?? "Departmental Election"}`, message: statusLabel, type: "election", link: "/student/elections" });
      for (const user of deptUsers) {
        if (user.email) sendEmail({ to: user.email, subject: `Election Update: ${election.title ?? "Election"}`, html: electionUpdateEmail({ recipientName: user.name, electionTitle: election.title ?? "Election", newStatus: next }) });
      }
    } catch (err) { console.error("[election] notification error:", err); }

    return NextResponse.json({ success: true, status: election.status, winnerId });
  }

  if (action === "select_winner") {
    if (!candidateId) return NextResponse.json({ error: "candidateId required" }, { status: 400 });
    election.selectedCandidateId = candidateId as unknown as typeof election.selectedCandidateId;
    election.isEmpty = false;
    await election.save();
    return NextResponse.json({ success: true });
  }

  if (action === "mark_empty") {
    election.selectedCandidateId = undefined;
    election.isEmpty = true;
    await election.save();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const election = await Election.findById(id).lean();
  if (!election) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only head can delete
  if (!(await isHead(session.user.id, election.departmentId.toString()))) {
    return NextResponse.json({ error: "Only the department head can delete elections." }, { status: 403 });
  }

  await Election.findByIdAndDelete(id);
  await ElectionCandidate.deleteMany({ electionId: id });
  await ElectionVote.deleteMany({ electionId: id });
  return NextResponse.json({ success: true });
}
