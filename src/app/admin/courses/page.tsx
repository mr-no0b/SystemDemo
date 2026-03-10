"use client";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Books, Plus, FunnelSimple, UserCirclePlus, Pencil, Trash } from "@phosphor-icons/react";
import { SEMESTERS } from "@/types";

type Teacher = { _id: string; name: string; userId: string; departmentId?: { _id: string } | null };
type Course = { _id: string; code: string; title: string; credits: number; semesterLabel: string; departmentId?: { _id: string; name: string; code: string } };
type Dept = { _id: string; name: string; code: string };
type SessionItem = { _id: string; year: string; isActive: boolean };
type SectionRecord = {
  _id: string;
  courseId: { _id: string } | string;
  teacherId?: { _id: string; name: string; userId: string } | null;
  academicYear: string;
  section: string;
};

export default function AdminCoursesPage() {
  const { toast: addToast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [allSections, setAllSections] = useState<SectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingSection, setEditingSection] = useState<SectionRecord | null>(null);
  const [sectionTeacherId, setSectionTeacherId] = useState("");
  const [sectionAcademicYear, setSectionAcademicYear] = useState("");
  const [sectionLetter, setSectionLetter] = useState("A");
  const [sectionSubmitting, setSectionSubmitting] = useState(false);
  const [deletingSection, setDeletingSection] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterDept, setFilterDept] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [courseForm, setCourseForm] = useState({ code: "", title: "", credits: "3", semesterLabel: "1-1", departmentId: "", description: "" });

  const fetchData = async () => {
    const [cRes, sRes] = await Promise.all([
      fetch("/api/courses"),
      fetch("/api/sections"),
    ]);
    const [cData, sData] = await Promise.all([cRes.json(), sRes.json()]);
    setCourses(cData.data ?? []);
    setAllSections(sData.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    fetch("/api/departments").then((r) => r.json()).then((d) => setDepts(d.data ?? []));
    fetch("/api/users?role=teacher").then((r) => r.json()).then((d) => setTeachers(d.data ?? []));
    fetch("/api/sessions").then((r) => r.json()).then((d) => setSessions(d.data ?? []));
  }, []);

  function sectionsForCourse(courseId: string): SectionRecord[] {
    return allSections.filter((s) => {
      const cId = typeof s.courseId === "object" ? (s.courseId as { _id: string })._id : s.courseId;
      return cId === courseId;
    });
  }

  function openSectionModal(course: Course, existing?: SectionRecord) {
    setEditingCourse(course);
    if (existing) {
      setEditingSection(existing);
      setSectionAcademicYear(existing.academicYear);
      setSectionTeacherId((existing.teacherId as { _id: string } | null | undefined)?._id ?? "");
      setSectionLetter(existing.section);
    } else {
      setEditingSection(null);
      setSectionAcademicYear(sessions.find((s) => s.isActive)?.year ?? sessions[0]?.year ?? "");
      setSectionTeacherId("");
      setSectionLetter("A");
    }
    setShowSectionModal(true);
  }

  async function handleSaveSection() {
    if (!editingCourse) return;
    setSectionSubmitting(true);

    if (editingSection) {
      const res = await fetch(`/api/sections/${editingSection._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: sectionTeacherId || null }),
      });
      const d = await res.json();
      if (d.success) { addToast("Teacher updated!", "success"); setShowSectionModal(false); fetchData(); }
      else addToast(d.error || "Failed", "error");
    } else {
      if (!sectionAcademicYear) { addToast("Select a session", "error"); setSectionSubmitting(false); return; }
      const deptId = (editingCourse.departmentId as { _id: string } | undefined)?._id ?? "";
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: editingCourse._id,
          semesterLabel: editingCourse.semesterLabel,
          academicYear: sectionAcademicYear,
          teacherId: sectionTeacherId || undefined,
          section: sectionLetter || "A",
          departmentId: deptId,
          isActive: true,
        }),
      });
      const d = await res.json();
      if (d.success) { addToast("Session assignment created!", "success"); setShowSectionModal(false); fetchData(); }
      else addToast(d.error || "Failed", "error");
    }
    setSectionSubmitting(false);
  }

  async function handleDeleteSection() {
    if (!editingSection) return;
    setDeletingSection(true);
    const res = await fetch(`/api/sections/${editingSection._id}`, { method: "DELETE" });
    const d = await res.json();
    if (d.success) {
      addToast("Assignment removed.", "success");
      setShowSectionModal(false);
      fetchData();
    } else addToast(d.error || "Failed", "error");
    setDeletingSection(false);
  }

  async function handleCreateCourse() {
    setSubmitting(true);
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...courseForm, credits: Number(courseForm.credits) }),
    });
    const d = await res.json();
    if (d.success) {
      addToast("Course created!", "success");
      setShowCourseModal(false);
      setCourseForm({ code: "", title: "", credits: "3", semesterLabel: "1-1", departmentId: "", description: "" });
      fetchData();
    } else addToast(d.error || "Failed", "error");
    setSubmitting(false);
  }

  const filtered = courses.filter((c) => {
    const deptMatch = !filterDept || (c.departmentId as { _id: string } | undefined)?._id === filterDept;
    const semMatch = !filterSemester || c.semesterLabel === filterSemester;
    return deptMatch && semMatch;
  });

  return (
    <DashboardLayout role="admin" title="Courses" breadcrumb="Home / Courses">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 items-center">
          <FunnelSimple size={16} className="text-slate-400" />
          <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="">All Departments</option>
            {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
          <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)}>
            <option value="">All Semesters</option>
            {SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}
          </select>
          {(filterDept || filterSemester) && (
            <button onClick={() => { setFilterDept(""); setFilterSemester(""); }} className="text-xs text-indigo-600 hover:underline px-1">Clear</button>
          )}
          <div className="ml-auto">
            <Button size="sm" onClick={() => setShowCourseModal(true)}><Plus size={14} className="mr-1" />New Course</Button>
          </div>
        </div>

        {/* Course List */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Books size={36} />} title="No courses found" />
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => {
              const sections = sectionsForCourse(c._id);
              return (
                <Card key={c._id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-indigo-600">{c.code}</span>
                        <h3 className="font-semibold text-slate-800">{c.title}</h3>
                        <Badge variant="primary">{c.credits} cr</Badge>
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {(c.departmentId as unknown as Record<string, string>)?.name ?? "—"} · Semester {c.semesterLabel}
                      </p>
                      {/* Session → teacher chips (only assigned ones) */}
                      {sections.filter((s) => (s.teacherId as { _id: string } | null)?._id).length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {sections.filter((s) => (s.teacherId as { _id: string } | null)?._id).map((s) => (
                            <div key={s._id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                              <span className="font-semibold text-slate-500">{s.academicYear}</span>
                              <span className="text-slate-300">·</span>
                              <span className="text-slate-700">
                                {(s.teacherId as { name: string } | null)?.name ?? <span className="italic text-slate-400">No teacher</span>}
                              </span>
                              <button onClick={() => openSectionModal(c, s)} className="ml-0.5 text-slate-400 hover:text-indigo-600 transition" title="Edit">
                                <Pencil size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => openSectionModal(c)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2.5 py-1.5 rounded-xl border border-indigo-200 hover:bg-indigo-50 transition flex-shrink-0 mt-0.5"
                    >
                      <UserCirclePlus size={15} /> Assign
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* New Course Modal */}
      <Modal isOpen={showCourseModal} onClose={() => setShowCourseModal(false)} title="New Course" maxWidth="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono uppercase" value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value.toUpperCase() })} placeholder="CSE101" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Credits</label>
              <input type="number" min={1} max={4} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={courseForm.credits} onChange={(e) => setCourseForm({ ...courseForm, credits: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Semester</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={courseForm.semesterLabel} onChange={(e) => setCourseForm({ ...courseForm, semesterLabel: e.target.value })}>
                {SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={courseForm.departmentId} onChange={(e) => setCourseForm({ ...courseForm, departmentId: e.target.value })}>
                <option value="">None</option>
                {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowCourseModal(false)}>Cancel</Button>
          <Button isLoading={submitting} onClick={handleCreateCourse}>Create</Button>
        </div>
      </Modal>

      {/* Session Assignment Modal */}
      <Modal
        isOpen={showSectionModal}
        onClose={() => setShowSectionModal(false)}
        title={editingSection ? "Edit Session Assignment" : "Assign Teacher to Session"}
        maxWidth="sm"
      >
        <div className="space-y-4">
          {editingCourse && (
            <p className="text-sm text-slate-500">
              <span className="font-semibold font-mono text-indigo-600">{editingCourse.code}</span>{" "}
              {editingCourse.title} · Semester {editingCourse.semesterLabel}
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Session (Academic Year) *</label>
            {editingSection ? (
              <div className="border border-slate-100 bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-500 font-mono">
                {editingSection.academicYear}
              </div>
            ) : (
              <select
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={sectionAcademicYear}
                onChange={(e) => setSectionAcademicYear(e.target.value)}
              >
                <option value="">Select session…</option>
                {sessions.map((s) => (
                  <option key={s._id} value={s.year}>{s.year}{s.isActive ? " (active)" : ""}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Teacher</label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={sectionTeacherId}
              onChange={(e) => setSectionTeacherId(e.target.value)}
            >
              <option value="">Select teacher…</option>
              {teachers
                .filter((t) => {
                  const deptId = (editingCourse?.departmentId as { _id: string } | undefined)?._id;
                  const deptMatch = !deptId || !t.departmentId || (t.departmentId as { _id: string })?._id === deptId;
                  if (!deptMatch) return false;
                  // Hide teachers already assigned to this course+year (except the one currently on this slot)
                  const takenByOtherSlot = allSections.some((s) => {
                    const cId = typeof s.courseId === "object" ? (s.courseId as { _id: string })._id : s.courseId;
                    const tId = (s.teacherId as { _id: string } | null | undefined)?._id;
                    return (
                      cId === editingCourse?._id &&
                      s.academicYear === sectionAcademicYear &&
                      tId === t._id &&
                      s._id !== editingSection?._id
                    );
                  });
                  return !takenByOtherSlot;
                })
                .map((t) => <option key={t._id} value={t._id}>{t.name} ({t.userId})</option>)}
            </select>
            <p className="text-xs text-slate-400 mt-1">Showing teachers from this course&apos;s department (already-assigned teachers are hidden).</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowSectionModal(false)}>Cancel</Button>
          {editingSection && (
            <Button
              variant="outline"
              isLoading={deletingSection}
              onClick={handleDeleteSection}
              className="text-red-500 border-red-200 hover:bg-red-50 mr-auto"
            >
              <Trash size={14} weight="bold" /> Remove
            </Button>
          )}
          <Button isLoading={sectionSubmitting} onClick={handleSaveSection}>Save</Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
