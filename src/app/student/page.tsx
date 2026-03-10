import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import connectDB from "@/lib/db";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Enrollment } from "@/models/Enrollment";
import { CourseSection } from "@/models/CourseSection";
import { Course } from "@/models/Course";
import { User } from "@/models/User";
import { AttendanceRecord } from "@/models/AttendanceRecord";
import { Result } from "@/models/Result";
import { Notice } from "@/models/Notice";
import { Registration } from "@/models/Registration";
import { StatCard } from "@/components/ui/Card";
import { Badge, statusVariant } from "@/components/ui/Badge";
import { TrendUp, Users, BookOpen, Clock } from "@phosphor-icons/react/dist/ssr";
import { formatDate, serializeDoc } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getStudentDashboardData(userId: string, deptId?: string) {
  await connectDB();

  const [rawEnrollments, registration, latestResult, notices] = await Promise.all([
    Enrollment.find({ studentId: userId })
      .populate({ path: "courseOfferingId", populate: [{ path: "courseId", select: "code title credits" }, { path: "teacherId", select: "name" }] })
      .lean(),
    Registration.findOne({ studentId: userId }).sort({ createdAt: -1 }).lean(),
    Result.findOne({ studentId: userId, isPublished: true }).sort({ semesterLabel: -1 }).lean(),
    Notice.find({
      isActive: true,
      $or: [
        { scope: "central" },
        { scope: "departmental", departmentId: deptId ?? null },
      ],
    }).sort({ isPinned: -1, createdAt: -1 }).limit(5).lean(),
  ]);

  // Drop enrollments from semesters that already have published results
  const semCombos = [...new Set(rawEnrollments.map((e) => `${e.semesterLabel}::${e.academicYear}`))];
  const completedCombos = new Set<string>();
  await Promise.all(
    semCombos.map(async (key) => {
      const [semLabel, acYear] = key.split("::");
      const exists = await Result.exists({ semesterLabel: semLabel, academicYear: acYear, isPublished: true });
      if (exists) completedCombos.add(key);
    })
  );
  const enrollments = rawEnrollments.filter(
    (e) => !completedCombos.has(`${e.semesterLabel}::${e.academicYear}`)
  );

  // Attendance summary keyed by offeringId
  const offeringIds = enrollments.map((e) => (e.courseOfferingId as { _id: object })._id);
  const attendanceRecords = await AttendanceRecord.find({ courseOfferingId: { $in: offeringIds } }).lean();

  const attendanceSummary: Record<string, { present: number; plannedClasses: number }> = {};
  for (const en of enrollments) {
    const off = en.courseOfferingId as { _id: object; plannedClasses: number };
    const oid = off._id.toString();
    attendanceSummary[oid] = { present: 0, plannedClasses: off.plannedClasses ?? 40 };
  }
  for (const record of attendanceRecords) {
    const oid = record.courseOfferingId.toString();
    if (!attendanceSummary[oid]) continue;
    const entry = record.records.find((r: { studentId: { toString(): string }; status: string }) => r.studentId.toString() === userId);
    if (entry && (entry.status === "present" || entry.status === "late")) attendanceSummary[oid].present++;
  }

  const avgAttendance =
    offeringIds.length > 0
      ? Math.round(
          Object.values(attendanceSummary).reduce(
            (sum, a) => sum + (a.plannedClasses > 0 ? (a.present / a.plannedClasses) * 100 : 0),
            0
          ) / Math.max(offeringIds.length, 1)
        )
      : 0;

  return {
    enrollments: serializeDoc(enrollments),
    registration: serializeDoc(registration),
    latestResult: serializeDoc(latestResult),
    notices: serializeDoc(notices),
    avgAttendance,
    attendanceSummary: serializeDoc(attendanceSummary),
  };
}

export default async function StudentDashboard() {
  const session = await auth();
  if (!session || session.user.role !== "student") redirect("/login");

  const data = await getStudentDashboardData(session.user.id, session.user.departmentId);

  return (
    <DashboardLayout role="student" title="Dashboard" breadcrumb="Home / Overview">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        <StatCard
          label="Semester GPA"
          value={data.latestResult?.semesterGPA?.toFixed(2) ?? "N/A"}
          icon={<TrendUp size={22} />}
          valueColor="text-indigo-600"
          trend={data.latestResult ? { value: `Sem ${data.latestResult.semesterLabel}`, up: true } : undefined}
        />
        <StatCard
          label="Avg Attendance"
          value={`${data.avgAttendance}%`}
          icon={<Users size={22} />}
          valueColor={data.avgAttendance < 70 ? "text-red-500" : "text-slate-800"}
          sub={data.avgAttendance < 70 ? "⚠ Below 70% threshold" : "Good standing"}
        />
        <StatCard
          label="Enrolled Courses"
          value={data.enrollments.length}
          icon={<BookOpen size={22} />}
          sub={`Current semester`}
        />
        <StatCard
          label="Registration"
          value={data.registration?.status ? data.registration.status.replace(/_/g, " ").toUpperCase() : "None"}
          icon={<Clock size={22} />}
          valueColor={!data.registration ? "text-slate-400" : "text-amber-600"}
          sub={data.registration ? `Updated ${formatDate(data.registration.updatedAt)}` : "No active registration"}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Enrolled Courses */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-800">Enrolled Courses</h3>
            <Link href="/student/classroom" className="text-xs text-indigo-600 hover:underline">View All</Link>
          </div>
          {data.enrollments.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No enrolled courses yet</p>
          ) : (
            <div className="space-y-2">
              {data.enrollments.slice(0, 5).map((en: Record<string, unknown>) => {
                const offering = en.courseOfferingId as Record<string, unknown>;
                const course = offering?.courseId as Record<string, unknown>;
                const teacher = offering?.teacherId as Record<string, unknown>;
                const oid = (offering?._id as object)?.toString() ?? "";
                const att = data.attendanceSummary[oid] ?? { present: 0, total: 0 };
                const pct = att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;
                return (
                  <div key={en._id as string} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-indigo-700 text-xs font-bold">{String(course?.code ?? "").slice(0, 3)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{course?.title as string}</p>
                      <p className="text-xs text-slate-400">{teacher?.name as string}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${pct < 65 ? "text-red-500" : pct < 70 ? "text-amber-500" : "text-emerald-600"}`}>{pct}%</p>
                      <p className="text-xs text-slate-400">attendance</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Notices */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-800">Latest Notices</h3>
            <Link href="/student/notices" className="text-xs text-indigo-600 hover:underline">View All</Link>
          </div>
          {data.notices.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No notices</p>
          ) : (
            <div className="space-y-3">
              {data.notices.map((n: Record<string, unknown>) => (
                <div key={n._id as string} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-start mb-1">
                    <Badge variant={n.scope === "central" ? "primary" : "blue"}>{n.scope as string}</Badge>
                    <span className="text-xs text-slate-400">{formatDate(n.createdAt as string)}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-700">{n.title as string}</p>
                  {Boolean(n.isPinned) && <span className="text-xs text-amber-600 font-medium">📌 Pinned</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
