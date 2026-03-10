"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import {
  UserCheck,
  CheckCircle,
  Lightning,
  ClipboardText,
  Pencil,
  FloppyDisk,
} from "@phosphor-icons/react";

// ── Types ────────────────────────────────────────────────────────────────────

type Offering = {
  _id: string;
  courseId: { code: string; title: string };
  semesterLabel: string;
  section: string;
  plannedClasses: number;
};

type EnrollmentStudent = {
  _id: string;
  studentId: { _id: string; name: string; userId: string };
};

type AttendanceDay = {
  date: string;
  lectureNumber: number;
  records: { studentId: string; status: "present" | "absent" | "late" | "excused" }[];
};

type LiveStudent = {
  _id: string;
  name: string;
  userId: string;
  marked: boolean;
};

type LiveSession = {
  _id: string;
  code: string;
  date: string;
  lectureNumber: number;
  isOpen: boolean;
  students: LiveStudent[];
};

// ── Component ────────────────────────────────────────────────────────────────

export default function TeacherAttendancePage() {
  const { toast: addToast } = useToast();

  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selected, setSelected] = useState<Offering | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<EnrollmentStudent[]>([]);
  const [existing, setExisting] = useState<AttendanceDay[]>([]);
  const [activeTab, setActiveTab] = useState<"live" | "manual">("live");

  // Live session
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [startingSession, setStartingSession] = useState(false);
  const [closingSession, setClosingSession] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Planned classes editor
  const [editingPlanned, setEditingPlanned] = useState(false);
  const [plannedInput, setPlannedInput] = useState(40);
  const [savingPlanned, setSavingPlanned] = useState(false);

  // Manual attendance
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [attendance, setAttendance] = useState<
    Record<string, "present" | "absent" | "late" | "excused">
  >({});
  const [saving, setSaving] = useState(false);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sections?mine=true")
      .then((r) => r.json())
      .then((d) => { setOfferings(d.data ?? []); setLoading(false); });
  }, []);

  const pollLiveSession = useCallback(async (offeringId: string) => {
    const res = await fetch(`/api/attendance/session?offeringId=${offeringId}`);
    const d = await res.json();
    if (d.success) setLiveSession(d.data);
  }, []);

  useEffect(() => {
    if (liveSession && selected) {
      pollRef.current = setInterval(() => pollLiveSession(selected._id), 3000);
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [liveSession?._id, selected?._id, pollLiveSession]);

  async function selectOffering(o: Offering) {
    setSelected(o);
    setPlannedInput(o.plannedClasses ?? 40);
    setEditingPlanned(false);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setLiveSession(null);

    const [enRes, atRes, sessRes] = await Promise.all([
      fetch(`/api/attendance?offeringId=${o._id}&students=true`),
      fetch(`/api/attendance?offeringId=${o._id}`),
      fetch(`/api/attendance/session?offeringId=${o._id}`),
    ]);
    const [enData, atData, sessData] = await Promise.all([enRes.json(), atRes.json(), sessRes.json()]);

    const students: EnrollmentStudent[] = enData.data ?? [];
    setEnrollments(students);
    setExisting((atData.data ?? []).sort((a: AttendanceDay, b: AttendanceDay) => b.lectureNumber - a.lectureNumber));
    if (sessData.data) { setLiveSession(sessData.data); setActiveTab("live"); }

    const init: Record<string, "present"> = {};
    students.forEach((s) => { init[s.studentId._id] = "present"; });
    setAttendance(init);
  }

  async function savePlannedClasses() {
    if (!selected) return;
    setSavingPlanned(true);
    try {
      const res = await fetch(`/api/sections/${selected._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannedClasses: plannedInput }),
      });
      const d = await res.json();
      if (d.success) {
        setSelected((p) => p && { ...p, plannedClasses: plannedInput });
        setOfferings((prev) => prev.map((o) => o._id === selected._id ? { ...o, plannedClasses: plannedInput } : o));
        addToast("Total classes updated!", "success");
        setEditingPlanned(false);
      } else addToast(d.error || "Failed to update", "error");
    } finally { setSavingPlanned(false); }
  }

  async function startLiveSession() {
    if (!selected) return;
    setStartingSession(true);
    try {
      const res = await fetch("/api/attendance/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offeringId: selected._id, date: new Date().toISOString() }),
      });
      const d = await res.json();
      if (d.success) {
        await pollLiveSession(selected._id);
        addToast(`Session started! Code: ${d.data.code}`, "success");
      } else addToast(d.error || "Failed to start", "error");
    } finally { setStartingSession(false); }
  }

  async function closeSession() {
    if (!liveSession || !selected) return;
    setClosingSession(true);
    try {
      const res = await fetch("/api/attendance/session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: liveSession._id }),
      });
      const d = await res.json();
      if (d.success) {
        addToast(`Lecture #${d.lectureNumber} saved — ${d.presentCount}/${d.totalCount} present`, "success");
        setLiveSession(null);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        const atRes = await fetch(`/api/attendance?offeringId=${selected._id}`);
        const atData = await atRes.json();
        setExisting((atData.data ?? []).sort((a: AttendanceDay, b: AttendanceDay) => b.lectureNumber - a.lectureNumber));
      } else addToast(d.error || "Failed", "error");
    } finally { setClosingSession(false); }
  }

  function toggleStatus(studentId: string) {
    const order: ("present" | "absent" | "late" | "excused")[] = ["present", "absent", "late", "excused"];
    setAttendance((p) => {
      const cur = p[studentId] ?? "present";
      return { ...p, [studentId]: order[(order.indexOf(cur) + 1) % order.length] };
    });
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseOfferingId: selected._id, date,
          records: Object.entries(attendance).map(([studentId, status]) => ({ studentId, status })),
        }),
      });
      const d = await res.json();
      if (d.success) {
        addToast("Attendance saved!", "success");
        setExisting((p) => [d.data, ...p].sort((a, b) => b.lectureNumber - a.lectureNumber));
      } else addToast(d.error || "Failed", "error");
    } catch { addToast("Network error", "error"); }
    finally { setSaving(false); }
  }

  const statusColor: Record<string, string> = {
    present: "bg-emerald-100 text-emerald-700 border-emerald-200",
    absent:  "bg-rose-100 text-rose-700 border-rose-200",
    late:    "bg-yellow-100 text-yellow-700 border-yellow-200",
    excused: "bg-blue-100 text-blue-700 border-blue-200",
  };

  const markedCount = liveSession?.students.filter((s) => s.marked).length ?? 0;
  const totalCount  = liveSession?.students.length ?? 0;
  const markedPct   = totalCount > 0 ? (markedCount / totalCount) * 100 : 0;

  return (
    <DashboardLayout role="teacher" title="Attendance" breadcrumb="Home / Attendance">
      <div className="grid lg:grid-cols-3 gap-5">

        {/* ── Course List ──────────────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Select Course</h2>
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : offerings.map((o) => (
            <button key={o._id} onClick={() => selectOffering(o)}
              className={`w-full text-left rounded-2xl border p-4 transition ${selected?._id === o._id ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-200"}`}>
              <p className="font-bold text-slate-800 text-sm">{o.courseId.code}</p>
              <p className="text-slate-500 text-xs">{o.courseId.title}</p>
              <p className="text-slate-400 text-xs mt-1">Sem {o.semesterLabel}</p>
              <p className="text-indigo-400 text-xs mt-0.5">{o.plannedClasses ?? 40} planned classes</p>
            </button>
          ))}
        </div>

        {/* ── Main Panel ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="flex items-center justify-center h-48 text-slate-300 text-sm">Select a course</div>
          ) : (
            <Card>
              {/* Header */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <h2 className="font-bold text-slate-700 flex-1">{selected.courseId.code} – Attendance</h2>
                {editingPlanned ? (
                  <div className="flex items-center gap-2">
                    <input type="number" min={1} max={200}
                      className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      value={plannedInput} onChange={(e) => setPlannedInput(Number(e.target.value))} />
                    <Button size="sm" isLoading={savingPlanned} onClick={savePlannedClasses}>
                      <FloppyDisk size={14} /> Save
                    </Button>
                    <button onClick={() => setEditingPlanned(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setEditingPlanned(true)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 border border-slate-200 rounded-xl px-3 py-1.5 transition">
                    <Pencil size={12} /> {selected.plannedClasses ?? 40} total classes
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 w-fit">
                <button onClick={() => setActiveTab("live")}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${activeTab === "live" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  <Lightning size={14} weight={liveSession ? "fill" : "regular"} />
                  Live Session
                  {liveSession && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                </button>
                <button onClick={() => setActiveTab("manual")}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${activeTab === "manual" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  <ClipboardText size={14} /> Manual Entry
                </button>
              </div>

              {/* ─── LIVE SESSION TAB ────────────────────────────────── */}
              {activeTab === "live" && (
                <div>
                  {!liveSession ? (
                    <div className="text-center py-10 space-y-4">
                      <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mx-auto">
                        <Lightning size={28} className="text-indigo-400" />
                      </div>
                      <p className="text-slate-600 font-medium">No active session</p>
                      <p className="text-slate-400 text-xs max-w-xs mx-auto">
                        Start a session and students enter the code on their attendance page.
                        Their attendance is recorded live as they submit.
                      </p>
                      <Button onClick={startLiveSession} isLoading={startingSession}>
                        <Lightning size={16} /> Start Live Session
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Big code display */}
                      <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 text-center">
                        <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">
                          Attendance Code — Lecture #{liveSession.lectureNumber}
                        </p>
                        <p className="text-6xl font-black text-indigo-700 tracking-[0.35em] font-mono select-all">
                          {liveSession.code}
                        </p>
                        <p className="text-xs text-indigo-400 mt-3">
                          Tell students to enter this code on their attendance page
                        </p>
                      </div>

                      {/* Progress */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-slate-600">{markedCount} / {totalCount} marked present</span>
                          <span className="text-slate-400 text-xs">auto-refreshes every 3 s</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                            style={{ width: `${markedPct}%` }} />
                        </div>
                      </div>

                      {/* Student grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                        {liveSession.students.map((s) => (
                          <div key={s._id}
                            className={`rounded-xl border px-3 py-2.5 transition-all ${s.marked ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-400"}`}>
                            <p className="text-xs font-bold truncate">{s.userId}</p>
                            <p className="text-xs truncate opacity-80">{s.name}</p>
                            {s.marked && <CheckCircle size={13} className="text-emerald-500 mt-1" weight="fill" />}
                          </div>
                        ))}
                      </div>

                      {/* Close button */}
                      <div className="flex justify-end pt-2 border-t border-slate-100">
                        <Button variant="danger" isLoading={closingSession} onClick={closeSession}>
                          Close & Save Session
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── MANUAL ENTRY TAB ────────────────────────────────── */}
              {activeTab === "manual" && (
                <div>
                  {enrollments.length === 0 ? (
                    <EmptyState icon={<UserCheck size={32} />} title="No students" description="No students enrolled in this course." />
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-3 mb-4">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-500 font-medium">Date</label>
                          <input type="date"
                            className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            value={date} onChange={(e) => setDate(e.target.value)} />
                        </div>
                        <p className="text-xs text-slate-400 self-center">Lecture # is assigned automatically.</p>
                      </div>
                      <div className="flex gap-3 mb-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />Present</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />Absent</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />Late</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />Excused</span>
                        <span className="ml-auto italic">(click to cycle)</span>
                      </div>
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {enrollments.map((en) => {
                          const s = en.studentId;
                          const status = attendance[s._id] ?? "present";
                          return (
                            <div key={s._id}
                              className={`flex items-center justify-between border rounded-xl px-4 py-2.5 cursor-pointer transition ${statusColor[status]}`}
                              onClick={() => toggleStatus(s._id)}>
                              <div>
                                <span className="font-semibold text-sm">{s.name}</span>
                                <span className="text-xs ml-2 opacity-70">{s.userId}</span>
                              </div>
                              <span className="text-xs font-bold capitalize">{status}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-end mt-4">
                        <Button isLoading={saving} onClick={handleSave}>Save Attendance</Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Previous sessions */}
              {existing.length > 0 && (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-3">Attendance History ({existing.length} sessions)</p>
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {[...existing].map((a, i) => {
                      const present = a.records.filter((r) => r.status === "present").length;
                      const late = a.records.filter((r) => r.status === "late").length;
                      const total = a.records.length;
                      const key = `${a.date}-${a.lectureNumber}-${i}`;
                      const isOpen = expandedRecord === key;
                      const statusDot: Record<string, string> = {
                        present: "bg-emerald-400",
                        absent: "bg-rose-400",
                        late: "bg-yellow-400",
                        excused: "bg-blue-400",
                      };
                      return (
                        <div key={key} className="border border-slate-100 rounded-xl overflow-hidden">
                          <button
                            className="w-full flex items-center justify-between text-xs text-slate-600 px-3 py-2.5 hover:bg-slate-50 transition"
                            onClick={() => setExpandedRecord(isOpen ? null : key)}
                          >
                            <span className="font-semibold">
                              Lecture #{a.lectureNumber}
                              <span className="text-slate-400 font-normal ml-2">{a.date.slice(0, 10)}</span>
                            </span>
                            <span className="flex items-center gap-3">
                              <span className="font-medium text-emerald-600">{present + late}/{total} present</span>
                              <span className="text-slate-300">{isOpen ? "▴" : "▾"}</span>
                            </span>
                          </button>
                          {isOpen && (
                            <div className="px-3 pb-3 bg-slate-50/60 flex flex-wrap gap-1.5">
                              {a.records.map((r: { studentId: string; status: string }) => {
                                const en = enrollments.find((e) => e.studentId._id === r.studentId);
                                const name = en?.studentId?.userId ?? r.studentId.slice(-4);
                                return (
                                  <span key={r.studentId} className={`inline-flex items-center gap-1 text-xs border rounded-lg px-2 py-0.5 bg-white`}>
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot[r.status] ?? "bg-slate-300"}`} />
                                    {name}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
