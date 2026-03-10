"use client";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { GraduationCap, LockKey, CheckCircle } from "@phosphor-icons/react";

type Offering = {
  _id: string;
  courseId: { _id: string; code: string; title: string; credits: number };
  semesterLabel: string;
  academicYear: string;
  section: string;
};

type ResultWindow = {
  _id: string;
  semesterLabel: string;
  academicYear: string;
  isOpen: boolean;
};

type Student = {
  _id: string;
  name: string;
  userId: string;
};

type MarkRow = {
  studentId: string;
  studentName: string;
  userId: string;
  achievedMarks: number | "";
  totalMarks: number | "";
};

export default function TeacherResultsPage() {
  const { toast: addToast } = useToast();
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [openWindows, setOpenWindows] = useState<ResultWindow[]>([]);
  const [selected, setSelected] = useState<Offering | null>(null);
  const [activeWindow, setActiveWindow] = useState<ResultWindow | null>(null);
  const [rows, setRows] = useState<MarkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/sections?mine=true").then((r) => r.json()),
      fetch("/api/result-windows?isOpen=true").then((r) => r.json()),
    ]).then(([offerData, winData]) => {
      setOfferings(offerData.data ?? []);
      setOpenWindows(winData.data ?? []);
      setLoading(false);
    });
  }, []);

  async function selectOffering(o: Offering) {
    setSelected(o);
    setRows([]);
    setActiveWindow(null);
    setSavedOk(false);

    // Find a matching open window
    const win = openWindows.find(
      (w) => w.semesterLabel === o.semesterLabel && w.academicYear === o.academicYear
    ) ?? null;
    setActiveWindow(win);

    if (!win) return;

    setLoadingStudents(true);
    // Load enrolled students + existing mark entries in parallel
    const [enRes, entryRes] = await Promise.all([
      fetch(`/api/attendance?offeringId=${o._id}&students=true`),
      fetch(`/api/mark-entries?windowId=${win._id}&offeringId=${o._id}`),
    ]);
    const enData = await enRes.json();
    const entryData = await entryRes.json();

    const students: Student[] = (enData.data ?? []).map(
      (en: Record<string, unknown>) => {
        const s = en.studentId as Record<string, unknown>;
        return {
          _id: s._id as string,
          name: s.name as string,
          userId: s.userId as string,
        };
      }
    );

    const existingMap = new Map<
      string,
      { achievedMarks: number; totalMarks: number }
    >();
    for (const e of entryData.data ?? []) {
      const sid =
        typeof e.studentId === "object" ? e.studentId._id : e.studentId;
      existingMap.set(sid, {
        achievedMarks: e.achievedMarks,
        totalMarks: e.totalMarks,
      });
    }

    setRows(
      students.map((s) => {
        const existing = existingMap.get(s._id);
        return {
          studentId: s._id,
          studentName: s.name,
          userId: s.userId,
          achievedMarks: existing?.achievedMarks ?? "",
          totalMarks: existing?.totalMarks ?? "",
        };
      })
    );
    setLoadingStudents(false);
  }

  function updateRow(
    studentId: string,
    field: "achievedMarks" | "totalMarks",
    value: string
  ) {
    const num = value === "" ? "" : Number(value);
    setRows((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, [field]: num } : r))
    );
  }

  function getPercentage(row: MarkRow) {
    if (row.achievedMarks === "" || row.totalMarks === "" || row.totalMarks === 0)
      return null;
    return Math.min(
      100,
      Math.round(((row.achievedMarks as number) / (row.totalMarks as number)) * 100)
    );
  }

  async function handleSave() {
    if (!selected || !activeWindow) return;

    // Validate — all rows must have both fields
    const invalid = rows.some(
      (r) => r.achievedMarks === "" || r.totalMarks === "" || (r.totalMarks as number) <= 0
    );
    if (invalid) {
      addToast("Please fill in achieved and total marks for all students", "error");
      return;
    }

    setSaving(true);
    setSavedOk(false);
    try {
      const res = await fetch("/api/mark-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultWindowId: activeWindow._id,
          offeringId: selected._id,
          entries: rows.map((r) => ({
            studentId: r.studentId,
            achievedMarks: r.achievedMarks as number,
            totalMarks: r.totalMarks as number,
          })),
        }),
      });
      const d = await res.json();
      if (d.success) {
        setSavedOk(true);
        addToast("Marks saved successfully!", "success");
        // Reset saved indicator after 3 s
        setTimeout(() => setSavedOk(false), 3000);
      } else {
        addToast(d.error || "Failed to save marks", "error");
      }
    } catch (err) {
      console.error("handleSave error:", err);
      addToast("Network error — marks not saved", "error");
    } finally {
      setSaving(false);
    }
  }

  // Sections that have a matching open window
  const activeSections = offerings.filter((o) =>
    openWindows.some(
      (w) => w.semesterLabel === o.semesterLabel && w.academicYear === o.academicYear
    )
  );
  const otherSections = offerings.filter(
    (o) =>
      !openWindows.some(
        (w) => w.semesterLabel === o.semesterLabel && w.academicYear === o.academicYear
      )
  );

  return (
    <DashboardLayout role="teacher" title="Results" breadcrumb="Home / Results">
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left: course list */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            My Courses
          </h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : offerings.length === 0 ? (
            <p className="text-slate-400 text-sm">No courses assigned</p>
          ) : (
            <>
              {activeSections.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-emerald-600">
                    ● Window Open
                  </p>
                  {activeSections.map((o) => (
                    <button
                      key={o._id}
                      onClick={() => selectOffering(o)}
                      className={`w-full text-left rounded-2xl border p-4 transition ${
                        selected?._id === o._id
                          ? "border-indigo-400 bg-indigo-50"
                          : "border-emerald-200 bg-emerald-50/60 hover:border-indigo-200"
                      }`}
                    >
                      <p className="font-bold text-slate-800 text-sm">
                        {o.courseId.code}
                      </p>
                      <p className="text-slate-500 text-xs">{o.courseId.title}</p>
                      <p className="text-slate-400 text-xs mt-1">
                        Sem {o.semesterLabel} · {o.academicYear}
                      </p>
                    </button>
                  ))}
                </>
              )}
              {otherSections.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-slate-400 mt-2">
                    ● No Active Window
                  </p>
                  {otherSections.map((o) => (
                    <button
                      key={o._id}
                      onClick={() => selectOffering(o)}
                      className="w-full text-left rounded-2xl border border-slate-200 bg-white p-4 opacity-60 cursor-default"
                    >
                      <p className="font-bold text-slate-800 text-sm">
                        {o.courseId.code}
                      </p>
                      <p className="text-slate-500 text-xs">{o.courseId.title}</p>
                      <p className="text-slate-400 text-xs mt-1">
                        Sem {o.semesterLabel} · {o.academicYear}
                      </p>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Right: marks entry */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-300">
              <GraduationCap size={36} />
              <p className="text-sm">Select a course to enter marks</p>
            </div>
          ) : !activeWindow ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <LockKey size={24} className="text-slate-400" weight="fill" />
                </div>
                <p className="font-semibold text-slate-600">No active result window</p>
                <p className="text-slate-400 text-sm max-w-xs">
                  The admin has not opened a result window for Semester{" "}
                  {selected.semesterLabel} ({selected.academicYear}) yet. Check
                  back later.
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                  <h2 className="font-bold text-slate-700 text-base">
                    {selected.courseId.code} – Marks Entry
                  </h2>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {selected.courseId.title} · Sem {selected.semesterLabel} ·{" "}
                    {selected.academicYear}
                  </p>
                </div>
                <Badge variant="success">Window Open</Badge>
              </div>

              {loadingStudents ? (
                <div className="flex justify-center py-10">
                  <Spinner />
                </div>
              ) : rows.length === 0 ? (
                <EmptyState
                  icon={<GraduationCap size={32} />}
                  title="No students enrolled"
                />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-2 px-3 text-xs uppercase text-slate-400 font-semibold">
                            Student
                          </th>
                          <th className="text-left py-2 px-3 text-xs uppercase text-slate-400 font-semibold">
                            Achieved
                          </th>
                          <th className="text-left py-2 px-3 text-xs uppercase text-slate-400 font-semibold">
                            Total
                          </th>
                          <th className="text-left py-2 px-3 text-xs uppercase text-slate-400 font-semibold">
                            %
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const pct = getPercentage(row);
                          return (
                            <tr
                              key={row.studentId}
                              className="border-b border-slate-50"
                            >
                              <td className="py-2 px-3">
                                <p className="text-sm font-semibold text-slate-800">
                                  {row.studentName}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {row.userId}
                                </p>
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min={0}
                                  placeholder="e.g. 72"
                                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                  value={row.achievedMarks}
                                  onChange={(e) =>
                                    updateRow(
                                      row.studentId,
                                      "achievedMarks",
                                      e.target.value
                                    )
                                  }
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min={1}
                                  placeholder="e.g. 100"
                                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                  value={row.totalMarks}
                                  onChange={(e) =>
                                    updateRow(
                                      row.studentId,
                                      "totalMarks",
                                      e.target.value
                                    )
                                  }
                                />
                              </td>
                              <td className="py-2 px-3">
                                {pct !== null ? (
                                  <span
                                    className={`text-sm font-bold ${
                                      pct >= 80
                                        ? "text-emerald-600"
                                        : pct >= 60
                                        ? "text-amber-600"
                                        : "text-red-500"
                                    }`}
                                  >
                                    {pct}%
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-sm">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end items-center gap-3 mt-4">
                    {savedOk && (
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                        <CheckCircle size={16} weight="fill" /> Saved
                      </span>
                    )}
                    <Button
                      size="sm"
                      isLoading={saving}
                      onClick={handleSave}
                      variant={savedOk ? "outline" : "primary"}
                    >
                      <CheckCircle size={15} weight="bold" /> Save Marks
                    </Button>
                  </div>
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
