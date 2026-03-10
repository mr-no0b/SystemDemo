"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  ChatCircle, MagnifyingGlass, Plus, Tag, Clock, Eye, CheckCircle, Prohibit, X,
} from "@phosphor-icons/react";
import { timeAgo } from "@/lib/utils";

type Post = {
  _id: string;
  title: string;
  body: string;
  tags: string[];
  upvotes: string[];
  downvotes: string[];
  views: number;
  answerCount: number;
  acceptedAnswerId?: string;
  authorId: { name: string; userId: string; role: string };
  createdAt: string;
};

const ROLE_BADGE: Record<string, string> = {
  teacher: "bg-amber-100 text-amber-700",
  student: "bg-indigo-50 text-indigo-600",
  admin:   "bg-rose-50 text-rose-600",
};

type BannedStudent = { _id: string; name: string; userId: string; departmentId?: { code: string; name: string } | string };

export default function ForumPage() {
  const { data: session } = useSession();
  const role = (session?.user?.role ?? "student") as "student" | "teacher" | "admin";
  const router = useRouter();
  const { toast: addToast } = useToast();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "votes" | "unanswered">("newest");
  const [showAsk, setShowAsk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", tags: "" });
  const [isBanned, setIsBanned] = useState(false);
  const [showBanList, setShowBanList] = useState(false);
  const [bannedStudents, setBannedStudents] = useState<BannedStudent[]>([]);
  const [banListLoading, setBanListLoading] = useState(false);

  useEffect(() => {
    if (session?.user?.role === "student") {
      fetch("/api/forum/ban").then(r => r.json()).then(d => setIsBanned(d.banned ?? false));
    }
  }, [session?.user?.role]);

  async function fetchBannedList() {
    setBanListLoading(true);
    const res = await fetch("/api/forum/ban?list=true");
    const d = await res.json();
    setBannedStudents(d.data ?? []);
    setBanListLoading(false);
  }

  function openBanList() {
    setShowBanList(true);
    fetchBannedList();
  }

  async function unbanStudent(userId: string) {
    const res = await fetch("/api/forum/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, banned: false }),
    });
    const d = await res.json();
    if (d.success) {
      addToast("Ban lifted", "success");
      setBannedStudents(prev => prev.filter(s => s._id !== userId));
    } else addToast(d.error || "Failed", "error");
  }

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("sort", sort);
    const res = await fetch(`/api/forum/posts?${params}`);
    const d = await res.json();
    setPosts(d.data ?? []);
    setLoading(false);
  }, [search, sort]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  async function handleAsk() {
    if (!form.title.trim() || !form.body.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/forum/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) }),
    });
    const d = await res.json();
    if (d.success) {
      addToast("Question posted!", "success");
      setShowAsk(false);
      setForm({ title: "", body: "", tags: "" });
      router.push(`/forum/${d.data._id}`);
    } else {
      addToast(d.error || "Failed to post", "error");
    }
    setSubmitting(false);
  }

  const voteScore = (p: Post) => (p.upvotes?.length ?? 0) - (p.downvotes?.length ?? 0);

  return (
    <DashboardLayout role={role} title="Q&A Forum" breadcrumb="Home / Forum">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Search questions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchPosts()}
            />
          </div>
          <div className="flex gap-2">
            {(["newest", "votes", "unanswered"] as const).map((s) => (
              <button key={s} onClick={() => setSort(s)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium capitalize transition ${sort === s ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                {s}
              </button>
            ))}
          </div>
          {isBanned ? (
            <span className="text-xs text-rose-500 font-medium bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl">Forum view-only (banned)</span>
          ) : (
            <Button onClick={() => setShowAsk(true)}><Plus size={15} className="mr-1" />Ask</Button>
          )}
          {role === "teacher" && (
            <Button variant="ghost" onClick={openBanList}>
              <Prohibit size={15} className="mr-1" />Manage Bans
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : posts.length === 0 ? (
          <EmptyState icon={<ChatCircle size={36} />} title="No questions yet" description="Be the first to ask!" />
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <Card key={p._id} className="hover:border-indigo-200 transition-all cursor-pointer" onClick={() => router.push(`/forum/${p._id}`)}>
                <div className="flex gap-4">
                  <div className="flex flex-col items-center text-center min-w-[52px]">
                    <div className={`text-lg font-bold ${voteScore(p) > 0 ? "text-emerald-600" : "text-slate-500"}`}>{voteScore(p)}</div>
                    <div className="text-xs text-slate-400">votes</div>
                    <div className="mt-2 text-sm font-semibold text-slate-600">{p.answerCount}</div>
                    <div className={`text-xs ${p.acceptedAnswerId ? "text-emerald-600" : "text-slate-400"}`}>
                      {p.acceptedAnswerId ? <CheckCircle size={14} className="inline" /> : null} ans
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 hover:text-indigo-600 transition">{p.title}</h3>
                    <p className="text-slate-500 text-sm mt-1 line-clamp-2">{p.body}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {p.tags.map((t) => (
                        <span key={t} className="bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full font-medium">
                          <Tag size={10} className="inline mr-0.5" />{t}
                        </span>
                      ))}
                      <span className="ml-auto text-xs text-slate-400 flex items-center gap-1.5">
                        <Eye size={12} />{p.views}
                        <Clock size={12} className="ml-1" />{timeAgo(p.createdAt)}
                        <span className="ml-1">· {p.authorId?.name}</span>
                        {p.authorId?.role && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${ROLE_BADGE[p.authorId.role] ?? "bg-slate-100 text-slate-500"}`}>
                            {p.authorId.role}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showBanList} onClose={() => setShowBanList(false)} title="Banned Students" maxWidth="md">
        {banListLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : bannedStudents.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Prohibit size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No students are currently banned from the forum.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {bannedStudents.map((s) => (
              <div key={s._id} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-400">
                    {s.userId}
                    {s.departmentId && typeof s.departmentId === "object" && (
                      <span className="ml-1.5 text-indigo-500 font-medium">{s.departmentId.code}</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => unbanStudent(s._id)}
                  className="flex items-center gap-1 text-xs font-medium text-rose-500 hover:text-emerald-600 border border-rose-200 hover:border-emerald-300 px-2.5 py-1.5 rounded-lg transition"
                >
                  <X size={12} /> Lift Ban
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-4">
          <Button variant="ghost" onClick={() => setShowBanList(false)}>Close</Button>
        </div>
      </Modal>

      <Modal isOpen={showAsk} onClose={() => setShowAsk(false)} title="Ask a Question" maxWidth="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Question Title *</label>
            <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="What is your question? Be specific." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Details *</label>
            <textarea rows={5} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Provide all details needed to answer your question..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tags (comma-separated)</label>
            <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="e.g. algorithms, homework, exam" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowAsk(false)}>Cancel</Button>
          <Button isLoading={submitting} onClick={handleAsk}>Post Question</Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
