"use client";
import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner, EmptyState } from "@/components/ui/Spinner";
import { Student, FunnelSimple } from "@phosphor-icons/react";

type Advisee = {
  _id: string;
  name: string;
  userId: string;
  session: string;
  currentSemester: string;
  department: string;
  cgpa: number | null;
};

function cgpaColor(cgpa: number) {
  if (cgpa >= 3.5) return "text-emerald-600";
  if (cgpa >= 2.5) return "text-indigo-600";
  if (cgpa >= 2.0) return "text-amber-600";
  return "text-rose-600";
}

export default function AdviseeListPage() {
  const [advisees, setAdvisees] = useState<Advisee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSession, setFilterSession] = useState("all");
  const [filterSemester, setFilterSemester] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "cgpa">("name");

  useEffect(() => {
    fetch("/api/advisees")
      .then((r) => r.json())
      .then((d) => {
        setAdvisees(d.data ?? []);
        setLoading(false);
      });
  }, []);

  const sessions = useMemo(
    () =>
      [...new Set(advisees.map((a) => a.session).filter((s) => s && s !== "—"))].sort().reverse(),
    [advisees]
  );

  const semesters = useMemo(
    () =>
      [
        ...new Set(
          advisees.map((a) => a.currentSemester).filter((s) => s && s !== "—")
        ),
      ].sort((a, b) => Number(a) - Number(b)),
    [advisees]
  );

  const filtered = useMemo(() => {
    let list = advisees;
    if (filterSession !== "all") list = list.filter((a) => a.session === filterSession);
    if (filterSemester !== "all") list = list.filter((a) => a.currentSemester === filterSemester);
    if (sortBy === "cgpa")
      list = [...list].sort((a, b) => (b.cgpa ?? -1) - (a.cgpa ?? -1));
    return list;
  }, [advisees, filterSession, filterSemester, sortBy]);

  const avgCgpa = useMemo(() => {
    const withCgpa = filtered.filter((a) => a.cgpa !== null);
    if (!withCgpa.length) return null;
    return (withCgpa.reduce((s, a) => s + (a.cgpa ?? 0), 0) / withCgpa.length).toFixed(2);
  }, [filtered]);

  return (
    <DashboardLayout role="teacher" title="Advisees" breadcrumb="Home / Advisees">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-slate-800">My Advisees</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              Students under your academic advisorship
            </p>
          </div>
          <div className="flex gap-3">
            <div className="bg-indigo-50 rounded-2xl px-5 py-2.5 text-center min-w-[72px]">
              <p className="text-indigo-700 font-bold text-xl leading-none">{filtered.length}</p>
              <p className="text-indigo-400 text-xs mt-0.5">Students</p>
            </div>
            {avgCgpa !== null && (
              <div className="bg-emerald-50 rounded-2xl px-5 py-2.5 text-center min-w-[72px]">
                <p className="text-emerald-700 font-bold text-xl leading-none">{avgCgpa}</p>
                <p className="text-emerald-400 text-xs mt-0.5">Avg CGPA</p>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-1.5 text-slate-500">
              <FunnelSimple size={15} />
              <span className="text-sm font-medium">Filter:</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600 font-medium">Session</label>
              <select
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                value={filterSession}
                onChange={(e) => setFilterSession(e.target.value)}
              >
                <option value="all">All Sessions</option>
                {sessions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600 font-medium">Semester</label>
              <select
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value)}
              >
                <option value="all">All Semesters</option>
                {semesters.map((s) => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-sm text-slate-600 font-medium">Sort by</label>
              <select
                className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "name" | "cgpa")}
              >
                <option value="name">Name (A–Z)</option>
                <option value="cgpa">CGPA (High → Low)</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Advisee list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Student size={36} />}
            title="No advisees found"
            description={
              advisees.length === 0
                ? "No students are assigned to you as advisor yet"
                : "No students match the selected filters"
            }
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-10">
                      #
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Session
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Semester
                    </th>
                    <th className="text-right py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      CGPA
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => (
                    <tr
                      key={a._id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-3.5 px-3 text-slate-400 text-xs">{i + 1}</td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-indigo-600 font-bold text-xs">
                              {a.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{a.name}</p>
                            <p className="text-slate-400 text-xs">{a.department}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 font-mono text-xs">
                        {a.userId}
                      </td>
                      <td className="py-3.5 px-3">
                        <Badge variant="primary">{a.session}</Badge>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">
                        {a.currentSemester !== "—" ? `Sem ${a.currentSemester}` : "—"}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        {a.cgpa !== null ? (
                          <span className={`font-bold text-base ${cgpaColor(a.cgpa)}`}>
                            {a.cgpa.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
