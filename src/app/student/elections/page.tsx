"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Trophy, Crown, Minus, Check, Lock } from "@phosphor-icons/react";

type Candidate = {
  _id: string;
  studentId: { _id: string; name: string; userId: string };
  manifesto: string;
  status: "pending" | "approved" | "rejected";
  voteCount?: number;
};

type MyApplication = Candidate & { cgpa?: number };

type Position = {
  _id: string;
  positionType: string;
  positionLabel: string;
  session?: string;
  academicYear?: string;
  status: "draft" | "applications_open" | "voting" | "completed";
  selectedCandidateId?: { _id: string; studentId: { name: string; userId: string } } | null;
  isEmpty: boolean;
};

type PositionDetail = {
  candidates: Candidate[];
  myApplication: MyApplication | null;
  myVote: string | null;
};

const FULL_DEPT = "Full Department";

function sessionBadge(s?: string) {
  return s === FULL_DEPT
    ? "bg-purple-100 text-purple-700"
    : "bg-indigo-100 text-indigo-700";
}

const STATUS_COLOR: Record<string, string> = {
  draft:             "bg-slate-100 text-slate-400",
  applications_open: "bg-blue-50 text-blue-600",
  voting:            "bg-amber-50 text-amber-600",
  completed:         "bg-emerald-50 text-emerald-700",
};

const STATUS_LABEL: Record<string, string> = {
  draft:             "Upcoming",
  applications_open: "Applications Open",
  voting:            "Voting Now",
  completed:         "Completed",
};

export default function StudentElectionsPage() {
  const { toast: addToast } = useToast();
  const { data: session } = useSession();

  // Track student's enrolled (semesterLabel, academicYear) pairs for eligibility
  const [myEnrollments, setMyEnrollments] = useState<{ semesterLabel: string; academicYear: string }[]>([]);

  useEffect(() => {
    fetch("/api/student/enrollments")
      .then(r => r.json())
      .then(d => setMyEnrollments(d.data ?? []));
  }, []);

  function isEligible(pos: Position): boolean {
    // Full Department — always eligible
    if (!pos.session || pos.session === FULL_DEPT) return true;
    // Semester check
    if (session?.user?.currentSemester !== pos.session) return false;
    // Academic year check (only if election specifies one)
    if (pos.academicYear) {
      return myEnrollments.some(
        e => e.semesterLabel === pos.session && e.academicYear === pos.academicYear
      );
    }
    return true;
  }

  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Position | null>(null);
  const [detail, setDetail] = useState<PositionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Apply modal state
  const [showApply, setShowApply] = useState(false);
  const [applyForm, setApplyForm] = useState({ manifesto: "", cgpa: "" });
  const [applying, setApplying] = useState(false);

  const [votingFor, setVotingFor] = useState("");

  const fetchPositions = useCallback(async () => {
    const res = await fetch("/api/elections");
    const d = await res.json();
    setPositions(d.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPositions(); }, [fetchPositions]);

  async function loadDetail(pos: Position) {
    setSelected(pos);
    setDetailLoading(true);
    const res = await fetch(`/api/elections/${pos._id}/candidates`);
    const d = await res.json();
    setDetail(d.data ?? null);
    setDetailLoading(false);
  }

  async function applyNow() {
    if (!applyForm.manifesto.trim()) {
      addToast("Please write your manifesto", "error");
      return;
    }
    setApplying(true);
    const body: Record<string, unknown> = { manifesto: applyForm.manifesto.trim() };
    if (applyForm.cgpa.trim()) {
      const v = parseFloat(applyForm.cgpa);
      if (isNaN(v) || v < 0 || v > 4) {
        addToast("CGPA must be between 0 and 4", "error");
        setApplying(false);
        return;
      }
      body.cgpa = v;
    }
    const res = await fetch(`/api/elections/${selected!._id}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (d.success) {
      addToast("Application submitted!", "success");
      setShowApply(false);
      setApplyForm({ manifesto: "", cgpa: "" });
      await loadDetail(selected!);
    } else addToast(d.error || "Failed", "error");
    setApplying(false);
  }

  async function castVote(candidateId: string) {
    setVotingFor(candidateId);
    const res = await fetch(`/api/elections/${selected!._id}/candidates`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "vote", candidateId }),
    });
    const d = await res.json();
    if (d.success) {
      addToast("Vote cast successfully!", "success");
      await loadDetail(selected!);
    } else addToast(d.error || "Failed", "error");
    setVotingFor("");
  }

  // Completed positions for committee table
  const completedPositions = positions.filter(p => p.status === "completed");
  const activePositions = positions.filter(p => p.status !== "draft" && p.status !== "completed");

  return (
    <DashboardLayout role="student" title="Elections" breadcrumb="Home / Elections">
      <div className="max-w-5xl mx-auto">
        <div className="mb-5">
          <h2 className="font-bold text-slate-800">Elections & Committee</h2>
          <p className="text-xs text-slate-400 mt-0.5">View active elections, apply as a candidate, and vote for your department representatives</p>
        </div>

        {/* Committee Table */}
        {completedPositions.length > 0 && (
          <Card className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Crown size={18} className="text-amber-500" weight="fill" />
              <h3 className="font-bold text-slate-800">Current Committee</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {completedPositions.map(pos => {
                const winner = pos.selectedCandidateId as { studentId: { name: string; userId: string } } | null;
                return (
                  <div key={pos._id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sessionBadge(pos.session)}`}>
                          {pos.session ?? "Full Dept"}{pos.academicYear ? ` · ${pos.academicYear}` : ""}
                        </span>
                        <span className="text-sm font-semibold text-slate-700">{pos.positionLabel}</span>
                      </div>
                    </div>
                    <div>
                      {pos.isEmpty ? (
                        <span className="text-slate-400 text-sm italic flex items-center gap-1"><Minus size={13} /> Vacant</span>
                      ) : winner ? (
                        <span className="text-emerald-700 font-semibold text-sm flex items-center gap-1.5">
                          <Crown size={13} className="text-amber-500" weight="fill" />
                          {winner.studentId?.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm italic">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <div className="grid lg:grid-cols-5 gap-5">
          {/* Left: active positions list */}
          <div className="lg:col-span-2 space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Active Positions</p>
            {loading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : activePositions.length === 0 ? (
              <EmptyState icon={<Trophy size={28} />} title="No active elections" description="Check back later for upcoming elections." />
            ) : activePositions.map(pos => (
              <button key={pos._id} onClick={() => loadDetail(pos)}
                className={`w-full text-left rounded-2xl border p-4 transition ${selected?._id === pos._id ? "border-indigo-400 bg-indigo-50/60" : "border-slate-200 bg-white hover:border-indigo-200"}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sessionBadge(pos.session)}`}>
                    {pos.session ?? "Full Dept"}{pos.academicYear ? ` · ${pos.academicYear}` : ""}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[pos.status]}`}>{STATUS_LABEL[pos.status]}</span>
                </div>
                <p className="font-semibold text-slate-800 text-sm truncate">{pos.positionLabel}</p>
              </button>
            ))}
          </div>

          {/* Right: detail */}
          <div className="lg:col-span-3">
            {!selected ? (
              <div className="flex items-center justify-center h-52 text-slate-300 text-sm border border-dashed border-slate-200 rounded-2xl">
                Select a position to view details
              </div>
            ) : (
              <Card>
                {/* Position header */}
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sessionBadge(selected.session)}`}>
                    {selected.session ?? "Full Dept"}{selected.academicYear ? ` · ${selected.academicYear}` : ""}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[selected.status]}`}>{STATUS_LABEL[selected.status]}</span>
                </div>
                <h3 className="font-bold text-slate-800 text-lg mb-4">{selected.positionLabel}</h3>

                {detailLoading ? (
                  <div className="flex justify-center py-10"><Spinner /></div>
                ) : !detail ? (
                  <p className="text-slate-400 text-sm text-center py-8">Failed to load</p>
                ) : (
                  <>
                    {/* APPLICATIONS OPEN */}
                    {selected.status === "applications_open" && (
                      <div>
                        {/* Own application status / eligibility */}
                        {!isEligible(selected) ? (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 flex items-start gap-3">
                            <Lock size={16} className="text-slate-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-slate-600">Not eligible for this election</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                This election is open to <strong>Sem {selected.session}</strong>
                                {selected.academicYear ? <> · <strong>{selected.academicYear}</strong></> : null} students only.
                              </p>
                            </div>
                          </div>
                        ) : detail.myApplication ? (
                          <div className={`rounded-xl p-3 mb-4 text-sm border ${
                            detail.myApplication.status === "approved" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                            detail.myApplication.status === "rejected" ? "bg-rose-50 border-rose-200 text-rose-600" :
                            "bg-amber-50 border-amber-200 text-amber-700"
                          }`}>
                            {detail.myApplication.status === "approved" && <><Check size={13} className="inline mr-1" />Your application was <strong>approved</strong>!</>}
                            {detail.myApplication.status === "rejected" && <>Your application was <strong>not approved</strong> this time.</>}
                            {detail.myApplication.status === "pending" && <>Your application is <strong>pending review</strong>.</>}
                          </div>
                        ) : (
                          <div className="mb-4">
                            <p className="text-slate-500 text-sm mb-3">Applications are open. Would you like to run for this position?</p>
                            <Button size="sm" onClick={() => setShowApply(true)}>Apply Now</Button>
                          </div>
                        )}
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Applicants so far</p>
                        {detail.candidates.length === 0 ? (
                          <p className="text-slate-400 text-sm">No approved candidates yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {detail.candidates.map(c => (
                              <div key={c._id} className="border border-slate-200 rounded-xl p-3">
                                <p className="font-semibold text-slate-800 text-sm">{c.studentId?.name}</p>
                                <p className="text-slate-400 text-xs">{c.studentId?.userId}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* VOTING */}
                    {selected.status === "voting" && (
                      <div>
                        {!isEligible(selected) ? (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 flex items-start gap-3">
                            <Lock size={16} className="text-slate-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-slate-600">Not eligible to vote</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Only <strong>Sem {selected.session}</strong>
                                {selected.academicYear ? <> · <strong>{selected.academicYear}</strong></> : null} students can vote in this election.
                              </p>
                            </div>
                          </div>
                        ) : detail.myVote ? (
                          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl p-3 mb-4 flex items-center gap-2">
                            <Check size={14} weight="bold" /> You have voted. Results will be announced when the election ends.
                          </div>
                        ) : (
                          <p className="text-slate-500 text-sm mb-4">Click a candidate below to cast your vote. You can only vote once.</p>
                        )}
                        {isEligible(selected) && (detail.candidates.length === 0 ? (
                          <p className="text-slate-400 text-sm">No approved candidates in this election.</p>
                        ) : (
                          <div className="space-y-3">
                            {detail.candidates.map(c => {
                              const hasVoted = !!detail.myVote;
                              const isMyVote = detail.myVote === c._id;
                              return (
                                <div key={c._id} className={`border rounded-xl p-4 transition ${isMyVote ? "border-indigo-400 bg-indigo-50/40" : "border-slate-200"}`}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-semibold text-slate-800 text-sm">{c.studentId?.name}</p>
                                        {isMyVote && <Check size={13} className="text-indigo-600" weight="bold" />}
                                      </div>
                                      <p className="text-slate-400 text-xs mb-2">{c.studentId?.userId}</p>
                                      <p className="text-slate-600 text-sm">{c.manifesto}</p>
                                    </div>
                                    {!hasVoted && (
                                      <Button size="sm" isLoading={votingFor === c._id} onClick={() => castVote(c._id)}>
                                        Vote
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* COMPLETED */}
                    {selected.status === "completed" && (
                      <div>
                        {/* Winner banner */}
                        {selected.isEmpty ? (
                          <div className="bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-3 mb-4">
                            <Minus size={13} className="inline mr-1" /> This position was declared <strong>vacant</strong>.
                          </div>
                        ) : selected.selectedCandidateId ? (
                          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl p-3 mb-4 flex items-center gap-2">
                            <Crown size={14} weight="fill" className="text-amber-500" />
                            Winner: <strong>{(selected.selectedCandidateId as { studentId: { name: string } }).studentId?.name}</strong>
                          </div>
                        ) : null}

                        {/* Results */}
                        {detail.candidates.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Final Results</p>
                            {detail.candidates
                              .slice()
                              .sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0))
                              .map((c, idx) => {
                                const maxVotes = Math.max(...detail.candidates.map(x => x.voteCount ?? 0), 1);
                                const pct = ((c.voteCount ?? 0) / maxVotes) * 100;
                                const isWinner = selected.selectedCandidateId && (selected.selectedCandidateId as { _id: string })._id === c._id;
                                return (
                                  <div key={c._id} className={`border rounded-xl p-3 ${isWinner ? "border-amber-300 bg-amber-50/20" : "border-slate-200"}`}>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-300 w-5">#{idx + 1}</span>
                                        <div>
                                          <p className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                                            {c.studentId?.name}
                                            {isWinner && <Crown size={13} weight="fill" className="text-amber-500" />}
                                          </p>
                                          <p className="text-slate-400 text-xs">{c.studentId?.userId}</p>
                                        </div>
                                      </div>
                                      <span className="text-sm font-bold text-slate-700">{c.voteCount ?? 0} <span className="text-xs font-normal text-slate-400">votes</span></span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all ${isWinner ? "bg-amber-400" : "bg-indigo-300"}`} style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      <Modal isOpen={showApply} onClose={() => setShowApply(false)} title={`Apply — ${selected?.positionLabel}`} maxWidth="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Manifesto <span className="text-rose-400">*</span></label>
            <textarea
              rows={5}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="Describe your vision and why you're the right candidate..."
              value={applyForm.manifesto}
              onChange={e => setApplyForm(f => ({ ...f, manifesto: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">CGPA <span className="text-slate-400">(optional)</span></label>
            <input
              type="number"
              min="0" max="4" step="0.01"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="0.00 – 4.00"
              value={applyForm.cgpa}
              onChange={e => setApplyForm(f => ({ ...f, cgpa: e.target.value }))}
            />
            <p className="text-xs text-slate-400 mt-1">CGPA is only visible to the election committee for evaluation purposes.</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowApply(false)}>Cancel</Button>
          <Button isLoading={applying} onClick={applyNow}>Submit Application</Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
