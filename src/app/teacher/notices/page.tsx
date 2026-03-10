"use client";
import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Bell, Plus, Pencil, Trash, PushPin, Paperclip } from "@phosphor-icons/react";

type Notice = {
  _id: string;
  title: string;
  content: string;
  scope: "central" | "departmental";
  target: "all" | "students" | "teachers";
  isPinned: boolean;
  isActive: boolean;
  attachmentLink?: string;
  createdAt: string;
  publishedBy?: { _id: string; name: string };
};

const defaultForm = { title: "", content: "", scope: "departmental" as "central" | "departmental", target: "all" as "all" | "students" | "teachers", isPinned: false, attachmentLink: "" };

export default function TeacherNoticesPage() {
  const { toast: addToast } = useToast();
  const [activeTab, setActiveTab] = useState<"all" | "mine">("all");

  const [allNotices, setAllNotices] = useState<Notice[]>([]);
  const [myNotices, setMyNotices] = useState<Notice[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [loadingMine, setLoadingMine] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoadingAll(true);
    const res = await fetch("/api/notices");
    const d = await res.json();
    setAllNotices(d.data ?? []);
    setLoadingAll(false);
  }, []);

  const fetchMine = useCallback(async () => {
    setLoadingMine(true);
    const res = await fetch("/api/notices?mine=true");
    const d = await res.json();
    setMyNotices(d.data ?? []);
    setLoadingMine(false);
  }, []);

  useEffect(() => { fetchAll(); fetchMine(); }, [fetchAll, fetchMine]);

  function openEdit(n: Notice) {
    setEditing(n);
    setForm({ title: n.title, content: n.content, scope: n.scope, target: n.target, isPinned: n.isPinned, attachmentLink: n.attachmentLink ?? "" });
    setShowModal(true);
  }

  async function handleSave() {
    setSubmitting(true);
    const url = editing ? `/api/notices/${editing._id}` : "/api/notices";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json();
    if (d.success) {
      addToast(editing ? "Notice updated!" : "Notice posted!", "success");
      setShowModal(false);
      setEditing(null);
      setForm(defaultForm);
      fetchAll();
      fetchMine();
    } else addToast(d.error || "Failed", "error");
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this notice?")) return;
    const res = await fetch(`/api/notices/${id}`, { method: "DELETE" });
    const d = await res.json();
    if (d.success) {
      addToast("Deleted", "success");
      setMyNotices((p) => p.filter((n) => n._id !== id));
      setAllNotices((p) => p.filter((n) => n._id !== id));
    } else addToast(d.error || "Failed", "error");
  }

  function NoticeCard({ n, editable }: { n: Notice; editable?: boolean }) {
    return (
      <Card className={n.isPinned ? "border-indigo-200 bg-indigo-50/20" : ""}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {n.isPinned && <PushPin size={13} className="text-indigo-500" weight="fill" />}
              <h3 className="font-bold text-slate-800">{n.title}</h3>
              <Badge variant={n.scope === "central" ? "primary" : "purple"} className="capitalize">{n.scope}</Badge>
              <Badge variant="gray" className="capitalize">{n.target}</Badge>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed">{n.content}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
              <span>By {n.publishedBy?.name ?? "—"}</span>
              <span>{new Date(n.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {n.attachmentLink && (
              <a href={n.attachmentLink} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition" title="Attachment">
                <Paperclip size={15} />
              </a>
            )}
            {editable && (
              <>
                <button onClick={() => openEdit(n)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition"><Pencil size={15} /></button>
                <button onClick={() => handleDelete(n._id)} className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition"><Trash size={15} /></button>
              </>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <DashboardLayout role="teacher" title="Notices" breadcrumb="Home / Notices">
      <div className="max-w-3xl mx-auto">
        {/* Tabs + Post button */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-5 py-2 rounded-xl font-semibold text-sm transition ${
              activeTab === "all" ? "bg-indigo-600 text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Bell size={14} className="inline mr-1.5" />All Notices
          </button>
          <button
            onClick={() => setActiveTab("mine")}
            className={`px-5 py-2 rounded-xl font-semibold text-sm transition ${
              activeTab === "mine" ? "bg-indigo-600 text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            My Notices
          </button>
          <Button className="ml-auto" onClick={() => { setEditing(null); setForm(defaultForm); setShowModal(true); }}>
            <Plus size={15} className="mr-1" />Post Notice
          </Button>
        </div>

        {/* All Notices tab */}
        {activeTab === "all" && (
          loadingAll ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : allNotices.length === 0 ? (
            <EmptyState icon={<Bell size={32} />} title="No notices" description="No notices have been posted yet." />
          ) : (
            <div className="space-y-3">
              {allNotices.map((n) => <NoticeCard key={n._id} n={n} />)}
            </div>
          )
        )}

        {/* My Notices tab */}
        {activeTab === "mine" && (
          loadingMine ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : myNotices.length === 0 ? (
            <EmptyState icon={<Bell size={32} />} title="No notices posted" description="You haven't posted any notices yet." />
          ) : (
            <div className="space-y-3">
              {myNotices.map((n) => <NoticeCard key={n._id} n={n} editable />)}
            </div>
          )
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
              <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as "central" | "departmental" })}>
                <option value="departmental">Departmental</option>
                <option value="central">Central</option>
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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Attachment Link</label>
            <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" value={form.attachmentLink} onChange={(e) => setForm({ ...form, attachmentLink: e.target.value })} placeholder="https://..." />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded" checked={form.isPinned} onChange={(e) => setForm({ ...form, isPinned: e.target.checked })} />
            <span className="text-sm font-medium text-slate-700">Pin this notice</span>
          </label>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button isLoading={submitting} onClick={handleSave}>{editing ? "Update" : "Post"}</Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
