"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  BookOpen,
  Link as LinkIcon,
  Plus,
  UploadSimple,
  FileText,
  Tag,
  Chalkboard,
  ArrowSquareOut,
} from "@phosphor-icons/react";

type Note = {
  _id: string;
  title: string;
  description?: string;
  driveLink: string;
  semesterLabel: string;
  tags: string[];
  uploadedBy: { name: string; userId: string };
  createdAt: string;
};

type Section = {
  _id: string;
  courseId: { _id: string; code: string; title: string };
  semesterLabel: string;
  academicYear: string;
};

type Book = {
  _id: string;
  title: string;
  author?: string;
  link?: string;
  comment?: string;
  teacherId?: { name: string };
};

const defaultForm = { title: "", description: "", driveLink: "", tags: "" };

export default function StudentNotesPage() {
  const { toast: addToast } = useToast();
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"notes" | "books">("notes");

  // ── Notes state ──────────────────────────────────────────────────────────
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(defaultForm);

  // ── Books state ───────────────────────────────────────────────────────────
  const [sections, setSections] = useState<Section[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Section | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);

  // Fetch notes filtered by student's department
  useEffect(() => {
    if (!session?.user) return;
    const dept = session.user.departmentId ?? "";
    fetch(`/api/notes${dept ? `?dept=${dept}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        setNotes(d.data ?? []);
        setLoadingNotes(false);
      });
  }, [session]);

  // Fetch sections for book course sidebar (lazy, on first books tab open)
  useEffect(() => {
    if (activeTab !== "books" || sections.length > 0) return;
    setLoadingSections(true);
    fetch("/api/sections")
      .then((r) => r.json())
      .then((d) => {
        const raw: Section[] = d.data ?? [];
        // Deduplicate by courseId so each course appears once
        const seen = new Set<string>();
        const unique = raw.filter((s) => {
          const id = s.courseId._id;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        setSections(unique);
        setLoadingSections(false);
      });
  }, [activeTab, sections.length]);

  async function selectCourse(s: Section) {
    setSelectedCourse(s);
    setLoadingBooks(true);
    const res = await fetch(`/api/books?courseId=${s.courseId._id}`);
    const d = await res.json();
    setBooks(d.data ?? []);
    setLoadingBooks(false);
  }

  async function handleShare() {
    if (!form.title.trim() || !form.driveLink.trim()) {
      addToast("Title and Drive link are required", "error");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        driveLink: form.driveLink,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    });
    if (!res.ok && !res.headers.get("content-type")?.includes("application/json")) {
      addToast(`Server error (${res.status})`, "error");
      setSubmitting(false);
      return;
    }
    const d = await res.json();
    if (d.success) {
      setNotes((p) => [d.data, ...p]);
      setShowModal(false);
      setForm(defaultForm);
      addToast("Note shared!", "success");
    } else {
      addToast(d.error || "Failed to share", "error");
    }
    setSubmitting(false);
  }

  return (
    <DashboardLayout role="student" title="Notes & Books" breadcrumb="Home / Notes & Books">
      <div className="max-w-5xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setActiveTab("notes")}
            className={`px-5 py-2 rounded-xl font-semibold text-sm transition ${
              activeTab === "notes"
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <FileText size={15} className="inline mr-1.5" />
            Shared Notes
          </button>
          <button
            onClick={() => setActiveTab("books")}
            className={`px-5 py-2 rounded-xl font-semibold text-sm transition ${
              activeTab === "books"
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <BookOpen size={15} className="inline mr-1.5" />
            Book Recommendations
          </button>
          {activeTab === "notes" && (
            <Button size="sm" className="ml-auto" onClick={() => setShowModal(true)}>
              <Plus size={15} className="mr-1" />
              Share a Note
            </Button>
          )}
        </div>

        {/* ── Notes Tab ──────────────────────────────────────────────────── */}
        {activeTab === "notes" && (
          loadingNotes ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : notes.length === 0 ? (
            <EmptyState
              icon={<FileText size={36} />}
              title="No notes yet"
              description="Be the first to share a note with your classmates!"
            />
          ) : (
            <div className="space-y-3">
              {notes.map((n) => (
                <Card key={n._id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800">{n.title}</h3>
                      {n.description && (
                        <p className="text-slate-500 text-sm mt-0.5">{n.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                        <span>Semester {n.semesterLabel}</span>
                        <span>by {n.uploadedBy?.name}</span>
                        <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                      </div>
                      {n.tags.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {n.tags.map((t) => (
                            <span
                              key={t}
                              className="bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full font-medium"
                            >
                              <Tag size={11} className="inline mr-0.5" />
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <a href={n.driveLink} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <LinkIcon size={14} className="mr-1" />
                        Open
                      </Button>
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}

        {/* ── Books Tab ─────────────────────────────────────────────────── */}
        {activeTab === "books" && (
          <div className="grid lg:grid-cols-5 gap-5 min-h-[65vh]">
            {/* Left: course list */}
            <div className="lg:col-span-2 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Courses
              </h2>
              {loadingSections ? (
                <div className="flex justify-center py-10"><Spinner /></div>
              ) : sections.length === 0 ? (
                <EmptyState
                  icon={<Chalkboard size={32} />}
                  title="No courses"
                  description="No active courses available."
                />
              ) : (
                sections.map((s) => (
                  <button
                    key={s._id}
                    onClick={() => selectCourse(s)}
                    className={`w-full text-left rounded-2xl border p-4 transition ${
                      selectedCourse?.courseId._id === s.courseId._id
                        ? "border-indigo-400 bg-indigo-50/70 shadow-sm"
                        : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50/50"
                    }`}
                  >
                    <p className="font-mono font-bold text-indigo-600 text-xs">
                      {s.courseId.code}
                    </p>
                    <p className="font-semibold text-slate-800 text-sm mt-0.5">
                      {s.courseId.title}
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                      Sem {s.semesterLabel} · {s.academicYear}
                    </p>
                  </button>
                ))
              )}
            </div>

            {/* Right: books for selected course */}
            <div className="lg:col-span-3">
              {!selectedCourse ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-300 border border-dashed border-slate-200 rounded-2xl gap-3">
                  <BookOpen size={36} />
                  <p className="text-sm">Select a course to view book recommendations</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="font-mono font-bold text-indigo-600 text-sm">
                      {selectedCourse.courseId.code}
                    </p>
                    <h2 className="font-bold text-slate-800">{selectedCourse.courseId.title}</h2>
                  </div>
                  {loadingBooks ? (
                    <div className="flex justify-center py-10"><Spinner /></div>
                  ) : books.length === 0 ? (
                    <EmptyState
                      icon={<BookOpen size={32} />}
                      title="No books yet"
                      description="Your teacher hasn't recommended books for this course yet."
                    />
                  ) : (
                    <div className="space-y-3">
                      {books.map((b) => (
                        <Card key={b._id}>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800">{b.title}</p>
                            {b.author && (
                              <p className="text-slate-500 text-sm mt-0.5">by {b.author}</p>
                            )}
                            {b.teacherId?.name && (
                              <p className="text-slate-400 text-xs mt-1">
                                Recommended by {b.teacherId.name}
                              </p>
                            )}
                            {b.comment && (
                              <p className="text-slate-400 text-sm mt-2 italic">
                                &ldquo;{b.comment}&rdquo;
                              </p>
                            )}
                            {b.link && (
                              <a
                                href={b.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-indigo-600 text-xs font-medium mt-2 hover:underline"
                              >
                                <ArrowSquareOut size={13} /> Attached Link
                              </a>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Share Note Modal ───────────────────────────────────────────────── */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Share a Note"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Data Structures Notes – Chapter 5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of what's covered..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Google Drive Link *
            </label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={form.driveLink}
              onChange={(e) => setForm({ ...form, driveLink: e.target.value })}
              placeholder="https://drive.google.com/..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tags{" "}
              <span className="text-slate-400 font-normal">(comma-separated, optional)</span>
            </label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="algorithms, trees, exam"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button isLoading={submitting} onClick={handleShare}>
            <UploadSimple size={15} className="mr-1" />
            Share
          </Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
