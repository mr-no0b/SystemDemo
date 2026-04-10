"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { IdentificationCard, DownloadSimple, Student } from "@phosphor-icons/react";

type StudentOption = {
  _id: string;
  name: string;
  userId: string;
  currentSemester?: string;
  session?: string;
  departmentId?: { _id: string; name: string; code: string } | null;
};

function parseStudentSerial(userId: string) {
  const match = userId.match(/^S(\d+)$/i);
  return match ? Number(match[1]) : null;
}

export default function AdminIdentityCardPage() {
  const { toast: addToast } = useToast();
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [fromSerial, setFromSerial] = useState("");
  const [toSerial, setToSerial] = useState("");

  useEffect(() => {
    async function loadStudents() {
      try {
        const res = await fetch("/api/admin/identity-cards/students");
        const data = await res.json();
        if (data.success) {
          setStudents(data.data ?? []);
        } else {
          addToast(data.error || "Failed to load student list.", "error");
        }
      } catch {
        addToast("Failed to load student list.", "error");
      } finally {
        setLoading(false);
      }
    }

    loadStudents();
  }, [addToast]);

  const studentSerials = useMemo(
    () => students.map((student) => parseStudentSerial(student.userId)).filter((value): value is number => value !== null),
    [students]
  );
  const minSerial = studentSerials.length > 0 ? Math.min(...studentSerials) : 1;
  const maxSerial = studentSerials.length > 0 ? Math.max(...studentSerials) : 1;
  const parsedFromSerial = fromSerial ? Number(fromSerial) : null;
  const parsedToSerial = toSerial ? Number(toSerial) : null;
  const selectedStudents = useMemo(() => {
    if (
      parsedFromSerial === null ||
      parsedToSerial === null ||
      Number.isNaN(parsedFromSerial) ||
      Number.isNaN(parsedToSerial) ||
      parsedFromSerial > parsedToSerial
    ) {
      return [];
    }

    return students.filter((student) => {
      const serial = parseStudentSerial(student.userId);
      return serial !== null && serial >= parsedFromSerial && serial <= parsedToSerial;
    });
  }, [students, parsedFromSerial, parsedToSerial]);

  const fromUserId = parsedFromSerial !== null && !Number.isNaN(parsedFromSerial) ? `S${parsedFromSerial}` : "";
  const toUserId = parsedToSerial !== null && !Number.isNaN(parsedToSerial) ? `S${parsedToSerial}` : "";

  async function handleDownload() {
    if (!fromSerial || !toSerial) {
      addToast("Please enter both the starting and ending student numbers.", "warning");
      return;
    }

    if (
      parsedFromSerial === null ||
      parsedToSerial === null ||
      Number.isNaN(parsedFromSerial) ||
      Number.isNaN(parsedToSerial) ||
      parsedFromSerial > parsedToSerial
    ) {
      addToast("Please choose a valid student range where the start comes before the end.", "warning");
      return;
    }

    if (selectedStudents.length === 0) {
      addToast("No students were found inside that range.", "warning");
      return;
    }

    setDownloading(true);

    try {
      const res = await fetch(`/api/admin/identity-cards/pdf?from=${encodeURIComponent(fromUserId)}&to=${encodeURIComponent(toUserId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to generate the PDF." }));
        addToast(data.error || "Failed to generate the PDF.", "error");
        setDownloading(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `student-id-cards-${fromUserId}-to-${toUserId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast("Failed to download the PDF.", "error");
    }

    setDownloading(false);
  }

  return (
    <DashboardLayout role="admin" title="Identity Card" breadcrumb="Home / Identity Card">
      <div className="max-w-4xl mx-auto space-y-4">
        <Card>
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
              <IdentificationCard size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Student ID Card PDF</h1>
              <p className="text-sm text-slate-500 mt-1">
                Choose a student ID range and download a PDF of identity cards for every student inside that range.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : students.length === 0 ? (
            <EmptyState icon={<Student size={32} />} title="No students available" />
          ) : (
            <div className="space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">From student</label>
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-300 focus-within:border-indigo-300">
                    <span className="px-3 py-2.5 bg-slate-50 border-r border-slate-200 text-sm font-semibold text-slate-500">S</span>
                    <input
                      type="number"
                      min={minSerial}
                      max={maxSerial}
                      step={1}
                      value={fromSerial}
                      onChange={(e) => setFromSerial(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm focus:outline-none"
                      placeholder={String(minSerial)}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Use the number field or its up/down arrows. Available range starts at S{minSerial}.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">To student</label>
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-300 focus-within:border-indigo-300">
                    <span className="px-3 py-2.5 bg-slate-50 border-r border-slate-200 text-sm font-semibold text-slate-500">S</span>
                    <input
                      type="number"
                      min={minSerial}
                      max={maxSerial}
                      step={1}
                      value={toSerial}
                      onChange={(e) => setToSerial(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm focus:outline-none"
                      placeholder={String(maxSerial)}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Available student numbers go up to S{maxSerial}.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Selection preview</p>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedStudents.length > 0
                    ? `${selectedStudents.length} student ID card${selectedStudents.length === 1 ? "" : "s"} will be included from ${fromUserId} to ${toUserId}.`
                    : "Choose a valid start and end range to prepare the PDF."}
                </p>
              </div>

              <div className="flex justify-end">
                <Button isLoading={downloading} onClick={handleDownload}>
                  <DownloadSimple size={15} className="mr-1" />
                  Download ID Card PDF
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
