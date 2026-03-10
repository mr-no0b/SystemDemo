import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import connectDB from "@/lib/db";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/Card";
import { Card } from "@/components/ui/Card";
import { Badge, statusVariant } from "@/components/ui/Badge";
import { User } from "@/models/User";
import { Department } from "@/models/Department";
import { Course } from "@/models/Course";
import { Registration } from "@/models/Registration";
import { Notice } from "@/models/Notice";
import { serializeDoc } from "@/lib/utils";
import { Users, Buildings, Books, FileText, Bell, GraduationCap } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session || session.user.role !== "admin") redirect("/login");
  await connectDB();

  const [totalStudents, totalTeachers, totalDepts, totalCourses, pendingRegistrations, recentRegistrations] = await Promise.all([
    User.countDocuments({ role: "student", isActive: true }),
    User.countDocuments({ role: "teacher", isActive: true }),
    Department.countDocuments(),
    Course.countDocuments(),
    Registration.countDocuments({ status: { $in: ["pending_advisor", "pending_head", "payment_pending"] } }),
    Registration.find().sort({ createdAt: -1 }).limit(5).populate("studentId", "name userId").lean(),
  ]);

  const reg = serializeDoc(recentRegistrations);

  return (
    <DashboardLayout role="admin" title="Dashboard" breadcrumb="Home">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">System-wide overview</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Students" value={totalStudents} icon={<GraduationCap size={22} />} valueColor="text-indigo-600" />
          <StatCard label="Total Teachers" value={totalTeachers} icon={<Users size={22} />} valueColor="text-emerald-600" />
          <StatCard label="Departments" value={totalDepts} icon={<Buildings size={22} />} valueColor="text-purple-600" />
          <StatCard label="Courses" value={totalCourses} icon={<Books size={22} />} valueColor="text-orange-500" />
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-slate-700">Pending Registrations</p>
              <Badge variant="warning">{pendingRegistrations} pending</Badge>
            </div>
            {reg.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No recent registrations</p>
            ) : (
              <div className="space-y-3">
                {reg.map((r: Record<string, unknown>) => {
                  const student = r.studentId as Record<string, unknown>;
                  return (
                    <div key={r._id as string} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{student?.name as string}</p>
                        <p className="text-slate-400 text-xs">{student?.userId as string} · Sem {r.semesterLabel as string}</p>
                      </div>
                      <Badge variant={statusVariant(r.status as string)}>{(r.status as string).replace(/_/g, " ")}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <p className="font-bold text-slate-700 mb-4">Quick Links</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Manage Users", href: "/admin/users", icon: <Users size={18} /> },
                { label: "Admissions", href: "/admin/admissions", icon: <GraduationCap size={18} /> },
                { label: "Departments", href: "/admin/departments", icon: <Buildings size={18} /> },
                { label: "Courses", href: "/admin/courses", icon: <Books size={18} /> },
                { label: "Post Notice", href: "/admin/notices", icon: <Bell size={18} /> },
              ].map((link) => (
                <a key={link.href} href={link.href} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition group">
                  <span className="text-slate-400 group-hover:text-indigo-600 transition">{link.icon}</span>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-700 transition">{link.label}</span>
                </a>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
