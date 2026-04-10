"use client";
import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, roleVariant } from "@/components/ui/Badge";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Users, UploadSimple, DownloadSimple, Pencil, MagnifyingGlass, UserCircle, TrashSimple, Warning, CaretUp, CaretDown } from "@phosphor-icons/react";
import { SEMESTERS } from "@/types";

type User = {
  _id: string;
  name: string;
  userId: string;
  email: string;
  role: "student" | "teacher" | "admin";
  isActive: boolean;
  departmentId?: { name: string; _id: string } | null;
  advisorId?: { _id: string; name: string; userId: string } | null;
  currentSemester?: string;
  session?: string;
};

type AdvisorOption = { _id: string; name: string; userId: string };
type Dept = { _id: string; name: string; code: string; advisorIds?: AdvisorOption[] };
type ImportRole = "student" | "teacher";
type PendingCredentialExport = {
  role: ImportRole;
  csv: string;
  count: number;
};

// "" = not chosen yet (invalid for teachers/students), "none" = explicit no-dept (teachers only)
const defaultForm = { name: "", email: "", userId: "", password: "", role: "student" as "student" | "teacher" | "admin", departmentId: "", advisorId: "", currentSemester: "1-1", isActive: true };
const csvTemplates: Record<ImportRole, string> = {
  student: [
    "name,email",
    "Student Name,student1@example.com",
    "Another Student,student2@example.com",
  ].join("\n"),
  teacher: [
    "name,email",
    "Teacher Name,teacher1@example.com",
    "Another Teacher,teacher2@example.com",
  ].join("\n"),
};

function countCsvRows(csv: string) {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return Math.max(0, lines.length - 1);
}

function downloadTextFile(filename: string, content: string, type = "text/plain;charset=utf-8;") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminUsersPage() {
  const { toast: addToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRole, setImportRole] = useState<ImportRole>("teacher");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importRowCount, setImportRowCount] = useState(0);
  const [teacherDepartmentId, setTeacherDepartmentId] = useState("global");
  const [studentDepartmentId, setStudentDepartmentId] = useState("");
  const [studentAdvisorOrder, setStudentAdvisorOrder] = useState<AdvisorOption[]>([]);
  const [pendingCredentialExport, setPendingCredentialExport] = useState<PendingCredentialExport | null>(null);

  const fetchUsers = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (roleFilter !== "all") params.set("role", roleFilter);
    const res = await fetch(`/api/users?${params}`);
    const d = await res.json();
    setUsers(d.data ?? []);
    setLoading(false);
  }, [search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => {
    fetch("/api/departments").then((r) => r.json()).then((d) => setDepts(d.data ?? []));
  }, []);

  useEffect(() => {
    const selectedDept = depts.find((dept) => dept._id === studentDepartmentId);
    setStudentAdvisorOrder(selectedDept?.advisorIds ?? []);
  }, [depts, studentDepartmentId]);

  function openEdit(u: User) {
    setEditing(u);
    const rawDeptId = (u.departmentId as unknown as Record<string, string>)?._id ?? "";
    // For teachers with no dept, use 'none' sentinel so the dropdown shows the right option
    const deptValue = u.role === "teacher" && !rawDeptId ? "none" : rawDeptId;
    const rawAdvisorId = (u.advisorId as unknown as Record<string, string>)?._id ?? "";
    setForm({ name: u.name, email: u.email, userId: u.userId, password: "", role: u.role, departmentId: deptValue, advisorId: rawAdvisorId, currentSemester: u.currentSemester ?? "1-1", isActive: u.isActive });
    setFormError(null);
    setShowModal(true);
  }

  function openImport() {
    setImportRole("teacher");
    setImportFile(null);
    setImportErrors([]);
    setImportRowCount(0);
    setTeacherDepartmentId("global");
    setStudentDepartmentId("");
    setStudentAdvisorOrder([]);
    setShowImportModal(true);
  }

  function downloadTemplate() {
    downloadTextFile(`${importRole}-users-template.csv`, csvTemplates[importRole], "text/csv;charset=utf-8;");
  }

  function downloadPendingCredentials() {
    if (!pendingCredentialExport) return;
    downloadTextFile(
      `${pendingCredentialExport.role}-credentials.csv`,
      pendingCredentialExport.csv,
      "text/csv;charset=utf-8;"
    );
  }

  function moveAdvisor(index: number, direction: "up" | "down") {
    setStudentAdvisorOrder((prev) => {
      const next = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  async function handleImport() {
    if (!importFile) {
      addToast("Please choose a CSV file first.", "warning");
      return;
    }
    if (importRole === "teacher" && teacherDepartmentId === "") {
      addToast("Please choose a department or the global option for teachers.", "warning");
      return;
    }
    if (importRole === "student" && !studentDepartmentId) {
      addToast("Please select a department for student import.", "warning");
      return;
    }
    if (importRole === "student" && studentAdvisorOrder.length === 0) {
      addToast("This department has no advisors available for distribution.", "warning");
      return;
    }

    setImporting(true);
    setImportErrors([]);

    const csv = await importFile.text();
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "bulk_csv_auto",
        role: importRole,
        csv,
        departmentId: importRole === "teacher"
          ? (teacherDepartmentId === "global" ? null : teacherDepartmentId)
          : studentDepartmentId,
        advisorOrder: importRole === "student" ? studentAdvisorOrder.map((advisor) => advisor._id) : undefined,
      }),
    });
    const data = await res.json();

    if (data.success) {
      const warningErrors = data.errors ?? [];
      setImportErrors(warningErrors);
      addToast(`${data.createdCount} ${importRole} user(s) imported successfully.`, "success");
      const credentialExport: PendingCredentialExport = {
        role: importRole,
        csv: data.credentialsCsv ?? "",
        count: Number(data.createdCount ?? 0),
      };
      setPendingCredentialExport(credentialExport);
      fetchUsers();
      setShowImportModal(false);
      setImportFile(null);
      setImportRowCount(0);
    } else {
      setImportErrors(data.errors ?? []);
      addToast(data.error || "CSV import failed", "error");
    }

    setImporting(false);
  }

  async function handleSave() {
    // Department is required for teachers — must explicitly choose dept or 'No specific department'
    if (form.role === "teacher" && form.departmentId === "") {
      setFormError("Please select a department for this teacher, or choose \"No specific department\".");
      return;
    }
    // Department and advisor are required for students
    if (form.role === "student" && !form.departmentId) {
      setFormError("Please select a department for this student.");
      return;
    }
    if (form.role === "student" && !form.advisorId) {
      setFormError("Please assign an advisor for this student.");
      return;
    }
    setSubmitting(true);
    const url = editing ? `/api/users/${editing._id}` : "/api/users";
    const method = editing ? "PATCH" : "POST";
    // Map 'none' sentinel back to empty string (API treats empty string as no dept)
    const body = { ...form, departmentId: form.departmentId === "none" ? "" : form.departmentId };
    if (!body.password) delete (body as Partial<typeof body>).password;
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json();
    if (d.success) {
      addToast(editing ? "User updated!" : "User created!", "success");
      setShowModal(false);
      fetchUsers();
    } else {
      setFormError(d.error || "Something went wrong. Please try again.");
    }
    setSubmitting(false);
  }

  async function toggleActive(u: User) {
    const res = await fetch(`/api/users/${u._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    const d = await res.json();
    if (d.success) {
      setUsers((p) => p.map((usr) => usr._id === u._id ? { ...usr, isActive: !u.isActive } : usr));
      addToast(`User ${!u.isActive ? "activated" : "deactivated"}`, "success");
    } else addToast(d.error || "Failed", "error");
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    const res = await fetch(`/api/users/${deleteConfirm._id}`, { method: "DELETE" });
    const d = await res.json();
    if (d.success) {
      addToast("User deleted.", "success");
      setDeleteConfirm(null);
      fetchUsers();
    } else addToast(d.error || "Failed to delete user.", "error");
    setDeleting(false);
  }

  return (
    <DashboardLayout role="admin" title="User Management" breadcrumb="Home / Users">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Search by name or ID..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchUsers()} />
          </div>
          <div className="flex gap-2">
            {["all", "student", "teacher", "admin"].map((r) => (
              <button key={r} onClick={() => setRoleFilter(r)} className={`px-3.5 py-2 rounded-xl text-sm font-medium capitalize transition ${roleFilter === r ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{r}</button>
            ))}
          </div>
          <Button onClick={openImport}><UploadSimple size={15} className="mr-1" />Import CSV</Button>
        </div>

        <Card>
          {loading ? <div className="flex justify-center py-10"><Spinner /></div> : users.length === 0 ? (
            <EmptyState icon={<Users size={32} />} title="No users found" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-3 px-3 text-xs uppercase text-slate-400 font-semibold">User</th>
                    <th className="text-left py-3 px-3 text-xs uppercase text-slate-400 font-semibold">ID</th>
                    <th className="text-left py-3 px-3 text-xs uppercase text-slate-400 font-semibold">Role</th>
                    <th className="text-left py-3 px-3 text-xs uppercase text-slate-400 font-semibold">Department</th>
                    <th className="text-left py-3 px-3 text-xs uppercase text-slate-400 font-semibold">Status</th>
                    <th className="py-3 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <UserCircle size={28} className="text-slate-300 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{u.name}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-sm font-mono text-slate-600">{u.userId}</td>
                      <td className="py-3 px-3"><Badge variant={roleVariant(u.role)} className="capitalize">{u.role}</Badge></td>
                      <td className="py-3 px-3 text-sm text-slate-500">{(u.departmentId as unknown as Record<string, string>)?.name ?? "—"}</td>
                      <td className="py-3 px-3"><Badge variant={u.isActive ? "success" : "gray"}>{u.isActive ? "Active" : "Inactive"}</Badge></td>
                      <td className="py-3 px-3">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition"><Pencil size={14} /></button>
                          <button onClick={() => toggleActive(u)} className={`text-xs px-2 py-1 rounded-lg font-medium transition ${u.isActive ? "hover:bg-rose-50 hover:text-rose-600 text-slate-400" : "hover:bg-emerald-50 hover:text-emerald-600 text-slate-400"}`}>{u.isActive ? "Deactivate" : "Activate"}</button>
                          <button onClick={() => setDeleteConfirm(u)} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"><TrashSimple size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setFormError(null); }} title="Edit User" maxWidth="md">
        <div className="space-y-4">
          {formError && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-3 py-2.5">
              <span className="font-bold shrink-0">⚠</span>
              <span>{formError}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">User ID *</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} placeholder="ST-001" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "student" | "teacher" | "admin" })}>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
              <input type="email" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">{editing ? "New Password (leave blank to keep)" : "Password *"}</label>
              <input type="password" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Department {(form.role === "teacher" || form.role === "student") && <span className="text-rose-400">*</span>}
              </label>
              <select
                className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                  (form.role === "teacher" || form.role === "student") && form.departmentId === "" ? "border-amber-300" : "border-slate-200"
                }`}
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value, advisorId: "" })}
              >
                {form.role === "teacher"
                  ? <option value="">— select —</option>
                  : form.role === "student"
                    ? <option value="">— select department —</option>
                    : <option value="">None</option>}
                {form.role === "teacher" && <option value="none">No specific department</option>}
                {depts.map((d) => <option key={d._id} value={d._id}>{d.name} ({d.code})</option>)}
              </select>
              {form.role === "teacher" && form.departmentId === "" && (
                <p className="text-xs text-amber-600 mt-1">A teacher must have a department assigned.</p>
              )}
              {form.role === "student" && form.departmentId === "" && (
                <p className="text-xs text-amber-600 mt-1">A student must belong to a department.</p>
              )}
            </div>
{/* Semester only shown when editing an existing student — it is set automatically via registration */}
            {editing && form.role === "student" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Current Semester</label>
                <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={form.currentSemester} onChange={(e) => setForm({ ...form, currentSemester: e.target.value })}>
                  {SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}
                </select>
              </div>
            )}

            {form.role === "student" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Advisor <span className="text-rose-400">*</span></label>
                <select
                  className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                    form.departmentId && !form.advisorId ? "border-amber-300" : "border-slate-200"
                  }`}
                  value={form.advisorId}
                  onChange={(e) => setForm({ ...form, advisorId: e.target.value })}
                  disabled={!form.departmentId}
                >
                  <option value="">{form.departmentId ? "— select advisor —" : "Select a department first"}</option>
                  {(depts.find((d) => d._id === form.departmentId)?.advisorIds ?? []).map((a) => (
                    <option key={a._id} value={a._id}>{a.name} ({a.userId})</option>
                  ))}
                </select>
                {form.departmentId && !form.advisorId && (
                  <p className="text-xs text-amber-600 mt-1">Please assign an advisor for this student.</p>
                )}
                {form.departmentId && (depts.find((d) => d._id === form.departmentId)?.advisorIds ?? []).length === 0 && (
                  <p className="text-xs text-rose-500 mt-1">No advisors assigned to this department yet.</p>
                )}
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            <span className="text-sm font-medium text-slate-700">Active Account</span>
          </label>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button isLoading={submitting} onClick={handleSave}>Update</Button>
        </div>
      </Modal>

      <Modal isOpen={showImportModal} onClose={() => { setShowImportModal(false); setImportErrors([]); }} title="Import Users from CSV" maxWidth="lg">
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-800">Bulk create users by role</p>
            <p className="text-sm text-slate-500 mt-1">
              Select whether you are importing teachers or students, download the sample CSV, fill it, and upload it. IDs and passwords are generated automatically.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">1. Select user role</label>
            <div className="grid sm:grid-cols-2 gap-3">
              {(["teacher", "student"] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setImportRole(role);
                    setImportErrors([]);
                    setImportFile(null);
                    setImportRowCount(0);
                  }}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold capitalize transition ${
                    importRole === role
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:bg-indigo-50/40"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">2. Download sample CSV</label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button variant="outline" onClick={downloadTemplate}>
                <DownloadSimple size={15} className="mr-1" />
                Download {importRole} template
              </Button>
              <p className="text-xs text-slate-400">
                Required columns for {importRole}: {csvTemplates[importRole].split("\n")[0]}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">3. Configure {importRole === "teacher" ? "teacher" : "student"} import</label>
            {importRole === "teacher" ? (
              <div className="space-y-2">
                <select
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={teacherDepartmentId}
                  onChange={(e) => setTeacherDepartmentId(e.target.value)}
                >
                  <option value="global">Global / No department</option>
                  {depts.map((dept) => (
                    <option key={dept._id} value={dept._id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400">
                  Every imported teacher will be assigned to this department, unless you choose the global option.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <select
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    value={studentDepartmentId}
                    onChange={(e) => {
                      setStudentDepartmentId(e.target.value);
                      setImportErrors([]);
                    }}
                  >
                    <option value="">Select department</option>
                    {depts.map((dept) => (
                      <option key={dept._id} value={dept._id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>

                {studentDepartmentId ? (
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Advisor order for distribution</p>
                        <p className="text-xs text-slate-400">
                          Students will be distributed evenly in this order. Rearrange advisors before importing.
                        </p>
                      </div>
                    </div>

                    {studentAdvisorOrder.length === 0 ? (
                      <p className="text-sm text-rose-500">This department does not have any advisors assigned yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {studentAdvisorOrder.map((advisor, index) => {
                          const baseShare = studentAdvisorOrder.length > 0 ? Math.floor(importRowCount / studentAdvisorOrder.length) : 0;
                          const extra = studentAdvisorOrder.length > 0 && index < importRowCount % studentAdvisorOrder.length ? 1 : 0;
                          return (
                            <div key={advisor._id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                              <span className="w-6 text-center text-xs font-bold text-slate-400">{index + 1}</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-700">{advisor.name}</p>
                                <p className="text-xs text-slate-400">{advisor.userId}</p>
                              </div>
                              {importFile ? (
                                <span className="text-xs font-semibold text-indigo-600 whitespace-nowrap">{baseShare + extra} student(s)</span>
                              ) : null}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => moveAdvisor(index, "up")}
                                  disabled={index === 0}
                                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <CaretUp size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveAdvisor(index, "down")}
                                  disabled={index === studentAdvisorOrder.length - 1}
                                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <CaretDown size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">4. Upload completed CSV</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                setImportErrors([]);
                setImportFile(e.target.files?.[0] ?? null);
                const file = e.target.files?.[0];
                if (!file) {
                  setImportRowCount(0);
                  return;
                }
                setImportRowCount(countCsvRows(await file.text()));
              }}
              className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {importFile ? (
              <p className="text-xs text-slate-500 mt-2">Selected file: {importFile.name} · {importRowCount} row(s) detected</p>
            ) : null}
          </div>

          {importErrors.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">Import notes</p>
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {importErrors.map((error, index) => (
                  <p key={`${error}-${index}`} className="text-sm text-amber-700">{error}</p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowImportModal(false)}>Cancel</Button>
          <Button isLoading={importing} onClick={handleImport}>
            <UploadSimple size={15} className="mr-1" />
            Import Users
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(pendingCredentialExport)}
        onClose={() => setPendingCredentialExport(null)}
        title="Download Credentials"
        maxWidth="md"
      >
        {pendingCredentialExport ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Download before closing</p>
              <p className="text-sm text-amber-800 mt-1">
                This file is available only in this window. After you close it, there will be no other download option.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800 capitalize">{pendingCredentialExport.role} credentials ready</p>
              <p className="text-sm text-slate-500 mt-1">
                {pendingCredentialExport.count} account{pendingCredentialExport.count === 1 ? "" : "s"} created successfully.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setPendingCredentialExport(null)}>Close</Button>
              <Button onClick={downloadPendingCredentials}>
                <DownloadSimple size={15} className="mr-1" />
                Download Credentials
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete User" maxWidth="sm">
        <div className="flex items-start gap-3">
          <Warning size={24} className="text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-slate-700">Are you sure you want to permanently delete <span className="font-semibold">{deleteConfirm?.name}</span> <span className="font-mono text-slate-500">({deleteConfirm?.userId})</span>?</p>
            <p className="text-xs text-slate-400 mt-1">This action cannot be undone.</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" isLoading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
