"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import { Chalkboard, FileText, CheckCircle, Megaphone } from "@phosphor-icons/react";

interface Offering {
  _id: string;
  courseId: { code: string; title: string; credits: number; description?: string };
  teacherId?: { name: string; userId: string } | null;
  departmentId: { name: string; code: string };
}

interface Assignment {
  _id: string;
  title: string;
  description: string;
  dueDate: string;
  totalMarks: number;
  driveLink?: string;
}

interface Announcement {
  _id: string;
  title: string;
  content: string;
  createdAt: string;
  publishedBy?: { name: string };
}

export default function ClassroomDetailClient({ offerings }: { offerings: Offering[] }) {
  const [selected, setSelected] = useState<Offering | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());
  const [showSubmit, setShowSubmit] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [driveLink, setDriveLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [activeView, setActiveView] = useState<"assignments" | "announcements">("assignments");
  const { toast } = useToast();

  const loadAssignments = async (offeringId: string) => {
    const res = await fetch(`/api/assignments?offeringId=${offeringId}`);
    const data = await res.json();
    if (!data.success) return;
    const list: Assignment[] = data.data ?? [];
    setAssignments(list);

    const checks = await Promise.all(
      list.map((a) =>
        fetch(`/api/submissions?assignmentId=${a._id}`)
          .then((r) => r.json())
          .then((d) => (d.data ? a._id : null))
      )
    );
    setSubmittedIds(new Set(checks.filter(Boolean) as string[]));
  };

  const handleSelect = (off: Offering) => {
    setSelected(off);
    setAssignments([]);
    setSubmittedIds(new Set());
    setAnnouncements([]);
    setActiveView("assignments");
    loadAssignments(off._id);
    loadAnnouncements(off._id);
  };

  const loadAnnouncements = async (offeringId: string) => {
    setAnnouncementsLoading(true);
    try {
      const res = await fetch(`/api/classroom/${offeringId}/announcements`);
      const data = await res.json();
      if (data.success) setAnnouncements(data.data ?? []);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAssignment || !driveLink.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: selectedAssignment._id, driveLink }),
      });
      const data = await res.json();
      if (data.success) {
        toast("Assignment submitted!", "success");
        setShowSubmit(false);
        setDriveLink("");
        setSubmittedIds((prev) => new Set([...prev, selectedAssignment._id]));
      } else {
        toast(data.error ?? "Error", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      {/* Course list — one card per offering (per teacher) */}
      <div className="xl:col-span-1 space-y-3">
        {offerings.map((off) => {
          const course = off.courseId;
          return (
            <div
              key={off._id}
              onClick={() => handleSelect(off)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${selected?._id === off._id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30"}`}
            >
              <div className="flex items-start justify-between mb-2">
                <Badge variant="primary">{course.code}</Badge>
              </div>
              <h3 className="font-semibold text-slate-800 text-sm mb-1">{course.title}</h3>
              <p className="text-xs text-slate-400">{off.teacherId?.name ?? "TBA"}</p>
              <p className="text-xs text-slate-400">{off.departmentId.name}</p>
            </div>
          );
        })}
      </div>

      {/* Detail panel */}
      <div className="xl:col-span-2">
        {!selected ? (
          <div className="flex items-center justify-center h-64 border-2 border-dashed border-slate-200 rounded-2xl">
            <div className="text-center">
              <Chalkboard size={40} className="mx-auto text-slate-200 mb-2" />
              <p className="text-slate-400">Select a course to view details</p>
            </div>
          </div>
        ) : (
          <Card>
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="primary">{selected.courseId.code}</Badge>
              </div>
              <h2 className="text-xl font-bold text-slate-800">{selected.courseId.title}</h2>
              <p className="text-slate-500 text-sm mt-1">Instructor: {selected.teacherId?.name ?? "TBA"}</p>
              {selected.courseId.description && (
                <p className="text-slate-400 text-sm mt-2">{selected.courseId.description}</p>
              )}
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl w-fit">
              <button
                onClick={() => setActiveView("assignments")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeView === "assignments" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <FileText size={15} /> Assignments
              </button>
              <button
                onClick={() => setActiveView("announcements")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeView === "announcements" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <Megaphone size={15} /> Announcements
                {announcements.length > 0 && (
                  <span className="bg-indigo-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{announcements.length}</span>
                )}
              </button>
            </div>

            {/* Assignments tab */}
            {activeView === "assignments" && (
              <>
                {assignments.length === 0 ? (
                  <p className="text-slate-400 text-sm py-4 text-center">No assignments yet</p>
                ) : (
                  <div className="space-y-3">
                    {assignments.map((a) => (
                      <div key={a._id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-sm text-slate-800">{a.title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{a.description}</p>
                            <p className="text-xs text-slate-400 mt-1">Due: {formatDate(a.dueDate)} · {a.totalMarks} marks</p>
                          </div>
                          <div className="flex flex-col gap-2 ml-4">
                            {a.driveLink && (
                              <a href={a.driveLink} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">Resources ↗</a>
                            )}
                            {submittedIds.has(a._id) ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                                <CheckCircle size={13} weight="fill" /> Submitted
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setSelectedAssignment(a); setShowSubmit(true); }}
                              >
                                Submit
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Announcements tab */}
            {activeView === "announcements" && (
              <>
                {announcementsLoading ? (
                  <p className="text-slate-400 text-sm py-4 text-center">Loading announcements…</p>
                ) : announcements.length === 0 ? (
                  <div className="text-center py-8">
                    <Megaphone size={32} className="mx-auto text-slate-200 mb-2" />
                    <p className="text-slate-400 text-sm">No announcements yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {announcements.map((ann) => (
                      <div key={ann._id} className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-semibold text-sm text-slate-800">{ann.title}</p>
                          <span className="text-xs text-slate-400 whitespace-nowrap">{formatDate(ann.createdAt)}</span>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{ann.content}</p>
                        {ann.publishedBy?.name && (
                          <p className="text-xs text-slate-400 mt-2">— {ann.publishedBy.name}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>
        )}
      </div>

      <Modal isOpen={showSubmit} onClose={() => setShowSubmit(false)} title="Submit Assignment" footer={
        <>
          <Button variant="outline" onClick={() => setShowSubmit(false)}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={submitting}>Submit</Button>
        </>
      }>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Submitting: <strong>{selectedAssignment?.title}</strong></p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Google Drive Link</label>
            <input
              type="url"
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
