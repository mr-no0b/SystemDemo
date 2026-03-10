import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import connectDB from "@/lib/db";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/Card";
import { Card } from "@/components/ui/Card";
import { Badge, statusVariant } from "@/components/ui/Badge";
import { CourseSection } from "@/models/CourseSection";
import { Course } from "@/models/Course";
import { User } from "@/models/User";
import { Enrollment } from "@/models/Enrollment";
import { Assignment } from "@/models/Assignment";
import { Submission } from "@/models/Submission";
import { Notice } from "@/models/Notice";
import { Session } from "@/models/Session";
import { serializeDoc } from "@/lib/utils";
import { Books, Users, ClipboardText, Bell } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export default async function TeacherDashboard() {
  const session = await auth();
  if (!session || session.user.role !== "teacher") redirect("/login");
  await connectDB();

  // Only show courses from currently active academic sessions
  const activeSessions = await Session.find({ isActive: true }).select("year").lean();
  const activeYears = activeSessions.map((s) => s.year);

  const sections = await CourseSection.find({
    teacherId: session.user.id,
    isActive: true,
    academicYear: { $in: activeYears },
  }).populate("courseId", "title code credits").lean();

  const sectionIds = sections.map((o: Record<string, unknown>) => o._id);
  const [enrollmentCount, pendingSubmissions, recentNotices] = await Promise.all([
    Enrollment.countDocuments({ courseOfferingId: { $in: sectionIds } }),
    Submission.countDocuments({ assignmentId: { $in: await Assignment.find({ courseOfferingId: { $in: sectionIds } }).distinct("_id") }, gradedAt: null }),
    Notice.find({ publishedBy: session.user.id, isActive: true }).sort({ createdAt: -1 }).limit(3).lean(),
  ]);

  const serializedSections = serializeDoc(sections);
  const serializedNotices = serializeDoc(recentNotices);

  return (
    <DashboardLayout role="teacher" title="Dashboard" breadcrumb="Home">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome back, {session.user.name?.split(" ")[0]}! 👋</h1>
          <p className="text-slate-400 text-sm mt-1">Here&apos;s your teaching overview</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active Courses" value={sections.length} icon={<Books size={22} />} valueColor="text-indigo-600" />
          <StatCard label="Total Students" value={enrollmentCount} icon={<Users size={22} />} valueColor="text-emerald-600" />
          <StatCard label="Pending Grading" value={pendingSubmissions} icon={<ClipboardText size={22} />} valueColor="text-yellow-600" />
          <StatCard label="Notices Posted" value={serializedNotices.length} icon={<Bell size={22} />} valueColor="text-purple-600" />
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* My Courses */}
          <Card>
            <div className="font-bold text-slate-700 mb-3">My Courses</div>
            {serializedSections.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No assigned courses</p>
            ) : (
              <div className="space-y-3">
                {serializedSections.map((o: Record<string, unknown>) => {
                  const course = o.courseId as Record<string, unknown>;
                  return (
                    <div key={o._id as string} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{course.code as string} – {course.title as string}</p>
                        <p className="text-slate-400 text-xs">Sem {o.semesterLabel as string} · {o.academicYear as string}</p>
                      </div>
                      <Badge variant="primary">{course.credits as number} Cr</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Recent Notices */}
          <Card>
            <div className="font-bold text-slate-700 mb-3">My Recent Notices</div>
            {serializedNotices.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No notices posted yet</p>
            ) : (
              <div className="space-y-3">
                {serializedNotices.map((n: Record<string, unknown>) => (
                  <div key={n._id as string} className="py-2 border-b border-slate-50 last:border-0">
                    <p className="font-semibold text-slate-800 text-sm">{n.title as string}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{new Date(n.createdAt as string).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
