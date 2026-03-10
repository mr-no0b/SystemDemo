"use client";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { BookOpen, Plus, Trash, ArrowSquareOut, Chalkboard } from "@phosphor-icons/react";

type Offering = {
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

const defaultForm = { title: "", author: "", link: "", comment: "" };

export default function TeacherBooksPage() {
  const { toast: addToast } = useToast();

  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selected, setSelected] = useState<Offering | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sections?mine=true")
      .then((r) => r.json())
      .then((d) => { setOfferings(d.data ?? []); setLoadingOfferings(false); });
  }, []);

  async function selectOffering(o: Offering) {
    setSelected(o);
    setLoadingBooks(true);
    const res = await fetch(`/api/books?courseId=${o.courseId._id}`);
    const d = await res.json();
    setBooks(d.data ?? []);
    setLoadingBooks(false);
  }

  async function handleAdd() {
    if (!selected || !form.title.trim()) {
      addToast("Title is required", "error");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: selected.courseId._id, ...form }),
    });
    if (!res.ok && !res.headers.get("content-type")?.includes("application/json")) {
      addToast(`Server error (${res.status})`, "error");
      setSubmitting(false);
      return;
    }
    const d = await res.json();
    if (d.success) {
      setBooks((p) => [d.data, ...p]);
      setShowModal(false);
      setForm(defaultForm);
      addToast("Book added!", "success");
    } else addToast(d.error || "Failed", "error");
    setSubmitting(false);
  }

  async function handleDelete(bookId: string) {
    setDeleting(bookId);
    const res = await fetch(`/api/books/${bookId}`, { method: "DELETE" });
    const d = await res.json();
    if (d.success) {
      setBooks((p) => p.filter((b) => b._id !== bookId));
      addToast("Book removed.", "success");
    } else addToast(d.error || "Failed", "error");
    setDeleting(null);
  }

  // Deduplicate sidebar by courseId so multi-teacher courses appear once
  const seenCourseIds = new Set<string>();
  const uniqueOfferings = offerings.filter((o) => {
    if (seenCourseIds.has(o.courseId._id)) return false;
    seenCourseIds.add(o.courseId._id);
    return true;
  });

  return (
    <DashboardLayout role="teacher" title="Book Recommendations" breadcrumb="Home / Books">
      <div className="grid lg:grid-cols-5 gap-5 min-h-[70vh]">

        {/* Left: course list */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">My Courses</h2>
          {loadingOfferings ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : uniqueOfferings.length === 0 ? (
            <EmptyState icon={<Chalkboard size={32} />} title="No courses" description="You have no assigned courses." />
          ) : (
            uniqueOfferings.map((o) => (
              <button
                key={o._id}
                onClick={() => selectOffering(o)}
                className={`w-full text-left rounded-2xl border p-4 transition ${
                  selected?.courseId._id === o.courseId._id
                    ? "border-indigo-400 bg-indigo-50/70 shadow-sm"
                    : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50/50"
                }`}
              >
                <p className="font-mono font-bold text-indigo-600 text-xs">{o.courseId.code}</p>
                <p className="font-semibold text-slate-800 text-sm mt-0.5">{o.courseId.title}</p>
                <p className="text-slate-400 text-xs mt-1">Sem {o.semesterLabel} · {o.academicYear}</p>
              </button>
            ))
          )}
        </div>

        {/* Right: books */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-300 border border-dashed border-slate-200 rounded-2xl gap-3">
              <BookOpen size={36} />
              <p className="text-sm">Select a course to view book recommendations</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono font-bold text-indigo-600 text-sm">{selected.courseId.code}</p>
                  <h2 className="font-bold text-slate-800">{selected.courseId.title}</h2>
                </div>
                <Button size="sm" onClick={() => { setForm(defaultForm); setShowModal(true); }}>
                  <Plus size={14} className="mr-1" /> Add Book
                </Button>
              </div>

              {loadingBooks ? (
                <div className="flex justify-center py-10"><Spinner /></div>
              ) : books.length === 0 ? (
                <EmptyState icon={<BookOpen size={32} />} title="No books yet" description="Recommend books for this course." />
              ) : (
                <div className="space-y-3">
                  {books.map((b) => (
                    <Card key={b._id}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800">{b.title}</p>
                          {b.author && <p className="text-slate-500 text-sm mt-0.5">by {b.author}</p>}
                          {b.comment && (
                            <p className="text-slate-400 text-sm mt-1 italic">&ldquo;{b.comment}&rdquo;</p>
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
                        <button
                          onClick={() => handleDelete(b._id)}
                          disabled={deleting === b._id}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition flex-shrink-0"
                          title="Remove book"
                        >
                          {deleting === b._id ? <Spinner /> : <Trash size={15} />}
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Book Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Book Recommendation" maxWidth="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="e.g. Introduction to Algorithms"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Author</label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="e.g. Thomas H. Cormen"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PDF / Download Link</label>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="https://..."
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Comment <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="Why you recommend this book, which chapters are important, etc."
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button isLoading={submitting} onClick={handleAdd}>Add Book</Button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
