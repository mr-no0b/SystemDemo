"use client";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Books, Plus, Eye, Check, ArrowSquareOut } from "@phosphor-icons/react";

type Offering = {
  _id: string;
  courseId: { code: string; title: string; credits: number };
  semesterLabel: string;
  academicYear: string;
  section: string;
  plannedClasses: number;
};

type Assignment = {
  _id: string;
  title: string;
  dueDate: string;
  totalMarks: number;
  isPublished: boolean;
  driveLink: string;
};

type Submission = {
  _id: string;
  studentId: { name: string; userId: string };
  driveLink: string;
  submittedAt: string;
  marks?: number;
  feedback?: string;
  gradedAt?: string;
};

export default function TeacherCoursesPage() {
  const { toast: addToast } = useToast();
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selected, setSelected] = useState<Offering | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewAssign, setShowNewAssign] = useState(false);
  const [showGrade, setShowGrade] = useState<Submission | null>(null);
  const [assignForm, setAssignForm] = useState({ title: "", description: "", driveLink: "", dueDate: "", totalMarks: "100" });
  const [gradeForm, setGradeForm] = useState({ marks: "", feedback: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/sections?mine=true")
      .then((r) => r.json())
      .then((d) => { setOfferings(d.data ?? []); setLoading(false); });
  }, []);

  async function loadAssignments(offering: Offering) {
    setSelected(offering);
    setSelectedAssignment(null);
    setSubmissions([]);
    const res = await fetch(`/api/assignments?offeringId=${offering._id}`);
    const d = await res.json();
    setAssignments(d.data ?? []);
  }

  async function loadSubmissions(assignment: Assignment) {
    setSelectedAssignment(assignment);
    const res = await fetch(`/api/submissions?assignmentId=${assignment._id}`);
    const d = await res.json();
    setSubmissions(d.data ?? []);
  }

  async function handleCreateAssignment() {
    if (!selected || !assignForm.title || !assignForm.dueDate) return;
    setSubmitting(true);
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...assignForm, description: assignForm.description || undefined, courseOfferingId: selected._id, totalMarks: Number(assignForm.totalMarks), isPublished: true }),
    });
    const d = await res.json();
    if (d.success) {
      setAssignments((p) => [...p, d.data]);
      setShowNewAssign(false);
      setAssignForm({ title: "", description: "", driveLink: "", dueDate: "", totalMarks: "100" });
      addToast("Assignment created!", "success");
    } else addToast(d.error || "Failed", "error");
    setSubmitting(false);
  }

  async function handleGrade() {
    if (!showGrade) return;
    setSubmitting(true);
    const res = await fetch("/api/submissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId: showGrade._id, marks: Number(gradeForm.marks), feedback: gradeForm.feedback }),
    });
    const d = await res.json();
    if (d.success) {
      setSubmissions((p) => p.map((s) => s._id === showGrade._id ? d.data : s));
      setShowGrade(null);
      addToast("Graded successfully!", "success");
    } else addToast(d.error || "Failed", "error");
    setSubmitting(false);
  }

  return (
    <DashboardLayout role="teacher" title="Courses" breadcrumb="Home / Courses">
      <div className="grid lg:grid-cols-3 gap-5 h-full">
        {/* Course list */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">My Courses</h2>
          {loading ? <div className="flex justify-center py-10"><Spinner /></div> : offerings.length === 0 ? (
            <EmptyState icon={<Books size={32} />} title="No courses" description="No assigned courses." />
          ) : offerings.map((o) => (
            <button key={o._id} onClick={() => loadAssignments(o)} className={`w-full text-left rounded-2xl border p-4 transition ${selected?._id === o._id ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-200"}`}>
              <p className="font-bold text-slate-800 text-sm">{o.courseId.code}</p>
              <p className="text-slate-500 text-xs mt-0.5">{o.courseId.title}</p>
              <p className="text-slate-400 text-xs mt-1">Sem {o.semesterLabel} · {o.academicYear}</p>
            </button>
          ))}
        </div>

        {/* Assignments panel */}
        <div className="lg:col-span-2 space-y-4">
          {!selected ? (
            <div className="flex items-center justify-center h-48 text-slate-300 text-sm">Select a course to manage assignments</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-700">Assignments – {selected.courseId.code}</h2>
                <Button size="sm" onClick={() => setShowNewAssign(true)}><Plus size={15} className="mr-1" />New Assignment</Button>
              </div>
              {assignments.length === 0 ? (
                <Card><p className="text-center text-slate-400 text-sm py-8">No assignments yet</p></Card>
              ) : (
                <div className="space-y-3">
                  {assignments.map((a) => (
                    <Card key={a._id} className={`transition ${selectedAssignment?._id === a._id ? "border-indigo-300" : ""}`} onClick={() => loadSubmissions(a)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-800">{a.title}</h3>
                          <p className="text-slate-400 text-xs mt-0.5">Due: {new Date(a.dueDate).toLocaleDateString()} · Max: {a.totalMarks} marks</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {a.driveLink && <a href={a.driveLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}><ArrowSquareOut size={15} className="text-slate-400 hover:text-indigo-600" /></a>}
                          <Badge variant={a.isPublished ? "success" : "gray"}>{a.isPublished ? "Published" : "Draft"}</Badge>
                        </div>
                      </div>

                      {/* Submissions list */}
                      {selectedAssignment?._id === a._id && (
                        <div className="mt-4 border-t border-slate-100 pt-3">
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Submissions ({submissions.length})</p>
                          {submissions.length === 0 ? (
                            <p className="text-slate-400 text-xs text-center py-3">No submissions yet</p>
                          ) : (
                            <div className="space-y-2">
                              {submissions.map((s) => (
                                <div key={s._id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                                  <div>
                                    <p className="text-sm font-medium text-slate-800">{s.studentId?.name}</p>
                                    <p className="text-xs text-slate-400">{s.studentId?.userId} · {new Date(s.submittedAt).toLocaleDateString()}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <a href={s.driveLink} target="_blank" rel="noopener noreferrer">
                                      <Button variant="ghost" size="sm"><Eye size={13} className="mr-1" />View</Button>
                                    </a>
                                    {s.gradedAt ? (
                                      <Badge variant="success"><Check size={11} className="inline mr-0.5" />{s.marks}/{a.totalMarks}</Badge>
                                    ) : (
                                      <Button size="sm" onClick={(e) => { e.stopPropagation(); setShowGrade(s); setGradeForm({ marks: "", feedback: "" }); }}>Grade</Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* New Assignment Modal */}
      <Modal isOpen={showNewAssign} onClose={() => setShowNewAssign(false)} title="New Assignment" maxWidth="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={assignForm.title} onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })} placeholder="Assignment title" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" value={assignForm.description} onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Drive Link (instructions)</label>
            <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={assignForm.driveLink} onChange={(e) => setAssignForm({ ...assignForm, driveLink: e.target.value })} placeholder="https://drive.google.com/..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date *</label>
              <input type="date" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={assignForm.dueDate} onChange={(e) => setAssignForm({ ...assignForm, dueDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total Marks</label>
              <input type="number" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={assignForm.totalMarks} onChange={(e) => setAssignForm({ ...assignForm, totalMarks: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowNewAssign(false)}>Cancel</Button>
          <Button isLoading={submitting} onClick={handleCreateAssignment}>Create</Button>
        </div>
      </Modal>

      {/* Grade Modal */}
      <Modal isOpen={!!showGrade} onClose={() => setShowGrade(null)} title="Grade Submission" maxWidth="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Marks *</label>
            <input type="number" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={gradeForm.marks} onChange={(e) => setGradeForm({ ...gradeForm, marks: e.target.value })} placeholder={`Out of ${selectedAssignment?.totalMarks}`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Feedback</label>
            <textarea rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" value={gradeForm.feedback} onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })} placeholder="Optional feedback for the student..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowGrade(null)}>Cancel</Button>
          <Button isLoading={submitting} onClick={handleGrade}>Save Grade</Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
