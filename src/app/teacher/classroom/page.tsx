"use client";
import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  Chalkboard, Users, Megaphone, Plus, Trash, Clock, Student,
  FileText, Eye, Check, ArrowSquareOut,
} from "@phosphor-icons/react";

type Section = {
  _id: string;
  courseId: { _id: string; code: string; title: string; credits: number };
  semesterLabel: string;
  academicYear: string;
  section: string;
  departmentId?: { name: string; code: string };
};

type StudentItem = {
  _id: string;
  name: string;
  userId: string;
  email?: string;
  currentSemester?: string;
};

type Announcement = {
  _id: string;
  title: string;
  content: string;
  createdAt: string;
  publishedBy: { name: string; userId: string };
};

type Assignment = {
  _id: string;
  title: string;
  description?: string;
  dueDate: string;
  totalMarks: number;
  isPublished: boolean;
  driveLink?: string;
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

const SEMESTERS = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2", "4-1", "4-2"];

export default function TeacherClassroomPage() {
  const { toast: addToast } = useToast();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Section | null>(null);
  const [activeView, setActiveView] = useState<"announcements" | "assignments" | "students">("announcements");

  // Students
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [showNewAnnouncement, setShowNewAnnouncement] = useState(false);
  const [annForm, setAnnForm] = useState({ title: "", content: "" });
  const [posting, setPosting] = useState(false);

  // Assignments
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [showNewAssign, setShowNewAssign] = useState(false);
  const [showGrade, setShowGrade] = useState<Submission | null>(null);
  const [assignForm, setAssignForm] = useState({ title: "", description: "", driveLink: "", dueDate: "", totalMarks: "100" });
  const [gradeForm, setGradeForm] = useState({ marks: "", feedback: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/sections?mine=true")
      .then((r) => r.json())
      .then((d) => { setSections(d.data ?? []); setLoading(false); });
  }, []);

  const loadSection = useCallback(async (sec: Section) => {
    setSelected(sec);
    setStudents([]);
    setAnnouncements([]);
    setAssignments([]);
    setSelectedAssignment(null);
    setSubmissions([]);
    setActiveView("announcements");
    setStudentsLoading(true);
    setAnnouncementsLoading(true);
    setAssignmentsLoading(true);

    const [sRes, aRes, asRes] = await Promise.all([
      fetch(`/api/classroom/${sec._id}/students`),
      fetch(`/api/classroom/${sec._id}/announcements`),
      fetch(`/api/assignments?offeringId=${sec._id}`),
    ]);
    const [sData, aData, asData] = await Promise.all([sRes.json(), aRes.json(), asRes.json()]);
    setStudents(sData.data ?? []);
    setAnnouncements(aData.data ?? []);
    setAssignments(asData.data ?? []);
    setStudentsLoading(false);
    setAnnouncementsLoading(false);
    setAssignmentsLoading(false);
  }, []);

  async function postAnnouncement() {
    if (!selected || !annForm.title.trim() || !annForm.content.trim()) {
      addToast("Title and content are required", "error");
      return;
    }
    setPosting(true);
    const res = await fetch(`/api/classroom/${selected._id}/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(annForm),
    });
    const d = await res.json();
    if (d.success) {
      setAnnouncements((p) => [d.data, ...p]);
      setAnnForm({ title: "", content: "" });
      setShowNewAnnouncement(false);
      addToast("Announcement posted!", "success");
    } else addToast(d.error || "Failed", "error");
    setPosting(false);
  }

  async function deleteAnnouncement(noticeId: string) {
    if (!selected) return;
    const res = await fetch(`/api/classroom/${selected._id}/announcements`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noticeId }),
    });
    const d = await res.json();
    if (d.success) {
      setAnnouncements((p) => p.filter((a) => a._id !== noticeId));
      addToast("Announcement deleted", "success");
    } else addToast(d.error || "Failed", "error");
  }

  async function loadSubmissions(assignment: Assignment) {
    if (selectedAssignment?._id === assignment._id) {
      setSelectedAssignment(null);
      return;
    }
    setSelectedAssignment(assignment);
    const res = await fetch(`/api/submissions?assignmentId=${assignment._id}`);
    const d = await res.json();
    setSubmissions(d.data ?? []);
  }

  async function handleCreateAssignment() {
    if (!selected || !assignForm.title.trim() || !assignForm.dueDate) {
      addToast("Title and due date are required", "error");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...assignForm,
        description: assignForm.description || undefined,
        courseOfferingId: selected._id,
        totalMarks: Number(assignForm.totalMarks),
        isPublished: true,
      }),
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
      addToast("Graded!", "success");
    } else addToast(d.error || "Failed", "error");
    setSubmitting(false);
  }

  const bySemester = sections.reduce<Record<string, Section[]>>((acc, s) => {
    if (!acc[s.semesterLabel]) acc[s.semesterLabel] = [];
    acc[s.semesterLabel].push(s);
    return acc;
  }, {});

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <DashboardLayout role="teacher" title="Classrooms" breadcrumb="Home / Classrooms">
      <div className="grid lg:grid-cols-5 gap-5 min-h-[70vh]">

        {/* Left: section list */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">My Classrooms</h2>
          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : sections.length === 0 ? (
            <EmptyState icon={<Chalkboard size={32} />} title="No classrooms" description="You have no assigned courses yet." />
          ) : (
            SEMESTERS.filter((s) => bySemester[s]?.length).map((sem) => (
              <div key={sem}>
                <p className="text-xs font-semibold text-slate-400 mb-1.5">Semester {sem}</p>
                <div className="space-y-2">
                  {bySemester[sem].map((sec) => (
                    <button
                      key={sec._id}
                      onClick={() => loadSection(sec)}
                      className={`w-full text-left rounded-2xl border p-3.5 transition ${
                        selected?._id === sec._id
                          ? "border-indigo-400 bg-indigo-50/70 shadow-sm"
                          : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-indigo-600 text-xs">{sec.courseId?.code}</span>

                          </div>
                          <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{sec.courseId?.title}</p>
                          <p className="text-xs text-slate-400">{sec.academicYear} · {sec.departmentId?.name ?? ""}</p>
                        </div>
                        <Badge variant="primary" className="shrink-0">{sec.courseId?.credits}cr</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: classroom detail */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-300 border border-dashed border-slate-200 rounded-2xl gap-3">
              <Chalkboard size={36} />
              <p className="text-sm">Select a classroom to view details</p>
            </div>
          ) : (
            <div className="space-y-4">

              {/* Header card with tabs */}
              <Card>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono font-bold text-indigo-600">{selected.courseId?.code}</span>

                      <Badge variant="blue">Sem {selected.semesterLabel}</Badge>
                    </div>
                    <h2 className="font-bold text-slate-800 text-lg">{selected.courseId?.title}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selected.academicYear} · {selected.departmentId?.name ?? ""} · {selected.courseId?.credits} Credits
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shrink-0">
                    <Student size={15} />
                    <span>{studentsLoading ? "…" : students.length} students</span>
                  </div>
                </div>

                {/* Tab toggle */}
                <div className="flex gap-2 mt-4 flex-wrap">
                  <button
                    onClick={() => setActiveView("announcements")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition ${activeView === "announcements" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  >
                    <Megaphone size={14} /> Announcements
                    {announcements.length > 0 && (
                      <span className={`text-xs rounded-full px-1.5 py-0.5 leading-none ${activeView === "announcements" ? "bg-white/30 text-white" : "bg-indigo-100 text-indigo-600"}`}>
                        {announcements.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveView("assignments")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition ${activeView === "assignments" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  >
                    <FileText size={14} /> Assignments
                    {assignments.length > 0 && (
                      <span className={`text-xs rounded-full px-1.5 py-0.5 leading-none ${activeView === "assignments" ? "bg-white/30 text-white" : "bg-indigo-100 text-indigo-600"}`}>
                        {assignments.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveView("students")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition ${activeView === "students" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  >
                    <Users size={14} /> Students
                  </button>
                </div>
              </Card>

              {/* ── Announcements ── */}
              {activeView === "announcements" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-600">Classroom Announcements</h3>
                    <Button size="sm" onClick={() => setShowNewAnnouncement(true)}>
                      <Plus size={13} className="mr-1" />Post Announcement
                    </Button>
                  </div>
                  {announcementsLoading ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                  ) : announcements.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm border border-dashed border-slate-200 rounded-2xl">
                      No announcements yet. Post one to notify your students.
                    </div>
                  ) : (
                    announcements.map((a) => (
                      <Card key={a._id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800">{a.title}</p>
                            <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{a.content}</p>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
                              <Clock size={12} />{formatDate(a.createdAt)}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteAnnouncement(a._id)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition shrink-0"
                            title="Delete"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {/* ── Assignments ── */}
              {activeView === "assignments" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-600">Assignments</h3>
                    <Button size="sm" onClick={() => setShowNewAssign(true)}>
                      <Plus size={13} className="mr-1" />New Assignment
                    </Button>
                  </div>
                  {assignmentsLoading ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                  ) : assignments.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm border border-dashed border-slate-200 rounded-2xl">
                      No assignments yet. Create one for your students.
                    </div>
                  ) : (
                    assignments.map((a) => (
                      <Card
                        key={a._id}
                        className={`cursor-pointer transition ${selectedAssignment?._id === a._id ? "border-indigo-300" : ""}`}
                        onClick={() => loadSubmissions(a)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-slate-800">{a.title}</h3>
                            {a.description && <p className="text-slate-400 text-xs mt-0.5">{a.description}</p>}
                            <p className="text-slate-400 text-xs mt-0.5">
                              Due: {new Date(a.dueDate).toLocaleDateString()} · Max: {a.totalMarks} marks
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {a.driveLink && (
                              <a href={a.driveLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                <ArrowSquareOut size={15} className="text-slate-400 hover:text-indigo-600" />
                              </a>
                            )}
                            <Badge variant={a.isPublished ? "success" : "gray"}>{a.isPublished ? "Published" : "Draft"}</Badge>
                          </div>
                        </div>

                        {selectedAssignment?._id === a._id && (
                          <div className="mt-4 border-t border-slate-100 pt-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                              Submissions ({submissions.length})
                            </p>
                            {submissions.length === 0 ? (
                              <p className="text-slate-400 text-xs text-center py-3">No submissions yet</p>
                            ) : (
                              <div className="space-y-2">
                                {submissions.map((s) => (
                                  <div key={s._id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                                    <div>
                                      <p className="text-sm font-medium text-slate-800">{s.studentId?.name}</p>
                                      <p className="text-xs text-slate-400">
                                        {s.studentId?.userId} · {new Date(s.submittedAt).toLocaleDateString()}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <a href={s.driveLink} target="_blank" rel="noopener noreferrer">
                                        <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                                          <Eye size={13} className="mr-1" />View
                                        </Button>
                                      </a>
                                      {s.gradedAt ? (
                                        <Badge variant="success">
                                          <Check size={11} className="inline mr-0.5" />{s.marks}/{a.totalMarks}
                                        </Badge>
                                      ) : (
                                        <Button size="sm" onClick={(e) => { e.stopPropagation(); setShowGrade(s); setGradeForm({ marks: "", feedback: "" }); }}>
                                          Grade
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    ))
                  )}
                </div>
              )}

              {/* ── Students ── */}
              {activeView === "students" && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-600">
                    Enrolled Students ({studentsLoading ? "…" : students.length})
                  </h3>
                  {studentsLoading ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                  ) : students.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm border border-dashed border-slate-200 rounded-2xl">
                      No students enrolled in this section yet.
                    </div>
                  ) : (
                    <Card>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="text-left py-2 px-2 text-xs uppercase text-slate-400 font-semibold">Student</th>
                            <th className="text-left py-2 px-2 text-xs uppercase text-slate-400 font-semibold">ID</th>
                            <th className="text-left py-2 px-2 text-xs uppercase text-slate-400 font-semibold">Semester</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((s) => (
                            <tr key={s._id} className="border-b border-slate-50 hover:bg-slate-50/50">
                              <td className="py-2.5 px-2">
                                <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                                {s.email && <p className="text-xs text-slate-400">{s.email}</p>}
                              </td>
                              <td className="py-2.5 px-2 font-mono text-sm text-slate-600">{s.userId}</td>
                              <td className="py-2.5 px-2">
                                <Badge variant="blue">{s.currentSemester ?? "—"}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Post Announcement Modal */}
      <Modal
        isOpen={showNewAnnouncement}
        onClose={() => { setShowNewAnnouncement(false); setAnnForm({ title: "", content: "" }); }}
        title="Post Announcement"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
            Visible only to students in{" "}
            <strong>{selected?.courseId?.code} – {selected?.courseId?.title}</strong>.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="e.g. Midterm date changed"
              value={annForm.title}
              onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content *</label>
            <textarea
              rows={5}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="Write your announcement here…"
              value={annForm.content}
              onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => { setShowNewAnnouncement(false); setAnnForm({ title: "", content: "" }); }}>Cancel</Button>
          <Button isLoading={posting} onClick={postAnnouncement}>Post</Button>
        </div>
      </Modal>

      {/* New Assignment Modal */}
      <Modal isOpen={showNewAssign} onClose={() => setShowNewAssign(false)} title="New Assignment" maxWidth="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Assignment title"
              value={assignForm.title}
              onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="Optional instructions…"
              value={assignForm.description}
              onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Drive Link (resources)</label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="https://drive.google.com/…"
              value={assignForm.driveLink}
              onChange={(e) => setAssignForm({ ...assignForm, driveLink: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date *</label>
              <input
                type="date"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={assignForm.dueDate}
                onChange={(e) => setAssignForm({ ...assignForm, dueDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total Marks</label>
              <input
                type="number"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={assignForm.totalMarks}
                onChange={(e) => setAssignForm({ ...assignForm, totalMarks: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowNewAssign(false)}>Cancel</Button>
          <Button isLoading={submitting} onClick={handleCreateAssignment}>Create</Button>
        </div>
      </Modal>

      {/* Grade Submission Modal */}
      <Modal isOpen={!!showGrade} onClose={() => setShowGrade(null)} title="Grade Submission" maxWidth="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Grading <strong>{showGrade?.studentId?.name}</strong> — {selectedAssignment?.title}
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Marks *</label>
            <input
              type="number"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder={`Out of ${selectedAssignment?.totalMarks}`}
              value={gradeForm.marks}
              onChange={(e) => setGradeForm({ ...gradeForm, marks: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Feedback</label>
            <textarea
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="Optional feedback for the student…"
              value={gradeForm.feedback}
              onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
            />
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
