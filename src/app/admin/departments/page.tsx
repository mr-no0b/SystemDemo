"use client";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  Buildings, Plus, Pencil, BookOpen, CaretRight, CaretDown,
  FolderOpen, Folder, UserCircle, ChalkboardTeacher, X, Trash,
} from "@phosphor-icons/react";
import { SEMESTERS } from "@/types";

type Advisor = { _id: string; name: string; userId: string };
type Dept = {
  _id: string;
  name: string;
  code: string;
  headId?: Advisor | null;
  advisorIds: Advisor[];
};
type Teacher = { _id: string; name: string; userId: string; departmentId?: { _id: string; name: string } | null };
type Course = { _id: string; code: string; title: string; credits: number; semesterLabel: string };

export default function AdminDepartmentsPage() {
  const { toast: addToast } = useToast();
  const [depts, setDepts] = useState<Dept[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Dept | null>(null);
  const [form, setForm] = useState({ name: "", code: "" });
  const [submitting, setSubmitting] = useState(false);

  const [showHeadModal, setShowHeadModal] = useState(false);
  const [headDept, setHeadDept] = useState<Dept | null>(null);
  const [selectedHead, setSelectedHead] = useState("");
  const [savingHead, setSavingHead] = useState(false);

  const [showAdvisorModal, setShowAdvisorModal] = useState(false);
  const [advisorDept, setAdvisorDept] = useState<Dept | null>(null);
  const [selectedAdvisor, setSelectedAdvisor] = useState("");
  const [savingAdvisor, setSavingAdvisor] = useState(false);

  const [expandedDeptId, setExpandedDeptId] = useState<string | null>(null);
  const [openSemesters, setOpenSemesters] = useState<Set<string>>(new Set());
  const [coursesByDept, setCoursesByDept] = useState<Record<string, Course[]>>({});
  const [loadingCourses, setLoadingCourses] = useState(false);

  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseForm, setCourseForm] = useState({ code: "", title: "", credits: "3", description: "" });
  const [addingToSem, setAddingToSem] = useState("");
  const [addingToDept, setAddingToDept] = useState("");
  const [submittingCourse, setSubmittingCourse] = useState(false);

  const fetchDepts = async () => {
    const res = await fetch("/api/departments");
    const d = await res.json();
    setDepts(d.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDepts();
    fetch("/api/users?role=teacher").then((r) => r.json()).then((d) => setTeachers(d.data ?? []));
  }, []);

  async function toggleDeptCourses(deptId: string) {
    if (expandedDeptId === deptId) { setExpandedDeptId(null); setOpenSemesters(new Set()); return; }
    setExpandedDeptId(deptId);
    setOpenSemesters(new Set());
    if (!coursesByDept[deptId]) {
      setLoadingCourses(true);
      const res = await fetch(`/api/courses?dept=${deptId}`);
      const d = await res.json();
      setCoursesByDept((prev) => ({ ...prev, [deptId]: d.data ?? [] }));
      setLoadingCourses(false);
    }
  }

  function toggleSemester(sem: string) {
    setOpenSemesters((prev) => { const n = new Set(prev); n.has(sem) ? n.delete(sem) : n.add(sem); return n; });
  }

  async function handleAddCourse() {
    if (!courseForm.code.trim() || !courseForm.title.trim()) return addToast("Code and title required", "error");
    setSubmittingCourse(true);
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: courseForm.code.trim(),
        title: courseForm.title.trim(),
        credits: Number(courseForm.credits) || 3,
        departmentId: addingToDept,
        semesterLabel: addingToSem,
        description: courseForm.description.trim() || undefined,
      }),
    });
    const d = await res.json();
    if (d.success || d._id) {
      addToast("Course added!", "success");
      setShowCourseModal(false);
      const r2 = await fetch(`/api/courses?dept=${addingToDept}`);
      const d2 = await r2.json();
      setCoursesByDept((prev) => ({ ...prev, [addingToDept]: d2.data ?? [] }));
    } else addToast(d.error || "Failed to add course", "error");
    setSubmittingCourse(false);
  }

  async function handleDeleteCourse(deptId: string, courseId: string) {
    if (!confirm("Permanently delete this course and all its sections?")) return;
    const res = await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
    const d = await res.json();
    if (d.success) {
      addToast("Course deleted", "success");
      setCoursesByDept((prev) => ({
        ...prev,
        [deptId]: (prev[deptId] ?? []).filter((c) => c._id !== courseId),
      }));
    } else addToast(d.error || "Failed", "error");
  }

  async function handleSaveDept() {
    if (!form.name.trim() || !form.code.trim()) return addToast("Name and code required", "error");
    setSubmitting(true);
    const url = editing ? `/api/departments/${editing._id}` : "/api/departments";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name.trim(), code: form.code.trim().toUpperCase() }) });
    const d = await res.json();
    if (d.success) { addToast(editing ? "Updated!" : "Created!", "success"); setShowModal(false); setEditing(null); fetchDepts(); }
    else addToast(d.error || "Failed", "error");
    setSubmitting(false);
  }

  async function handleSetHead() {
    if (!headDept) return;
    setSavingHead(true);
    const res = await fetch(`/api/departments/${headDept._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set_head", teacherId: selectedHead || null }) });
    const d = await res.json();
    if (d.success) { addToast("Head updated!", "success"); setShowHeadModal(false); fetchDepts(); }
    else addToast(d.error || "Failed", "error");
    setSavingHead(false);
  }

  async function handleAddAdvisor() {
    if (!advisorDept || !selectedAdvisor) return addToast("Select a teacher", "error");
    setSavingAdvisor(true);
    const res = await fetch(`/api/departments/${advisorDept._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add_advisor", teacherId: selectedAdvisor }) });
    const d = await res.json();
    if (d.success) { addToast("Advisor added!", "success"); setShowAdvisorModal(false); fetchDepts(); }
    else addToast(d.error || "Failed", "error");
    setSavingAdvisor(false);
  }

  async function handleRemoveAdvisor(deptId: string, teacherId: string) {
    const res = await fetch(`/api/departments/${deptId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove_advisor", teacherId }) });
    const d = await res.json();
    if (d.success) { addToast("Advisor removed", "success"); fetchDepts(); }
    else addToast(d.error || "Failed", "error");
  }

  return (
    <DashboardLayout role="admin" title="Departments" breadcrumb="Home / Departments">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => { setEditing(null); setForm({ name: "", code: "" }); setShowModal(true); }}>
            <Plus size={15} className="mr-1" />New Department
          </Button>
        </div>

        {loading ? <div className="flex justify-center py-16"><Spinner /></div>
          : depts.length === 0 ? <EmptyState icon={<Buildings size={36} />} title="No departments" />
          : (
            <div className="space-y-4">
              {depts.map((dept) => {
                const isExpanded = expandedDeptId === dept._id;
                const courses: Course[] = coursesByDept[dept._id] ?? [];
                const bySem: Record<string, Course[]> = {};
                for (const sem of SEMESTERS) bySem[sem] = [];
                for (const c of courses) { if (bySem[c.semesterLabel]) bySem[c.semesterLabel].push(c); }

                return (
                  <Card key={dept._id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-slate-800 text-base">{dept.name}</h3>
                          <span className="bg-indigo-50 text-indigo-600 text-xs font-bold px-2 py-0.5 rounded-lg">{dept.code}</span>
                        </div>

                        {/* Head row */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <ChalkboardTeacher size={14} className="text-amber-500 shrink-0" />
                          <span className="text-xs text-slate-500 font-medium">Head:</span>
                          {dept.headId
                            ? <span className="text-xs font-semibold text-slate-700">{dept.headId.name}</span>
                            : <span className="text-xs text-slate-400 italic">Not assigned</span>}
                          <button onClick={() => { setHeadDept(dept); setSelectedHead(dept.headId?._id ?? ""); setShowHeadModal(true); }} className="ml-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                            {dept.headId ? "Change" : "Assign"}
                          </button>
                        </div>

                        {/* Advisors row */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <UserCircle size={14} className="text-purple-500 shrink-0" />
                          <span className="text-xs text-slate-500 font-medium">Advisors:</span>
                          {dept.advisorIds.length === 0
                            ? <span className="text-xs text-slate-400 italic">None</span>
                            : dept.advisorIds.map((a) => (
                              <span key={a._id} className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                                {a.name}
                                <button onClick={() => handleRemoveAdvisor(dept._id, a._id)} className="hover:text-rose-500 transition"><X size={10} weight="bold" /></button>
                              </span>
                            ))}
                          <button onClick={() => { setAdvisorDept(dept); setSelectedAdvisor(""); setShowAdvisorModal(true); }} className="inline-flex items-center gap-0.5 text-xs text-purple-500 hover:text-purple-700 font-medium border border-purple-200 hover:border-purple-400 px-1.5 py-0.5 rounded-full transition">
                            <Plus size={10} weight="bold" />Add
                          </button>
                        </div>
                      </div>

                      <button onClick={() => { setEditing(dept); setForm({ name: dept.name, code: dept.code }); setShowModal(true); }} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition shrink-0">
                        <Pencil size={15} />
                      </button>
                    </div>

                    {/* Courses toggle */}
                    <button onClick={() => toggleDeptCourses(dept._id)} className="mt-4 flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition">
                      {isExpanded ? <CaretDown size={13} weight="bold" /> : <CaretRight size={13} weight="bold" />}
                      <BookOpen size={14} />
                      {isExpanded ? "Hide Courses" : "View Courses"}
                      {courses.length > 0 && <span className="ml-1 bg-indigo-100 text-indigo-600 text-xs font-bold px-1.5 py-0.5 rounded-md">{courses.length}</span>}
                    </button>

                    {isExpanded && (
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        {loadingCourses ? <div className="flex justify-center py-6"><Spinner /></div> : (
                          <div className="space-y-0.5">
                            {SEMESTERS.map((sem) => {
                              const semCourses = bySem[sem] ?? [];
                              const isOpen = openSemesters.has(sem);
                              return (
                                <div key={sem}>
                                  <button onClick={() => toggleSemester(sem)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${isOpen ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-600"}`}>
                                    {isOpen ? <FolderOpen size={14} className="text-indigo-500 shrink-0" /> : <Folder size={14} className="text-slate-400 shrink-0" />}
                                    <span className="font-mono text-xs font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{sem}</span>
                                    <span className="text-slate-500 text-xs">Semester {sem}</span>
                                    <span className={`ml-auto text-xs font-semibold tabular-nums ${semCourses.length > 0 ? "text-slate-400" : "text-slate-200"}`}>{semCourses.length} course{semCourses.length !== 1 ? "s" : ""}</span>
                                    {isOpen ? <CaretDown size={10} className="text-indigo-400 shrink-0" /> : <CaretRight size={10} className="text-slate-300 shrink-0" />}
                                  </button>
                                  {isOpen && (
                                    <div className="ml-8 mr-2 mb-1 mt-0.5 space-y-0.5">
                                      {semCourses.length === 0
                                        ? <p className="px-3 py-2 text-xs text-slate-400 italic">No courses yet.</p>
                                        : semCourses.map((c) => (
                                          <div key={c._id} className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-slate-50 group">
                                            <div className="w-1 h-1 rounded-full bg-slate-300 group-hover:bg-indigo-400 shrink-0" />
                                            <span className="font-mono text-xs font-bold text-indigo-600 w-[4.5rem] shrink-0">{c.code}</span>
                                            <span className="text-sm text-slate-700 flex-1 leading-snug">{c.title}</span>
                                            <span className="text-xs font-semibold text-slate-400 shrink-0 tabular-nums">{c.credits} cr</span>
                                            <button onClick={() => handleDeleteCourse(dept._id, c._id)} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition shrink-0" title="Delete course"><Trash size={13} /></button>
                                          </div>
                                        ))}
                                      <button onClick={() => { setAddingToDept(dept._id); setAddingToSem(sem); setCourseForm({ code: "", title: "", credits: "3", description: "" }); setShowCourseModal(true); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition w-full mt-1">
                                        <Plus size={12} weight="bold" />Add Course
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
      </div>

      {/* Add Course Modal */}
      <Modal isOpen={showCourseModal} onClose={() => setShowCourseModal(false)} title={`Add Course — Semester ${addingToSem}`} maxWidth="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Course Code *</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-300" value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value.toUpperCase() })} placeholder="CSE 1101" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Credits *</label>
              <input type="number" min="1" max="6" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={courseForm.credits} onChange={(e) => setCourseForm({ ...courseForm, credits: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} placeholder="Introduction to Programming" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowCourseModal(false)}>Cancel</Button>
          <Button isLoading={submittingCourse} onClick={handleAddCourse}>Add Course</Button>
        </div>
      </Modal>

      {/* Create / Edit Dept Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Department" : "New Department"} maxWidth="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Computer Science & Engineering" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
            <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-300" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="CSE" />
          </div>
          <p className="text-xs text-slate-400">Head and advisors can be assigned from the department card after creating.</p>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button isLoading={submitting} onClick={handleSaveDept}>{editing ? "Update" : "Create"}</Button>
        </div>
      </Modal>

      {/* Set Head Modal */}
      <Modal isOpen={showHeadModal} onClose={() => setShowHeadModal(false)} title={`Set Department Head — ${headDept?.name}`} maxWidth="sm">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Department Head</label>
          <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={selectedHead} onChange={(e) => setSelectedHead(e.target.value)}>
            <option value="">None (unassign)</option>
            {teachers
              .filter((t) => !t.departmentId || t.departmentId._id === headDept?._id)
              .map((t) => <option key={t._id} value={t._id}>{t.name} ({t.userId})</option>)}
          </select>
          <p className="text-xs text-slate-400 mt-2">Only one head per department. Showing teachers from this department and those with no specific department.</p>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowHeadModal(false)}>Cancel</Button>
          <Button isLoading={savingHead} onClick={handleSetHead}>Save</Button>
        </div>
      </Modal>

      {/* Add Advisor Modal */}
      <Modal isOpen={showAdvisorModal} onClose={() => setShowAdvisorModal(false)} title={`Add Advisor — ${advisorDept?.name}`} maxWidth="sm">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Select Teacher</label>
          <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={selectedAdvisor} onChange={(e) => setSelectedAdvisor(e.target.value)}>
            <option value="">— choose —</option>
            {teachers
              .filter((t) => !t.departmentId || t.departmentId._id === advisorDept?._id)
              .filter((t) => !advisorDept?.advisorIds.some((a) => a._id === t._id))
              .map((t) => (
              <option key={t._id} value={t._id}>{t.name} ({t.userId})</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-2">A department can have multiple advisors. Showing teachers from this department and those with no specific department. Already-assigned teachers are hidden.</p>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowAdvisorModal(false)}>Cancel</Button>
          <Button isLoading={savingAdvisor} onClick={handleAddAdvisor}>Add Advisor</Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
