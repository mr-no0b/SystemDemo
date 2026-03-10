"use client";
import { useState, useEffect, useRef } from "react";
import { Fragment } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { CheckCircle, Lightning, CaretDown, CaretUp } from "@phosphor-icons/react";

// ── Types ─────────────────────────────────────────────────────────────────────

type CourseSummary = {
  present: number;
  total: number;
  plannedClasses: number;
  code: string;
  title: string;
  teacher: string;
  lectures: { lectureNumber: number; date: string; status: string }[];
};

type OpenSession = {
  sessionId: string;
  offeringId: string;
  alreadyMarked: boolean;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudentAttendancePage() {
  const { toast: addToast } = useToast();
  const [summaries, setSummaries] = useState<Record<string, CourseSummary>>({});
  const [openSessions, setOpenSessions] = useState<OpenSession[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [marking, setMarking] = useState<Record<string, boolean>>({});
  const [markedOk, setMarkedOk] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [expandedOffering, setExpandedOffering] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadSummaries();
    pollSessions();
    pollRef.current = setInterval(pollSessions, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSummaries() {
    const res = await fetch("/api/attendance");
    const d = await res.json();
    setSummaries(d.data ?? {});
    setLoading(false);
  }

  async function pollSessions() {
    const res = await fetch("/api/attendance/session?studentView=true");
    const d = await res.json();
    setOpenSessions(d.data ?? []);
  }

  async function markAttendance(offeringId: string) {
    const session = openSessions.find((s) => s.offeringId === offeringId);
    if (!session) return;
    const code = (codes[offeringId] ?? "").toUpperCase().trim();
    if (!code) { addToast("Enter the attendance code first", "error"); return; }

    setMarking((p) => ({ ...p, [offeringId]: true }));
    try {
      const res = await fetch("/api/attendance/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId, code }),
      });
      const d = await res.json();
      if (d.success) {
        addToast("✓ Attendance marked!", "success");
        setMarkedOk((p) => ({ ...p, [offeringId]: true }));
        setOpenSessions((prev) =>
          prev.map((s) => s.offeringId === offeringId ? { ...s, alreadyMarked: true } : s)
        );
        // Refresh percentage
        const attRes = await fetch("/api/attendance");
        const attData = await attRes.json();
        setSummaries(attData.data ?? {});
      } else {
        addToast(d.error || "Invalid code — try again", "error");
      }
    } catch { addToast("Network error", "error"); }
    finally { setMarking((p) => ({ ...p, [offeringId]: false })); }
  }

  const entries = Object.entries(summaries);

  return (
    <DashboardLayout role="student" title="Attendance" breadcrumb="Home / Attendance">
      <div className="max-w-3xl mx-auto space-y-4">

        {/* Warning banner */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          ⚠ Minimum 65% attendance required to sit for final exams. Warning issued below 70%.
        </div>

        {/* ── Live Session Alert ──────────────────────────────────────── */}
        {openSessions.length > 0 && (
          <div className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded-2xl">
            <div className="flex items-center gap-2 mb-1">
              <Lightning size={18} weight="fill" className="text-indigo-500" />
              <span className="font-bold text-indigo-700 text-sm">Live Attendance Session Active</span>
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            </div>
            <p className="text-xs text-indigo-500 mb-4">
              Ask your teacher for the code and enter it below to mark your attendance.
            </p>
            <div className="space-y-3">
              {openSessions.map((os) => {
                const course = summaries[os.offeringId];
                const isMarked = os.alreadyMarked || markedOk[os.offeringId];
                return (
                  <div key={os.offeringId} className="bg-white border border-indigo-100 rounded-xl p-3">
                    <p className="text-sm font-semibold text-slate-700 mb-2">
                      {course?.code ?? "Course"}{course?.title ? ` – ${course.title}` : ""}{course?.teacher ? ` (${course.teacher})` : ""}
                    </p>
                    {isMarked ? (
                      <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium py-1">
                        <CheckCircle size={18} weight="fill" />
                        Attendance marked successfully!
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="Enter 6-char code"
                          className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono uppercase tracking-widest flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          value={codes[os.offeringId] ?? ""}
                          onChange={(e) =>
                            setCodes((p) => ({ ...p, [os.offeringId]: e.target.value.toUpperCase() }))
                          }
                          onKeyDown={(e) => { if (e.key === "Enter") markAttendance(os.offeringId); }}
                        />
                        <Button
                          size="sm"
                          isLoading={marking[os.offeringId]}
                          onClick={() => markAttendance(os.offeringId)}
                        >
                          Mark Attendance
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Attendance Table ────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2.5 px-4 text-xs uppercase text-slate-400 font-semibold">Course</th>
                    <th className="text-left py-2.5 px-4 text-xs uppercase text-slate-400 font-semibold">Teacher</th>
                    <th className="text-left py-2.5 px-4 text-xs uppercase text-slate-400 font-semibold">Attended / Planned</th>
                    <th className="text-left py-2.5 px-4 text-xs uppercase text-slate-400 font-semibold">Percentage</th>
                    <th className="text-left py-2.5 px-4 text-xs uppercase text-slate-400 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                        No attendance records yet
                      </td>
                    </tr>
                  ) : (
                    entries.map(([oid, s]) => {
                      const pct =
                        s.plannedClasses > 0
                          ? Math.round((s.present / s.plannedClasses) * 100)
                          : 0;
                      const isExpanded = expandedOffering === oid;
                      const statusColor: Record<string, string> = {
                        present: "text-emerald-600",
                        late: "text-amber-500",
                        absent: "text-rose-500",
                        excused: "text-blue-500",
                      };
                      return (
                        <Fragment key={oid}>
                          <tr
                            className="border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer select-none"
                            onClick={() => setExpandedOffering(isExpanded ? null : oid)}
                          >
                            <td className="py-3.5 px-4">
                              <span className="font-semibold text-sm text-slate-700">{s.code}</span>
                              <span className="text-xs text-slate-400 ml-2">{s.title}</span>
                            </td>
                            <td className="py-3.5 px-4 text-sm text-slate-500">{s.teacher || "—"}</td>
                            <td className="py-3.5 px-4 text-sm text-slate-600">
                              {s.present}
                              <span className="text-slate-400"> / {s.plannedClasses}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${pct < 65 ? "bg-red-500" : pct < 70 ? "bg-amber-400" : "bg-emerald-500"}`}
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-sm font-bold ${pct < 65 ? "text-red-500" : pct < 70 ? "text-amber-500" : "text-emerald-600"}`}>
                                  {pct}%
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center justify-between">
                                <Badge variant={pct < 65 ? "danger" : pct < 70 ? "warning" : "success"}>
                                  {pct < 65 ? "Critical" : pct < 70 ? "Warning" : "Good"}
                                </Badge>
                                <span className="text-slate-300 ml-2">
                                  {isExpanded ? <CaretUp size={13} /> : <CaretDown size={13} />}
                                </span>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/60">
                              <td colSpan={5} className="px-4 pb-3 pt-2">
                                {s.lectures.length === 0 ? (
                                  <p className="text-xs text-slate-400 italic py-1">No lecture records yet.</p>
                                ) : (
                                  <div className="flex flex-wrap gap-2 py-1">
                                    {s.lectures.map((l) => (
                                      <div
                                        key={l.lectureNumber}
                                        className="flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1 bg-white"
                                      >
                                        <span className="font-bold text-slate-500">#{l.lectureNumber}</span>
                                        <span className="text-slate-300">·</span>
                                        <span className="text-slate-400">{new Date(l.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                                        <span className="text-slate-300">·</span>
                                        <span className={`font-semibold capitalize ${statusColor[l.status] ?? "text-slate-500"}`}>{l.status}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
