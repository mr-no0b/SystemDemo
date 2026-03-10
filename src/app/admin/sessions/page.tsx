"use client";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { CalendarBlank, Plus } from "@phosphor-icons/react";

type Session = { _id: string; year: string; isActive: boolean; createdAt: string };

export default function AdminSessionsPage() {
  const { toast: addToast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [year, setYear] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchSessions = async () => {
    const res = await fetch("/api/sessions");
    const d = await res.json();
    setSessions(d.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchSessions(); }, []);

  async function handleCreate() {
    if (!year.trim()) { addToast("Enter a session year e.g. 2025-26", "error"); return; }
    setSubmitting(true);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year }),
    });
    const d = await res.json();
    if (d.success) {
      addToast("Session created!", "success");
      setShowModal(false);
      setYear("");
      fetchSessions();
    } else addToast(d.error || "Failed", "error");
    setSubmitting(false);
  }

  async function handleToggle(s: Session) {
    setToggling(s._id);
    const res = await fetch("/api/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s._id, isActive: !s.isActive }),
    });
    const d = await res.json();
    if (d.success) {
      addToast(s.isActive ? "Session deactivated" : "Session activated", "success");
      fetchSessions();
    } else addToast(d.error || "Failed", "error");
    setToggling(null);
  }

  return (
    <DashboardLayout role="admin" title="Sessions" breadcrumb="Home / Sessions">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Academic Sessions</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Sessions (academic years) used across registration windows, result windows, and course assignments.
            </p>
          </div>
          <Button size="sm" onClick={() => { setYear(""); setShowModal(true); }}>
            <Plus size={14} className="mr-1" /> New Session
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<CalendarBlank size={36} />}
            title="No sessions yet"
            description='Create your first session e.g. "2025-26"'
          />
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <Card key={s._id}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.isActive ? "bg-indigo-100" : "bg-slate-100"}`}>
                      <CalendarBlank size={20} className={s.isActive ? "text-indigo-600" : "text-slate-400"} weight="fill" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{s.year}</p>
                      <p className="text-xs text-slate-400">
                        Created {new Date(s.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={s.isActive ? "success" : "gray"}>
                      {s.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      size="sm"
                      variant={s.isActive ? "outline" : "ghost"}
                      isLoading={toggling === s._id}
                      onClick={() => handleToggle(s)}
                    >
                      {s.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Academic Session" maxWidth="sm">
        <div className="space-y-4">
          <p className="text-slate-500 text-sm">
            Enter the academic year in the format <span className="font-mono font-semibold">YYYY-YY</span>, e.g. <span className="font-mono">2025-26</span>.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Session Year *</label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2025-26"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button size="sm" isLoading={submitting} onClick={handleCreate}>Create Session</Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
