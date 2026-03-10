"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { ArrowUp, ArrowDown, CheckCircle, ArrowLeft, Tag, Trash, Prohibit } from "@phosphor-icons/react";
import { timeAgo } from "@/lib/utils";

type Answer = {
  _id: string;
  body: string;
  upvotes: string[];
  downvotes: string[];
  isAccepted: boolean;
  authorId: { _id: string; name: string; userId: string; role: string; forumBanned?: boolean };
  createdAt: string;
};

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
  isClosed: boolean;
  authorId: { _id: string; name: string; userId: string; role: string; forumBanned?: boolean };
  createdAt: string;
  answers?: Answer[];
};

const ROLE_BADGE: Record<string, string> = {
  teacher: "bg-amber-100 text-amber-700",
  student: "bg-indigo-50 text-indigo-600",
  admin:   "bg-rose-50 text-rose-600",
};

export default function ForumPostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user?.role ?? "student") as "student" | "teacher" | "admin";
  const { toast: addToast } = useToast();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [answerBody, setAnswerBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const myId = session?.user?.id ?? "";

  useEffect(() => {
    fetch(`/api/forum/posts/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          // API returns { post, answers } — merge answers into post object
          const { post: postData, answers } = d.data as { post: Post; answers: Answer[] };
          setPost({ ...postData, answers: answers ?? [] });
        }
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (session?.user?.role === "student") {
      fetch("/api/forum/ban").then(r => r.json()).then(d => setIsBanned(d.banned ?? false));
    }
  }, [session?.user?.role]);

  async function vote(type: "post" | "answer", itemId: string, dir: "up" | "down") {
    const action = dir === "up" ? "upvote" : "downvote";
    if (type === "post") {
      const res = await fetch(`/api/forum/posts/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (d.success) {
        setPost((p) => p ? {
          ...p,
          upvotes: dir === "up" ? Array(d.upvotes).fill("") : p.upvotes,
        } : p);
        // Refetch to get accurate counts
        fetch(`/api/forum/posts/${id}`).then(r => r.json()).then(d => {
          if (d.data) {
            const { post: postData, answers } = d.data as { post: Post; answers: Answer[] };
            setPost({ ...postData, answers: answers ?? [] });
          }
        });
      } else addToast(d.error || "Vote failed", "error");
    } else {
      const action = dir === "up" ? "upvote" : "downvote";
      const res = await fetch("/api/forum/answers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, answerId: itemId }),
      });
      const d = await res.json();
      if (d.success) {
        // Update the specific answer's vote counts in-place
        setPost((p) => p ? {
          ...p,
          answers: p.answers?.map((a) =>
            a._id === itemId
              ? { ...a, upvotes: Array(d.upvotes).fill(""), downvotes: Array(d.downvotes).fill("") }
              : a
          ),
        } : p);
      } else addToast(d.error || "Vote failed", "error");
    }
  }

  async function acceptAnswer(answerId: string) {
    const res = await fetch("/api/forum/answers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", answerId, postId: id }),
    });
    const d = await res.json();
    if (d.success) {
      setPost((p) => p ? {
        ...p,
        acceptedAnswerId: answerId,
        answers: p.answers?.map((a) => ({ ...a, isAccepted: a._id === answerId })),
      } : p);
      addToast("Answer accepted!", "success");
    } else addToast(d.error || "Failed", "error");
  }

  async function postAnswer() {
    if (!answerBody.trim()) return;
    setPosting(true);
    const res = await fetch("/api/forum/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: id, body: answerBody }),
    });
    const d = await res.json();
    if (d.success) {
      setPost((p) => p ? { ...p, answerCount: p.answerCount + 1, answers: [...(p.answers ?? []), d.data] } : p);
      setAnswerBody("");
      addToast("Answer posted!", "success");
    } else addToast(d.error || "Failed", "error");
    setPosting(false);
  }

  async function deletePost() {
    if (!confirm("Delete this question and all its answers? This cannot be undone.")) return;
    const res = await fetch(`/api/forum/posts/${id}`, { method: "DELETE" });
    const d = await res.json();
    if (d.success) { addToast("Question deleted", "success"); router.push("/forum"); }
    else addToast(d.error || "Failed", "error");
  }

  async function deleteAnswer(answerId: string) {
    if (!confirm("Delete this answer?")) return;
    const res = await fetch(`/api/forum/answers?id=${answerId}`, { method: "DELETE" });
    const d = await res.json();
    if (d.success) {
      setPost(p => p ? { ...p, answerCount: p.answerCount - 1, answers: p.answers?.filter(a => a._id !== answerId) } : p);
      addToast("Answer deleted", "success");
    } else addToast(d.error || "Failed", "error");
  }

  async function toggleBan(authorMongoId: string, currentBanned: boolean) {
    const newBanned = !currentBanned;
    const res = await fetch("/api/forum/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: String(authorMongoId), banned: newBanned }),
    });
    const d = await res.json();
    if (d.success) {
      addToast(newBanned ? "Student banned from forum" : "Ban lifted", "success");
      // Refetch the post so forumBanned status is accurate from DB
      fetch(`/api/forum/posts/${id}`).then(r => r.json()).then(fresh => {
        if (fresh.data) {
          const { post: postData, answers } = fresh.data as { post: Post; answers: Answer[] };
          setPost({ ...postData, answers: answers ?? [] });
        }
      });
    } else {
      addToast(d.error || "Failed to update ban", "error");
    }
  }

  if (loading) return (
    <DashboardLayout role={role} title="Forum" breadcrumb="Home / Forum / ...">
      <div className="flex justify-center py-20"><Spinner /></div>
    </DashboardLayout>
  );
  if (!post) return null;

  const scorePost = (post.upvotes?.length ?? 0) - (post.downvotes?.length ?? 0);

  return (
    <DashboardLayout role={role} title="Forum" breadcrumb={`Home / Forum / ${post.title.slice(0, 40)}...`}>
      <div className="max-w-3xl mx-auto">
        <button onClick={() => router.push("/forum")} className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-600 text-sm mb-4 transition">
          <ArrowLeft size={14} /> Back to Forum
        </button>

        {/* Question */}
        <Card className="mb-5">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h1 className="text-xl font-bold text-slate-800">{post.title}</h1>
            <div className="flex items-center gap-1 flex-shrink-0">
              {role === "teacher" && post.authorId?.role === "student" && (
                <button
                  onClick={() => toggleBan(post.authorId._id, post.authorId.forumBanned ?? false)}
                  className={`p-1.5 rounded-lg transition ${post.authorId.forumBanned ? "text-rose-500 hover:bg-rose-50" : "text-slate-300 hover:bg-amber-50 hover:text-amber-500"}`}
                  title={post.authorId.forumBanned ? "Lift forum ban" : "Ban from forum"}
                >
                  <Prohibit size={15} />
                </button>
              )}
              {(myId === post.authorId?._id || role === "admin" || (role === "teacher" && post.authorId?.role === "student")) && (
                <button onClick={deletePost} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition" title="Delete question"><Trash size={15} /></button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400 mb-4 flex-wrap">
            <span>Asked {timeAgo(post.createdAt)}</span>
            <span className="flex items-center gap-1">
              by <span className="font-medium text-slate-600 ml-0.5">{post.authorId?.name}</span>
              {post.authorId?.role && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${ROLE_BADGE[post.authorId.role] ?? "bg-slate-100 text-slate-500"}`}>
                  {post.authorId.role}
                </span>
              )}
            </span>
            <span>{post.views} views</span>
            {post.isClosed && <Badge variant="danger">Closed</Badge>}
          </div>
          <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap mb-4">{post.body}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {post.tags.map((t) => (
              <span key={t} className="bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full font-medium">
                <Tag size={10} className="inline mr-0.5" />{t}
              </span>
            ))}
            {!isBanned && (
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => vote("post", post._id, "up")} className="p-1.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 text-slate-400 transition"><ArrowUp size={16} /></button>
                <span className={`text-sm font-semibold ${scorePost > 0 ? "text-emerald-600" : "text-slate-500"}`}>{scorePost}</span>
                {post.authorId?.role !== "teacher" && (
                  <button onClick={() => vote("post", post._id, "down")} className="p-1.5 rounded-lg hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition"><ArrowDown size={16} /></button>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Answers */}
        {(post.answers?.length ?? 0) > 0 && (
          <div className="mb-5">
            <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3">
              {post.answers?.length} Answer{post.answers?.length !== 1 ? "s" : ""}
            </h2>
            <div className="space-y-3">
              {post.answers?.map((a) => {
                const scoreA = (a.upvotes?.length ?? 0) - (a.downvotes?.length ?? 0);
                return (
                  <Card key={a._id} className={a.isAccepted ? "border-emerald-200 bg-emerald-50/30" : ""}>
                    {a.isAccepted && (
                      <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold mb-2">
                        <CheckCircle size={14} weight="fill" /> Accepted Answer
                      </div>
                    )}
                    <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap mb-3">{a.body}</p>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs text-slate-400 flex items-center gap-1.5">
                        {a.authorId?.name}
                        {a.authorId?.role && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${ROLE_BADGE[a.authorId.role] ?? "bg-slate-100 text-slate-500"}`}>
                            {a.authorId.role}
                          </span>
                        )}
                        · {timeAgo(a.createdAt)}
                      </span>
                      <div className="flex items-center gap-2">
                        {!post.acceptedAnswerId && !isBanned && (
                          <button onClick={() => acceptAnswer(a._id)} className="text-xs text-slate-400 hover:text-emerald-600 transition">✓ Accept</button>
                        )}
                        {!isBanned && (
                          <>
                            <button onClick={() => vote("answer", a._id, "up")} className="p-1 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 text-slate-400 transition"><ArrowUp size={14} /></button>
                            <span className={`text-xs font-semibold ${scoreA > 0 ? "text-emerald-600" : "text-slate-400"}`}>{scoreA}</span>
                            {a.authorId?.role !== "teacher" && (
                              <button onClick={() => vote("answer", a._id, "down")} className="p-1 rounded-lg hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition"><ArrowDown size={14} /></button>
                            )}
                          </>
                        )}
                        {(myId === a.authorId?._id || role === "admin" || (role === "teacher" && a.authorId?.role === "student")) && (
                          <button onClick={() => deleteAnswer(a._id)} className="p-1 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition" title="Delete answer"><Trash size={13} /></button>
                        )}
                        {role === "teacher" && a.authorId?.role === "student" && (
                          <button
                            onClick={() => toggleBan(a.authorId._id, a.authorId.forumBanned ?? false)}
                            className={`p-1 rounded-lg transition text-xs font-medium ${
                              a.authorId.forumBanned
                                ? "text-rose-500 hover:bg-rose-50"
                                : "text-slate-300 hover:bg-amber-50 hover:text-amber-500"
                            }`}
                            title={a.authorId.forumBanned ? "Lift ban" : "Ban from forum"}
                          >
                            <Prohibit size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Post Answer */}
        {!post.isClosed && (
          isBanned ? (
            <Card className="border-rose-200 bg-rose-50/30">
              <div className="flex items-center gap-2 text-rose-600 text-sm">
                <Prohibit size={18} weight="fill" />
                <span className="font-medium">You are banned from participating in this forum. It is view-only for you.</span>
              </div>
            </Card>
          ) : (
            <Card>
              <h2 className="text-sm font-bold text-slate-700 mb-3">Your Answer</h2>
              <textarea rows={5}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none mb-3"
                placeholder="Write a clear, concise answer..."
                value={answerBody}
                onChange={(e) => setAnswerBody(e.target.value)}
              />
              <div className="flex justify-end">
                <Button isLoading={posting} onClick={postAnswer}>Post Answer</Button>
              </div>
            </Card>
          )
        )}
      </div>
    </DashboardLayout>
  );
}
