import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { ElectionCandidate } from "@/models/ElectionCandidate";
import { ElectionVote } from "@/models/ElectionVote";
import { Election } from "@/models/Election";
import { User } from "@/models/User";
import { Department } from "@/models/Department";
import { Enrollment } from "@/models/Enrollment";

async function isDeptHead(userId: string, deptId: string): Promise<boolean> {
  const dept = await Department.findById(deptId).lean();
  return dept?.headId?.toString() === userId;
}

// GET — teacher: all candidates + CGPA; student: only approved, no CGPA
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  await connectDB();

  const isTeacher = session?.user?.role === "teacher" || session?.user?.role === "admin";
  const query: Record<string, unknown> = { electionId: id };
  if (!isTeacher) query.status = "approved";

  const candidates = await ElectionCandidate.find(query)
    .select(isTeacher ? "" : "-cgpa")
    .populate("studentId", "name userId")
    .populate("reviewedBy", "name")
    .sort({ voteCount: -1, createdAt: 1 })
    .lean();

  let myApplication = null;
  let myVote: string | null = null;
  if (session?.user?.role === "student") {
    myApplication = await ElectionCandidate.findOne({ electionId: id, studentId: session.user.id })
      .select("-cgpa")
      .lean();
    const vote = await ElectionVote.findOne({ electionId: id, voterId: session.user.id }).lean();
    myVote = vote?.candidateId?.toString() ?? null;
  }

  return NextResponse.json({ success: true, data: { candidates, myApplication, myVote } });
}

// POST — student applies
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "student") {
    return NextResponse.json({ error: "Only students can apply" }, { status: 401 });
  }
  await connectDB();
  const election = await Election.findById(id);
  if (!election || election.status !== "applications_open") {
    return NextResponse.json({ error: "Applications are not currently open" }, { status: 400 });
  }

  // Semester-scoped election: only students in the matching semester can apply
  const FULL_DEPT = "Full Department";
  if (election.session && election.session !== FULL_DEPT) {
    const student = await User.findById(session.user.id).select("currentSemester").lean();
    if (!student || student.currentSemester !== election.session) {
      return NextResponse.json(
        { error: `Only semester ${election.session} students can apply for this position` },
        { status: 403 }
      );
    }
    // Also enforce academic year if set
    if (election.academicYear) {
      const enrolled = await Enrollment.findOne({
        studentId: session.user.id,
        semesterLabel: election.session,
        academicYear: election.academicYear,
      }).lean();
      if (!enrolled) {
        return NextResponse.json(
          { error: `Only Sem ${election.session} · ${election.academicYear} students can apply for this position` },
          { status: 403 }
        );
      }
    }
  }
  const { manifesto, cgpa } = await req.json();
  if (!manifesto?.trim()) return NextResponse.json({ error: "Manifesto required" }, { status: 400 });
  const cgpaNum = cgpa !== undefined && cgpa !== "" ? parseFloat(String(cgpa)) : undefined;
  if (cgpaNum !== undefined && (isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 4)) {
    return NextResponse.json({ error: "CGPA must be between 0 and 4" }, { status: 400 });
  }
  try {
    const candidate = await ElectionCandidate.create({
      electionId: id,
      studentId: session.user.id,
      manifesto: manifesto.trim(),
      cgpa: cgpaNum,
    });
    const populated = await ElectionCandidate.findById(candidate._id)
      .populate("studentId", "name userId")
      .lean();
    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "You have already applied for this position" }, { status: 409 });
  }
}

// PATCH — teacher: approve/reject; student: vote
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const { action, candidateId, rejectionReason } = await req.json();

  if (action === "approve" || action === "reject") {
    if (session.user.role !== "teacher" && session.user.role !== "admin") {
      return NextResponse.json({ error: "Teachers only" }, { status: 403 });
    }
    // Only the dept head can approve/reject
    const election = await Election.findById(id).lean();
    if (!election) return NextResponse.json({ error: "Election not found" }, { status: 404 });
    if (session.user.role === "teacher" && !(await isDeptHead(session.user.id, election.departmentId.toString()))) {
      return NextResponse.json({ error: "Only the department head can review applications." }, { status: 403 });
    }
    const candidate = await ElectionCandidate.findByIdAndUpdate(
      candidateId,
      {
        $set: {
          status: action === "approve" ? "approved" : "rejected",
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          rejectionReason: rejectionReason ?? undefined,
        },
      },
      { new: true }
    ).populate("studentId", "name userId");
    return NextResponse.json({ success: true, data: candidate });
  }

  if (action === "vote") {
    if (session.user.role !== "student") {
      return NextResponse.json({ error: "Only students can vote" }, { status: 403 });
    }
    const election = await Election.findById(id);
    if (!election || election.status !== "voting") {
      return NextResponse.json({ error: "Voting is not open for this position" }, { status: 400 });
    }

    // Semester-scoped election: only students in the matching semester can vote
    const FULL_DEPT = "Full Department";
    if (election.session && election.session !== FULL_DEPT) {
      const student = await User.findById(session.user.id).select("currentSemester").lean();
      if (!student || student.currentSemester !== election.session) {
        return NextResponse.json(
          { error: `Only semester ${election.session} students can vote in this election` },
          { status: 403 }
        );
      }
      // Also enforce academic year if set
      if (election.academicYear) {
        const enrolled = await Enrollment.findOne({
          studentId: session.user.id,
          semesterLabel: election.session,
          academicYear: election.academicYear,
        }).lean();
        if (!enrolled) {
          return NextResponse.json(
            { error: `Only Sem ${election.session} · ${election.academicYear} students can vote in this election` },
            { status: 403 }
          );
        }
      }
    }
    const candidate = await ElectionCandidate.findById(candidateId);
    if (!candidate || candidate.status !== "approved" || candidate.electionId.toString() !== id) {
      return NextResponse.json({ error: "Invalid candidate" }, { status: 400 });
    }
    try {
      await ElectionVote.create({ electionId: id, voterId: session.user.id, candidateId });
      await ElectionCandidate.findByIdAndUpdate(candidateId, { $inc: { voteCount: 1 } });
    } catch {
      return NextResponse.json({ error: "You have already voted for this position" }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
