import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import connectDB from "@/lib/db";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Enrollment } from "@/models/Enrollment";
import { CourseSection } from "@/models/CourseSection";
import { Result } from "@/models/Result";
import { serializeDoc } from "@/lib/utils";
import ClassroomDetailClient from "./ClassroomDetailClient";

export const dynamic = "force-dynamic";

export default async function ClassroomPage() {
  const session = await auth();
  if (!session || session.user.role !== "student") redirect("/login");

  await connectDB();

  // Step 1 — get the exact section IDs this student is enrolled in
  const enrollments = await Enrollment.find({ studentId: session.user.id }).lean();

  const enrolledSectionIds = [
    ...new Set(
      enrollments
        .map((e) => e.courseOfferingId?.toString())
        .filter((id): id is string => Boolean(id))
    ),
  ];

  // Step 2 — fetch ONLY those specific sections (must have a teacher assigned)
  let offerings =
    enrolledSectionIds.length > 0
      ? await CourseSection.find({
          _id: { $in: enrolledSectionIds },
          isActive: true,
          teacherId: { $exists: true, $ne: null },
        })
          .populate("courseId", "code title credits description")
          .populate("teacherId", "name userId")
          .populate("departmentId", "name code")
          .lean()
      : [];

  // Step 3 — exclude offerings from semesters that already have published results
  // (handles stale DB data from before semester-cleanup was implemented)
  if (offerings.length > 0) {
    const combos = [...new Set(offerings.map((o) => `${o.semesterLabel}::${o.academicYear}`))];
    const completedCombos = new Set<string>();
    await Promise.all(
      combos.map(async (key) => {
        const [semLabel, acYear] = key.split("::");
        const exists = await Result.exists({ semesterLabel: semLabel, academicYear: acYear, isPublished: true });
        if (exists) completedCombos.add(key);
      })
    );
    offerings = offerings.filter((o) => !completedCombos.has(`${o.semesterLabel}::${o.academicYear}`));
  }

  return (
    <DashboardLayout role="student" title="Classrooms" breadcrumb="Home / Classrooms">
      {offerings.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-400 text-lg font-medium mb-2">No classrooms yet</p>
          <p className="text-slate-300 text-sm">You will see classrooms here once your registration is admitted.</p>
        </div>
      ) : (
        <ClassroomDetailClient offerings={serializeDoc(offerings)} />
      )}
    </DashboardLayout>
  );
}
