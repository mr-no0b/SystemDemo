"use client";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, statusVariant } from "@/components/ui/Badge";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { GraduationCap, CalendarBlank, LockOpen, LockSimple, Plus, Trash } from "@phosphor-icons/react";
import { SEMESTERS } from "@/types";

type RegWindow = {
  _id: string;
  semesterLabel: string;
  academicYear: string;
  isOpen: boolean;
  openedBy?: { name: string };
  openedAt: string;
};

type SessionItem = { _id: string; year: string; isActive: boolean };

type Registration = {
  _id: string;
  studentId: { name: string; userId: string };
  semesterLabel: string;
  academicYear: string;
  departmentId?: { name: string };
  advisorId?: { name: string };
  status: string;
  courseOfferingIds: unknown[];
  createdAt: string;
};

export default function AdminAdmissionsPage() {
  const { toast: addToast } = useToast();
  const [activeTab, setActiveTab] = useState<"windows" | "applications">("windows");

  // Windows
  const [windows, setWindows] = useState<RegWindow[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [windowsLoading, setWindowsLoading] = useState(true);
  const [showWindowModal, setShowWindowModal] = useState(false);
  const [windowForm, setWindowForm] = useState({ semesterLabel: "1-1", academicYear: "" });
  const [windowSubmitting, setWindowSubmitting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Applications
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("pending_advisor");

  const fetchWindows = async () => {
    setWindowsLoading(true);
    const res = await fetch("/api/registration-windows");
    const d = await res.json();
    setWindows(d.data ?? []);
    setWindowsLoading(false);
  };

  const fetchApplications = async (status: string) => {
    setAppsLoading(true);
    const res = await fetch(`/api/registrations?status=${status}`);
    const d = await res.json();
    setRegistrations(d.data ?? []);
    setAppsLoading(false);
  };

  useEffect(() => {
    fetchWindows();
    fetch("/api/sessions").then((r) => r.json()).then((d) => setSessions(d.data ?? []));
  }, []);
  useEffect(() => {
    if (activeTab === "applications") fetchApplications(statusFilter);
  }, [activeTab, statusFilter]);

  async function handleOpenWindow() {
    setWindowSubmitting(true);
    const res = await fetch("/api/registration-windows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(windowForm),
    });
    const d = await res.json();
    if (d.success) {
      addToast("Registration window opened!", "success");
      setShowWindowModal(false);
      fetchWindows();
    } else addToast(d.error || "Failed", "error");
    setWindowSubmitting(false);
  }

  async function handleToggleWindow(win: RegWindow) {
    setToggling(win._id);
    const res = await fetch(`/api/registration-windows/${win._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOpen: !win.isOpen }),
    });
    const d = await res.json();
    if (d.success) {
      addToast(win.isOpen ? "Window closed." : "Window reopened!", "success");
      fetchWindows();
    } else addToast(d.error || "Failed", "error");
    setToggling(null);
  }

  async function handleDeleteWindow(win: RegWindow) {
    if (!confirm(`Delete the closed window for Semester ${win.semesterLabel} (${win.academicYear})? This cannot be undone.`)) return;
    setDeleting(win._id);
    const res = await fetch(`/api/registration-windows/${win._id}`, { method: "DELETE" });
    const d = await res.json();
    if (d.success) {
      addToast("Window deleted.", "success");
      fetchWindows();
    } else addToast(d.error || "Failed to delete", "error");
    setDeleting(null);
  }

  const appFilters = ["pending_advisor", "pending_head", "payment_pending", "admitted", "rejected"];

  return (
    <DashboardLayout role="admin" title="Admissions" breadcrumb="Home / Admissions">
      <div className="max-w-4xl mx-auto space-y-4">

        {/* Tab switcher */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("windows")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${activeTab === "windows" ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"}`}
          >
            Registration Windows
          </button>
          <button
            onClick={() => setActiveTab("applications")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${activeTab === "applications" ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"}`}
          >
            Applications
          </button>
        </div>

        {/* Registration Windows Tab */}
        {activeTab === "windows" && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Open a window to allow students to register for a semester.
              </p>
              <Button size="sm" onClick={() => setShowWindowModal(true)}>
                <Plus size={14} className="mr-1" />Open Window
              </Button>
            </div>

            {windowsLoading ? (
              <div className="flex justify-center py-16"><Spinner /></div>
            ) : windows.length === 0 ? (
              <EmptyState
                icon={<CalendarBlank size={36} />}
                title="No registration windows"
                description="Open a window to let students register for a semester."
              />
            ) : (
              <div className="space-y-2">
                {windows.map((w) => (
                  <Card key={w._id}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${w.isOpen ? "bg-emerald-100" : "bg-slate-100"}`}>
                          {w.isOpen
                            ? <LockOpen size={18} className="text-emerald-600" />
                            : <LockSimple size={18} className="text-slate-400" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">Semester {w.semesterLabel}</span>
                            <Badge variant={w.isOpen ? "success" : "gray"}>
                              {w.isOpen ? "Open" : "Closed"}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {w.academicYear} · Opened by {w.openedBy?.name ?? "Admin"} · {new Date(w.openedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={w.isOpen ? "danger-soft" : "outline"}
                          isLoading={toggling === w._id}
                          onClick={() => handleToggleWindow(w)}
                        >
                          {w.isOpen ? "Close" : "Reopen"}
                        </Button>
                        {!w.isOpen && (
                          <Button
                            size="sm"
                            variant="outline"
                            isLoading={deleting === w._id}
                            onClick={() => handleDeleteWindow(w)}
                            className="text-red-500 border-red-200 hover:bg-red-50"
                          >
                            <Trash size={14} weight="bold" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Applications Tab */}
        {activeTab === "applications" && (
          <>
            <div className="flex flex-wrap gap-2">
              {appFilters.map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold capitalize transition ${statusFilter === f ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                >
                  {f.replace(/_/g, " ")}
                </button>
              ))}
            </div>

            {appsLoading ? (
              <div className="flex justify-center py-16"><Spinner /></div>
            ) : registrations.length === 0 ? (
              <EmptyState
                icon={<GraduationCap size={36} />}
                title="No registrations"
                description={`No registrations with status: ${statusFilter.replace(/_/g, " ")}`}
              />
            ) : (
              <div className="space-y-3">
                {registrations.map((r) => (
                  <Card key={r._id}>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-slate-800">{r.studentId?.name}</h3>
                          <Badge variant={statusVariant(r.status)}>
                            {r.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="text-slate-500 text-sm">
                          {r.studentId?.userId} · {r.departmentId?.name ?? "—"}
                        </p>
                        <p className="text-slate-400 text-xs mt-1">
                          Sem {r.semesterLabel} · {r.academicYear} · {r.courseOfferingIds?.length ?? 0} courses
                          {r.advisorId && <> · Advisor: {r.advisorId.name}</>}
                          {" · "}Applied {new Date(r.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Open Window Modal */}
      <Modal
        isOpen={showWindowModal}
        onClose={() => setShowWindowModal(false)}
        title="Open Registration Window"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Students whose previous semester result is published will be able to apply during this window.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Semester *</label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={windowForm.semesterLabel}
              onChange={(e) => setWindowForm((f) => ({ ...f, semesterLabel: e.target.value }))}
            >
              {SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Session (Academic Year) *</label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={windowForm.academicYear}
              onChange={(e) => setWindowForm((f) => ({ ...f, academicYear: e.target.value }))}
            >
              <option value="">Select session…</option>
              {sessions.map((s) => (
                <option key={s._id} value={s.year}>{s.year}{s.isActive ? " (active)" : ""}</option>
              ))}
            </select>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">What happens next:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Eligible students apply and select their courses.</li>
              <li>Advisor reviews → Department Head approves.</li>
              <li>Student pays → <strong>automatically admitted</strong> (no admin step).</li>
            </ol>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowWindowModal(false)}>Cancel</Button>
          <Button isLoading={windowSubmitting} onClick={handleOpenWindow}>Open Window</Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
