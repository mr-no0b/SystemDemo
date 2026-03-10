"use client";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Bell, Plus, Pencil, Trash, PushPin } from "@phosphor-icons/react";

type Notice = {
  _id: string;
  title: string;
  content: string;
  scope: "central" | "departmental";
  target: "all" | "students" | "teachers";
  isPinned: boolean;
  isActive: boolean;
  attachmentLink?: string;
  departmentId?: { _id: string; name: string; code: string } | string;
  publishedBy?: { name: string };
  createdAt: string;
};

type Dept = { _id: string; name: string; code: string };

const defaultForm = { title: "", content: "", scope: "central" as "central" | "departmental", target: "all" as "all" | "students" | "teachers", isPinned: false, isActive: true, attachmentLink: "", departmentId: "" };

export default function AdminNoticesPage() {
  const { toast: addToast } = useToast();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/departments").then(r => r.json()).then(d => setDepts(d.data ?? []));
  }, []);

  const fetchNotices = async () => {
    const res = await fetch("/api/notices");
    const d = await res.json();
    setNotices(d.data ?? []);
    setLoading(false);
  };
  useEffect(() => { fetchNotices(); }, []);

  function openEdit(n: Notice) {
    setEditing(n);
    const deptId = typeof n.departmentId === "object" && n.departmentId ? n.departmentId._id : (n.departmentId ?? "");
    setForm({ title: n.title, content: n.content, scope: n.scope, target: n.target, isPinned: n.isPinned, isActive: n.isActive, attachmentLink: n.attachmentLink ?? "", departmentId: deptId });
    setShowModal(true);
  }

  async function handleSave() {
    if (form.scope === "departmental" && !form.departmentId) {
      addToast("Please select a department", "error");
      return;
    }
    setSubmitting(true);
    const url = editing ? `/api/notices/${editing._id}` : "/api/notices";
    const method = editing ? "PATCH" : "POST";
    const payload = { ...form, departmentId: form.scope === "departmental" ? form.departmentId : undefined };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const d = await res.json();
    if (d.success) {
      addToast(editing ? "Updated!" : "Notice posted!", "success");
      setShowModal(false);
      setEditing(null);
      setForm(defaultForm);
      fetchNotices();
    } else addToast(d.error || "Failed", "error");
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this notice?")) return;
    const res = await fetch(`/api/notices/${id}`, { method: "DELETE" });
    const d = await res.json();
    if (d.success) { addToast("Deleted", "success"); setNotices((p) => p.filter((n) => n._id !== id)); }
    else addToast(d.error || "Failed", "error");
  }

  return (
    <DashboardLayout role="admin" title="Notices" breadcrumb="Home / Notices">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => { setEditing(null); setForm(defaultForm); setShowModal(true); }}>
            <Plus size={15} className="mr-1" />Post Notice
          </Button>
        </div>
        {loading ? <div className="flex justify-center py-16"><Spinner /></div> : notices.length === 0 ? (
          <EmptyState icon={<Bell size={36} />} title="No notices" />
        ) : (
          <div className="space-y-3">
            {notices.map((n) => (
              <Card key={n._id} className={n.isPinned ? "border-indigo-200 bg-indigo-50/20" : ""}>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {n.isPinned && <PushPin size={13} className="text-indigo-500" weight="fill" />}
                      <h3 className="font-bold text-slate-800">{n.title}</h3>
                      <Badge variant={n.scope === "central" ? "primary" : "purple"}>{n.scope}</Badge>
                      {n.scope === "departmental" && n.departmentId && (
                        <Badge variant="purple" className="font-mono">
                          {typeof n.departmentId === "object" ? n.departmentId.code : n.departmentId}
                        </Badge>
                      )}
                      <Badge variant="gray" className="capitalize">{n.target}</Badge>
                      {!n.isActive && <Badge variant="gray">Inactive</Badge>}
                    </div>
                    <p className="text-slate-600 text-sm line-clamp-2">{n.content}</p>
                    <p className="text-slate-400 text-xs mt-2">
                      By {n.publishedBy?.name ?? "Admin"} · {new Date(n.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(n)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(n._id)} className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition"><Trash size={14} /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Notice" : "Post Notice"} maxWidth="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content *</label>
            <textarea rows={4} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Scope</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as "central" | "departmental", departmentId: "" })}>
                <option value="central">Central</option>
                <option value="departmental">Departmental</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Target</label>
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value as "all" | "students" | "teachers" })}>
                <option value="all">All</option>
                <option value="students">Students Only</option>
                <option value="teachers">Teachers Only</option>
              </select>
            </div>
          </div>
          {form.scope === "departmental" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department *</label>
              <select
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              >
                <option value="">— Select department —</option>
                {depts.map((d) => (
                  <option key={d._id} value={d._id}>{d.code} — {d.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Attachment Link</label>
            <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={form.attachmentLink} onChange={(e) => setForm({ ...form, attachmentLink: e.target.value })} />
          </div>
          <div className="flex gap-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded" checked={form.isPinned} onChange={(e) => setForm({ ...form, isPinned: e.target.checked })} />
              <span className="text-sm font-medium text-slate-700">Pin Notice</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span className="text-sm font-medium text-slate-700">Active</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button isLoading={submitting} onClick={handleSave}>{editing ? "Update" : "Post"}</Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
