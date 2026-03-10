"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Trophy, Plus, Trash, Check, X, ArrowRight, Crown, Minus, LockSimple } from "@phosphor-icons/react";

type Candidate = {
  _id: string;
  studentId: { _id: string; name: string; userId: string };
  manifesto: string;
  cgpa?: number;
  status: "pending" | "approved" | "rejected";
  voteCount: number;
  createdAt: string;
};

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

const SEMESTERS = ["1-1","1-2","2-1","2-2","3-1","3-2","4-1","4-2"];
const FULL_DEPT = "Full Department";

const STATUS_META: Record<string, { label: string; next: string; color: string }> = {
  draft:             { label: "Draft",              next: "Open Applications", color: "bg-slate-100 text-slate-500" },
  applications_open: { label: "Applications Open",  next: "Start Voting",      color: "bg-blue-50 text-blue-600" },
  voting:            { label: "Voting in Progress", next: "End Voting",        color: "bg-amber-50 text-amber-600" },
  completed:         { label: "Completed",          next: "",                  color: "bg-emerald-50 text-emerald-700" },
};

function sessionBadge(s?: string) {
  return s === FULL_DEPT
    ? "bg-purple-100 text-purple-700"
    : "bg-indigo-100 text-indigo-700";
}

export default function TeacherElectionsPage() {
  const { data: session } = useSession();
  const { toast: addToast } = useToast();

  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Position | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candLoading, setCandLoading] = useState(false);
  const [isHead, setIsHead] = useState(false);
  const [headLoading, setHeadLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ positionLabel: "", session: "", academicYear: "" });
  const [creating, setCreating] = useState(false);
  const [sessions, setSessions] = useState<{ _id: string; year: string }[]>([]);

  useEffect(() => {
    fetch("/api/sessions").then(r => r.json()).then(d => setSessions(d.data ?? []));
  }, []);

  const [actionLoading, setActionLoading] = useState("");

  const fetchPositions = useCallback(async () => {
    const res = await fetch("/api/elections");
    const d = await res.json();
    setPositions(d.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPositions(); }, [fetchPositions]);

  // Check if this teacher is the dept head
  useEffect(() => {
    async function checkHead() {
      const deptId = session?.user?.departmentId;
      if (!deptId) { setIsHead(false); setHeadLoading(false); return; }
      const res = await fetch(`/api/departments/${deptId}`);
      const d = await res.json();
      const head = d.data?.headId;
      const headId = typeof head === "object" ? head?._id : head;
      setIsHead(headId === session?.user?.id);
      setHeadLoading(false);
    }
    if (session) checkHead();
  }, [session]);

  function closeCreate() {
    setShowCreate(false);
    setForm({ positionLabel: "", session: "", academicYear: "" });
  }

  async function loadCandidates(pos: Position) {
    setSelected(pos);
    setCandLoading(true);
    const res = await fetch(`/api/elections/${pos._id}/candidates`);
    const d = await res.json();
    setCandidates(d.data?.candidates ?? []);
    setCandLoading(false);
  }

  async function advance(posId: string) {
    setActionLoading("advance");
    const res = await fetch(`/api/elections/${posId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance" }),
    });
    const d = await res.json();
    if (d.success) {
      let updatedPos = { ...positions.find(p => p._id === posId)!, status: d.status as Position["status"] };
      // Auto-winner when voting ends
      if (d.status === "completed" && d.winnerId) {
        const winner = candidates.find(c => c._id === d.winnerId);
        if (winner) updatedPos = { ...updatedPos, selectedCandidateId: { _id: winner._id, studentId: winner.studentId } };
      }
      setPositions(prev => prev.map(p => p._id === posId ? updatedPos : p));
      setSelected(prev => prev?._id === posId ? updatedPos : prev);
      addToast(d.status === "completed" ? (d.winnerId ? "Voting ended — winner declared!" : "Voting ended — no votes cast") : "Status updated!", "success");
    } else addToast(d.error || "Failed", "error");
    setActionLoading("");
  }

  async function reviewCandidate(candidateId: string, action: "approve" | "reject") {
    setActionLoading(candidateId);
    const res = await fetch(`/api/elections/${selected!._id}/candidates`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, candidateId }),
    });
    const d = await res.json();
    if (d.success) {
      setCandidates(prev => prev.map(c => c._id === candidateId ? { ...c, status: action === "approve" ? "approved" : "rejected" } : c));
      addToast(`Application ${action}d!`, "success");
    } else addToast(d.error || "Failed", "error");
    setActionLoading("");
  }

  async function selectWinner(candidateId: string) {
    setActionLoading("select_" + candidateId);
    const res = await fetch(`/api/elections/${selected!._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "select_winner", candidateId }),
    });
    const d = await res.json();
    if (d.success) {
      const winner = candidates.find(c => c._id === candidateId);
      const updatedPos = {
        ...selected!,
        isEmpty: false,
        selectedCandidateId: winner ? { _id: winner._id, studentId: winner.studentId } : selected!.selectedCandidateId,
      };
      setSelected(updatedPos);
      setPositions(prev => prev.map(p => p._id === selected!._id ? updatedPos : p));
      addToast("Winner selected!", "success");
    } else addToast(d.error || "Failed", "error");
    setActionLoading("");
  }

  async function markEmpty() {
    setActionLoading("empty");
    const res = await fetch(`/api/elections/${selected!._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_empty" }),
    });
    const d = await res.json();
    if (d.success) {
      const updatedPos = { ...selected!, isEmpty: true, selectedCandidateId: null };
      setSelected(updatedPos);
      setPositions(prev => prev.map(p => p._id === selected!._id ? updatedPos : p));
      addToast("Position marked as vacant", "success");
    } else addToast(d.error || "Failed", "error");
    setActionLoading("");
  }

  async function deletePosition(posId: string) {
    if (!confirm("Delete this position and all its applications? This cannot be undone.")) return;
    const res = await fetch(`/api/elections/${posId}`, { method: "DELETE" });
    const d = await res.json();
    if (d.success) {
      setPositions(prev => prev.filter(p => p._id !== posId));
      if (selected?._id === posId) { setSelected(null); setCandidates([]); }
      addToast("Position deleted", "success");
    } else addToast(d.error || "Failed", "error");
  }

  async function deleteAll() {
    if (!confirm("Delete ALL positions and their candidates/votes for your department? This cannot be undone.")) return;
    const res = await fetch("/api/elections", { method: "DELETE" });
    const d = await res.json();
    if (d.success) {
      setPositions([]);
      setSelected(null);
      setCandidates([]);
      addToast(`All ${d.deleted} position(s) deleted`, "success");
    } else addToast(d.error || "Failed", "error");
  }

  async function createPosition() {
    if (!form.positionLabel.trim()) { addToast("Position name is required", "error"); return; }
    if (!form.session) { addToast("Please select a session scope", "error"); return; }
    // Require academicYear for semester-specific positions
    if (form.session !== FULL_DEPT && !form.academicYear) {
      addToast("Please select an academic year for this semester position", "error"); return;
    }
    setCreating(true);
    const res = await fetch("/api/elections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        positionType: form.positionLabel.trim(),
        positionLabel: form.positionLabel.trim(),
        session: form.session,
        academicYear: form.session !== FULL_DEPT ? form.academicYear : undefined,
      }),
    });
    const d = await res.json();
    if (d.success) {
      addToast("Position created!", "success");
      closeCreate();
      fetchPositions();
    } else addToast(d.error || "Failed", "error");
    setCreating(false);
  }

  const statusInfo = selected ? STATUS_META[selected.status] : null;
  const pending  = candidates.filter(c => c.status === "pending");
  const approved = candidates.filter(c => c.status === "approved");
  const rejected = candidates.filter(c => c.status === "rejected");

  return (
    <DashboardLayout role="teacher" title="Elections" breadcrumb="Home / Elections">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="font-bold text-slate-800">Election Management</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isHead
                ? "Manage positions, review applications, and declare results for your department"
                : "View ongoing elections and results for your department"}
            </p>
          </div>
          {isHead && (
            <div className="flex gap-2">
              {positions.length > 0 && (
                <Button variant="danger-soft" onClick={deleteAll}><Trash size={15} className="mr-1" />Delete All</Button>
              )}
              <Button onClick={() => setShowCreate(true)}><Plus size={15} className="mr-1" />Create Position</Button>
            </div>
          )}
        </div>

        {!session?.user?.departmentId && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3 mb-5">
            You are not assigned to a department. Please contact the administrator.
          </div>
        )}

        {/* Read-only notice for non-head teachers */}
        {!headLoading && !isHead && session?.user?.departmentId && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-600 text-sm rounded-xl px-4 py-3 mb-5">
            <LockSimple size={16} className="text-slate-400 shrink-0" />
            <span>You can view elections and their results. Only the <strong>department head</strong> can create, manage, and advance elections.</span>
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-5">
          {/* Left: position list */}
          <div className="lg:col-span-2 space-y-2">
            {loading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : positions.length === 0 ? (
              <EmptyState icon={<Trophy size={32} />} title="No positions yet" description="Create your first election position." />
            ) : positions.map((pos) => (
              <div key={pos._id} className={`relative group rounded-2xl border transition ${selected?._id === pos._id ? "border-indigo-400 bg-indigo-50/60" : "border-slate-200 bg-white hover:border-indigo-200"}`}>
                <button className="w-full text-left p-4" onClick={() => loadCandidates(pos)}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sessionBadge(pos.session)}`}>
                      {pos.session ?? "—"}{pos.academicYear ? ` · ${pos.academicYear}` : ""}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_META[pos.status]?.color}`}>
                      {STATUS_META[pos.status]?.label}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-800 text-sm truncate">{pos.positionLabel}</p>
                  {pos.isEmpty && <p className="text-xs text-rose-400 mt-0.5">Marked Vacant</p>}
                  {!pos.isEmpty && pos.selectedCandidateId && (
                    <p className="text-xs text-emerald-600 mt-0.5">✓ {(pos.selectedCandidateId as { studentId: { name: string } }).studentId?.name}</p>
                  )}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); deletePosition(pos._id); }}
                  className={`absolute top-3 right-3 p-1 rounded-lg transition text-slate-300 hover:text-rose-500 hover:bg-rose-50 ${isHead ? "opacity-0 group-hover:opacity-100" : "hidden"}`}
                  title="Delete position">
                  <Trash size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Right: detail panel */}
          <div className="lg:col-span-3">
            {!selected ? (
              <div className="flex items-center justify-center h-64 text-slate-300 text-sm border border-dashed border-slate-200 rounded-2xl">
                Select a position to manage
              </div>
            ) : (
              <Card>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sessionBadge(selected.session)}`}>
                        {selected.session ?? "—"}{selected.academicYear ? ` · ${selected.academicYear}` : ""}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusInfo?.color}`}>
                        {statusInfo?.label}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg">{selected.positionLabel}</h3>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {isHead && statusInfo?.next && (
                      <Button size="sm" isLoading={actionLoading === "advance"} onClick={() => advance(selected._id)}>
                        {statusInfo.next} <ArrowRight size={13} className="ml-1" />
                      </Button>
                    )}
                    {isHead && (
                      <button onClick={() => deletePosition(selected._id)}
                        className="p-2 rounded-xl hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition"
                        title="Delete position">
                        <Trash size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Winner section (completed) */}
                {selected.status === "completed" && (
                  <div className={`rounded-xl p-3 mb-4 text-sm ${selected.selectedCandidateId ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50 border border-slate-200"}`}>
                    {selected.selectedCandidateId ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                        <Crown size={14} weight="fill" /> Winner: <strong>{(selected.selectedCandidateId as { studentId: { name: string } }).studentId?.name}</strong>
                        <span className="text-emerald-500 font-normal text-xs ml-1">(auto-selected by votes)</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Minus size={14} /> No winner — no votes were cast
                      </span>
                    )}
                  </div>
                )}

                {/* Candidates */}
                {candLoading ? (
                  <div className="flex justify-center py-10"><Spinner /></div>
                ) : candidates.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">
                    {selected.status === "draft" ? "Open applications to start receiving candidates." : "No applications received."}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* Pending */}
                    {pending.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Pending Review ({pending.length})</p>
                        <div className="space-y-2">
                          {pending.map(c => (
                            <div key={c._id} className="border border-amber-200 bg-amber-50/30 rounded-xl p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-slate-800 text-sm">{c.studentId?.name}</p>
                                  <p className="text-slate-400 text-xs">{c.studentId?.userId}{c.cgpa !== undefined ? ` · CGPA: ${c.cgpa}` : ""}</p>
                                  <p className="text-slate-600 text-sm mt-1.5 line-clamp-3">{c.manifesto}</p>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                  {isHead && (
                                    <>
                                      <Button size="sm" isLoading={actionLoading === c._id} onClick={() => reviewCandidate(c._id, "approve")}>
                                        <Check size={12} className="mr-1" />Approve
                                      </Button>
                                      <Button size="sm" variant="danger-soft" isLoading={actionLoading === c._id} onClick={() => reviewCandidate(c._id, "reject")}>
                                        <X size={12} className="mr-1" />Reject
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Approved */}
                    {approved.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Approved Candidates ({approved.length})</p>
                        <div className="space-y-2">
                          {approved.map(c => {
                            const maxVotes = Math.max(...approved.map(x => x.voteCount ?? 0), 1);
                            const pct = ((c.voteCount ?? 0) / maxVotes) * 100;
                            const isWinner = selected.selectedCandidateId && (selected.selectedCandidateId as { _id: string })._id === c._id;
                            return (
                              <div key={c._id} className={`border rounded-xl p-3 ${isWinner ? "border-emerald-300 bg-emerald-50/30" : "border-slate-200"}`}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-slate-800 text-sm">{c.studentId?.name}</p>
                                      {isWinner && <Crown size={13} className="text-amber-500" weight="fill" />}
                                    </div>
                                    <p className="text-slate-400 text-xs">{c.studentId?.userId}{c.cgpa !== undefined ? ` · CGPA: ${c.cgpa}` : ""}</p>
                                    <p className="text-slate-600 text-sm mt-1 line-clamp-2">{c.manifesto}</p>
                                    {(selected.status === "voting" || selected.status === "completed") && (
                                      <div className="mt-2">
                                        <div className="flex items-center gap-2 mb-1">
                                          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                          </div>
                                          <span className="text-xs font-semibold text-slate-600 w-16 text-right">{c.voteCount ?? 0} votes</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Rejected */}
                    {rejected.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Rejected ({rejected.length})</p>
                        <div className="space-y-2">
                          {rejected.map(c => (
                            <div key={c._id} className="border border-slate-200 rounded-xl p-3 opacity-60">
                              <p className="font-semibold text-slate-700 text-sm">{c.studentId?.name}</p>
                              <p className="text-slate-400 text-xs">{c.studentId?.userId}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Create Position Modal */}
      <Modal isOpen={showCreate} onClose={closeCreate} title="Create Election Position" maxWidth="sm">
        <div className="space-y-4">
          {/* Position name — fully free text */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Position Name <span className="text-rose-400">*</span>
            </label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="e.g. Class Representative, General Secretary, Cultural Secretary…"
              value={form.positionLabel}
              onChange={e => setForm(f => ({ ...f, positionLabel: e.target.value }))}
            />
          </div>

          {/* Session scope — dropdown */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Session / Scope <span className="text-rose-400">*</span>
            </label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              value={form.session}
              onChange={e => setForm(f => ({ ...f, session: e.target.value, academicYear: "" }))}
            >
              <option value="">— Select a scope —</option>
              <option value={FULL_DEPT}>🌐 Full Department</option>
              <optgroup label="Semester">
                {SEMESTERS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </optgroup>
            </select>
            <p className="text-xs text-slate-400 mt-1.5">
              {form.session === FULL_DEPT
                ? "All students in the department can apply and vote."
                : form.session
                  ? `Only semester ${form.session} students can apply and vote.`
                  : "Choose \"Full Department\" for GS/AGS; pick a semester for CR-level positions."}
            </p>
          </div>

          {/* Academic Year — only shown for semester-specific positions */}
          {form.session && form.session !== FULL_DEPT && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Academic Year <span className="text-rose-400">*</span>
              </label>
              <select
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                value={form.academicYear}
                onChange={e => setForm(f => ({ ...f, academicYear: e.target.value }))}
              >
                <option value="">— Select academic year —</option>
                {sessions.map(s => (
                  <option key={s._id} value={s.year}>{s.year}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1.5">
                Only students enrolled in <strong>Sem {form.session}</strong> of <strong>{form.academicYear || "…"}</strong> will be eligible.
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={closeCreate}>Cancel</Button>
          <Button isLoading={creating} onClick={createPosition}>Create Position</Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
