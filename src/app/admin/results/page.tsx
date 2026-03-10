"use client";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  Trophy,
  Plus,
  LockKey,
  CheckCircle,
  Warning,
  Trash,
} from "@phosphor-icons/react";
import { SEMESTERS } from "@/types";

type ResultWindow = {
  _id: string;
  semesterLabel: string;
  academicYear: string;
  isOpen: boolean;
  openedBy?: { name: string };
  openedAt: string;
  closedAt?: string;
  publishedCount?: number;
  entryCount?: number;
};

type SessionItem = { _id: string; year: string; isActive: boolean };

type OfferingStatus = {
  offeringId: string;
  courseCode: string;
  courseTitle: string;
  teacherName: string;
  enrolledCount: number;
  submittedCount: number;
};

type TeacherStatus = {
  teacherName: string;
  courses: OfferingStatus[];
};

const defaultForm = { semesterLabel: "", academicYear: "" };

export default function AdminResultsPage() {
  const { toast: addToast } = useToast();
  const [windows, setWindows] = useState<ResultWindow[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<ResultWindow | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<TeacherStatus[]>([]);

  const fetchWindows = async () => {
    const res = await fetch("/api/result-windows");
    const d = await res.json();
    setWindows(d.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchWindows();
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((d) => setSessions(d.data ?? []))
      .catch(() => setSessions([]));
  }, []);

  async function handleCreate() {
    if (!form.semesterLabel) {
      addToast("Please select a semester", "error");
      return;
    }
    if (!form.academicYear) {
      addToast("Please select a session", "error");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/result-windows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ semesterLabel: form.semesterLabel, academicYear: form.academicYear }),
    });
    const d = await res.json();
    if (d.success) {
      addToast("Result window opened!", "success");
      setShowModal(false);
      setForm(defaultForm);
      fetchWindows();
    } else {
      addToast(d.error || "Failed", "error");
    }
    setSubmitting(false);
  }

  async function openConfirmClose(w: ResultWindow) {
    setConfirmClose(w);
    setStatusLoading(true);
    setSubmissionStatus([]);
    try {
      const res = await fetch(`/api/result-windows/${w._id}`);
      const d = await res.json();
      setSubmissionStatus(d.data ?? []);
    } catch {
      setSubmissionStatus([]);
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleClose(w: ResultWindow) {
    setClosing(w._id);
    const res = await fetch(`/api/result-windows/${w._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    const d = await res.json();
    if (d.success) {
      addToast(
        `Window closed. ${d.published} result${d.published !== 1 ? "s" : ""} published to students.`,
        "success"
      );
      fetchWindows();
    } else {
      addToast(d.error || "Failed to close window", "error");
    }
    setClosing(null);
    setConfirmClose(null);
  }

  async function handleDeleteWindow(w: ResultWindow) {
    if (!confirm(`Delete the closed result window for Semester ${w.semesterLabel} (${w.academicYear})? The published student results will NOT be affected. This cannot be undone.`)) return;
    setDeleting(w._id);
    const res = await fetch(`/api/result-windows/${w._id}`, { method: "DELETE" });
    const d = await res.json();
    if (d.success) {
      addToast("Window deleted.", "success");
      fetchWindows();
    } else addToast(d.error || "Failed to delete", "error");
    setDeleting(null);
  }

  return (
    <DashboardLayout role="admin" title="Results" breadcrumb="Home / Results">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Result Windows</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Open a window so teachers can submit marks. Close it to auto-publish results to students.
            </p>
          </div>
          <Button
            onClick={() => { setForm(defaultForm); setShowModal(true); }}
            size="sm"
          >
            <Plus size={16} weight="bold" /> Open Window
          </Button>
        </div>

        {/* Windows list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : windows.length === 0 ? (
          <EmptyState
            icon={<Trophy size={36} />}
            title="No result windows yet"
            description="Open a result window to allow teachers to submit student marks."
          />
        ) : (
          <div className="space-y-3">
            {windows.map((w) => (
              <Card key={w._id}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Status icon */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      w.isOpen ? "bg-emerald-100" : "bg-slate-100"
                    }`}
                  >
                    {w.isOpen ? (
                      <CheckCircle size={22} className="text-emerald-600" weight="fill" />
                    ) : (
                      <LockKey size={22} className="text-slate-400" weight="fill" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">
                        Semester {w.semesterLabel}
                      </span>
                      <span className="text-slate-400 text-xs">·</span>
                      <span className="text-slate-500 text-xs">{w.academicYear}</span>
                      <Badge variant={w.isOpen ? "success" : "gray"} className="ml-1">
                        {w.isOpen ? "Open" : "Closed"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      <p className="text-slate-400 text-xs">
                        Opened by {w.openedBy?.name ?? "Admin"} ·{" "}
                        {new Date(w.openedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      {!w.isOpen && w.closedAt && (
                        <p className="text-slate-400 text-xs">
                          Closed:{" "}
                          {new Date(w.closedAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      )}
                      <p className="text-slate-400 text-xs">
                        {w.isOpen
                          ? `${w.entryCount ?? 0} mark entries submitted so far`
                          : `${w.publishedCount ?? 0} results published`}
                      </p>
                    </div>
                  </div>

                  {/* Action */}
                  {w.isOpen ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openConfirmClose(w)}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <LockKey size={14} weight="bold" /> Close & Publish
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      isLoading={deleting === w._id}
                      onClick={() => handleDeleteWindow(w)}
                      className="text-red-500 border-red-200 hover:bg-red-50"
                    >
                      <Trash size={14} weight="bold" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create window modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Open Result Window"
      >
        <div className="space-y-4">
          <p className="text-slate-500 text-sm">
            Opening a window lets teachers enter achieved and total marks for their students. Once you close it, results are auto-calculated and published.
          </p>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Session (Academic Year)
            </label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={form.academicYear}
              onChange={(e) => setForm((p) => ({ ...p, academicYear: e.target.value }))}
              disabled={sessions.length === 0}
            >
              {sessions.length === 0 ? (
                <option value="">No sessions — go to Setup → Sessions to create one</option>
              ) : (
                <>
                  <option value="">Select session…</option>
                  {sessions.map((s) => (
                    <option key={s._id} value={s.year}>{s.year}{s.isActive ? " (active)" : ""}</option>
                  ))}
                </>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Semester
            </label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={form.semesterLabel}
              onChange={(e) => setForm((p) => ({ ...p, semesterLabel: e.target.value }))}
            >
              <option value="">Select semester…</option>
              {SEMESTERS.filter(
                (s) => !windows.some((w) => w.semesterLabel === s && w.academicYear === form.academicYear)
              ).map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button size="sm" isLoading={submitting} onClick={handleCreate}>
              Open Window
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm close modal */}
      <Modal
        isOpen={!!confirmClose}
        onClose={() => setConfirmClose(null)}
        title="Close & Publish Results"
      >
        {confirmClose && (
          <div className="space-y-4">
            <div className="flex gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
              <Warning size={20} className="text-amber-500 flex-shrink-0 mt-0.5" weight="fill" />
              <p className="text-sm text-amber-800">
                This will close the result window for{" "}
                <strong>Semester {confirmClose.semesterLabel} ({confirmClose.academicYear})</strong>.
                All submitted marks will be processed, CGPA will be calculated, and results will be
                published to students immediately. <strong>This cannot be undone.</strong>
              </p>
            </div>

            {/* Submission status per teacher / course */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Submission Status by Teacher
              </p>
              {statusLoading ? (
                <div className="flex items-center gap-2 py-4 text-slate-400 text-sm justify-center">
                  <Spinner /> Loading status…
                </div>
              ) : submissionStatus.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-3">No course offerings found for this window.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {submissionStatus.map((t) => {
                    const allDone = t.courses.every((c) => c.enrolledCount > 0 && c.submittedCount >= c.enrolledCount);
                    return (
                      <div key={t.teacherName} className="px-3 py-2.5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-semibold text-slate-700 text-sm">{t.teacherName}</span>
                          <Badge variant={allDone ? "success" : "warning"} className="text-xs">
                            {allDone ? "All submitted" : "Pending"}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          {t.courses.map((c) => {
                            const done = c.enrolledCount > 0 && c.submittedCount >= c.enrolledCount;
                            const partial = c.submittedCount > 0 && c.submittedCount < c.enrolledCount;
                            return (
                              <div key={c.offeringId} className="flex items-center gap-2 text-xs">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                    done ? "bg-emerald-500" : partial ? "bg-amber-400" : "bg-red-400"
                                  }`}
                                />
                                <span className="font-medium text-slate-600">{c.courseCode}</span>
                                <span className="text-slate-400 truncate">{c.courseTitle}</span>
                                <span className={`ml-auto font-semibold flex-shrink-0 ${done ? "text-emerald-600" : partial ? "text-amber-600" : "text-red-500"}`}>
                                  {c.submittedCount}/{c.enrolledCount}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmClose(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                isLoading={closing === confirmClose._id}
                onClick={() => handleClose(confirmClose)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Close & Publish
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
