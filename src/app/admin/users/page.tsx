"use client";
import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, roleVariant } from "@/components/ui/Badge";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Users, Plus, Pencil, MagnifyingGlass, UserCircle, TrashSimple, Warning } from "@phosphor-icons/react";
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

type Dept = { _id: string; name: string; code: string; advisorIds?: { _id: string; name: string; userId: string }[] };

// "" = not chosen yet (invalid for teachers/students), "none" = explicit no-dept (teachers only)
const defaultForm = { name: "", email: "", userId: "", password: "", role: "student" as "student" | "teacher" | "admin", departmentId: "", advisorId: "", currentSemester: "1-1", isActive: true };

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

  function openCreate() {
    setEditing(null);
    setForm(defaultForm);
    setFormError(null);
    setShowModal(true);
  }

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
          <Button onClick={openCreate}><Plus size={15} className="mr-1" />New User</Button>
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

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setFormError(null); }} title={editing ? "Edit User" : "Create User"} maxWidth="md">
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
          <Button isLoading={submitting} onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
        </div>
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
