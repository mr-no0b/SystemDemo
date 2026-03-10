import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import connectDB from "@/lib/db";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Result } from "@/models/Result";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { serializeDoc, calculateGPA, getGrade } from "@/lib/utils";
import { Trophy } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export default async function StudentResultsPage() {
  const session = await auth();
  if (!session || session.user.role !== "student") redirect("/login");

  await connectDB();
  const results = await Result.find({ studentId: session.user.id, isPublished: true })
    .sort({ semesterLabel: 1 })
    .lean();

  const serialized = serializeDoc(results);

  // Merge duplicate courseCode entries (one course taught by multiple teachers)
  type CourseEntry = { courseOfferingId: string; courseCode: string; courseTitle: string; credits: number; marks: number; gradePoint: number; gradeLetter: string };
  const mergedResults = serialized.map((r: Record<string, unknown>) => {
    const courses = r.courses as CourseEntry[];
    const mergeMap = new Map<string, { courseOfferingId: string; courseCode: string; courseTitle: string; credits: number; marksSum: number; count: number }>();
    for (const c of courses) {
      if (mergeMap.has(c.courseCode)) {
        mergeMap.get(c.courseCode)!.marksSum += c.marks;
        mergeMap.get(c.courseCode)!.count += 1;
      } else {
        mergeMap.set(c.courseCode, { courseOfferingId: c.courseOfferingId, courseCode: c.courseCode, courseTitle: c.courseTitle, credits: c.credits, marksSum: c.marks, count: 1 });
      }
    }
    const mergedCourses = Array.from(mergeMap.values()).map(({ marksSum, count, ...rest }) => {
      const avgMarks = Math.round(marksSum / count);
      const grade = getGrade(avgMarks);
      return { ...rest, marks: avgMarks, gradePoint: grade.point, gradeLetter: grade.letter };
    });
    const semesterGPA = calculateGPA(mergedCourses);
    return { ...r, courses: mergedCourses, semesterGPA };
  });

  // Recompute rolling CGPA with deduplicated courses
  let allPrior: { credits: number; gradePoint: number }[] = [];
  const deduplicated = mergedResults.map((r: Record<string, unknown>) => {
    allPrior = [...allPrior, ...(r.courses as { credits: number; gradePoint: number }[])];
    return { ...r, cgpa: calculateGPA(allPrior) };
  });

  const latestCGPA = deduplicated.length > 0 ? deduplicated[deduplicated.length - 1].cgpa : null;

  return (
    <DashboardLayout role="student" title="Results" breadcrumb="Home / Results">
      <div className="max-w-4xl mx-auto space-y-5">
        {latestCGPA !== null && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
            <div className="bg-indigo-600 text-white rounded-2xl p-5 text-center">
              <p className="text-indigo-200 text-sm font-medium mb-1">Current CGPA</p>
              <p className="text-4xl font-bold">{latestCGPA.toFixed(2)}</p>
              <p className="text-indigo-300 text-xs mt-1">out of 4.00</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center">
              <p className="text-slate-400 text-sm font-medium mb-1">Semesters Completed</p>
              <p className="text-4xl font-bold text-slate-800">{deduplicated.length}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center">
              <p className="text-slate-400 text-sm font-medium mb-1">Best Rank</p>
              <p className="text-4xl font-bold text-emerald-600">
                {deduplicated.reduce((best: number, r: Record<string, unknown>) => Math.min(best, (r.departmentRank as number) ?? 9999), 9999) === 9999 ? "N/A" : `#${deduplicated.reduce((best: number, r: Record<string, unknown>) => Math.min(best, (r.departmentRank as number) ?? 9999), 9999)}`}
              </p>
            </div>
          </div>
        )}

        {deduplicated.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <Trophy size={40} className="mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400">No published results yet</p>
            </div>
          </Card>
        ) : (
          deduplicated.map((r: Record<string, unknown>) => (
            <Card key={r._id as string}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Semester {r.semesterLabel as string}</h3>
                  <p className="text-slate-400 text-sm">{r.academicYear as string}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-indigo-600">{(r.semesterGPA as number).toFixed(2)}</p>
                  <p className="text-xs text-slate-400">Semester GPA</p>
                  {r.departmentRank != null && <Badge variant="success" className="mt-1">Rank #{r.departmentRank as number}</Badge>}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 px-3 text-xs uppercase text-slate-400 font-semibold">Course</th>
                      <th className="text-left py-2 px-3 text-xs uppercase text-slate-400 font-semibold">Credits</th>
                      <th className="text-left py-2 px-3 text-xs uppercase text-slate-400 font-semibold">Marks</th>
                      <th className="text-left py-2 px-3 text-xs uppercase text-slate-400 font-semibold">Grade</th>
                      <th className="text-left py-2 px-3 text-xs uppercase text-slate-400 font-semibold">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(r.courses as Record<string, unknown>[]).map((c, ci) => (
                      <tr key={ci} className="border-b border-slate-50">
                        <td className="py-2.5 px-3 text-sm">
                          <span className="font-semibold text-slate-700">{c.courseCode as string}</span>
                          <span className="text-slate-400 ml-2 text-xs">{c.courseTitle as string}</span>
                        </td>
                        <td className="py-2.5 px-3 text-sm text-slate-500">{c.credits as number}</td>
                        <td className="py-2.5 px-3 text-sm text-slate-600">{c.marks as number}</td>
                        <td className="py-2.5 px-3">
                          <Badge variant={c.gradeLetter === "F" ? "danger" : c.gradePoint as number >= 3.5 ? "success" : "warning"}>
                            {c.gradeLetter as string}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-sm font-semibold text-slate-700">{(c.gradePoint as number).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50">
                      <td colSpan={2} className="py-2.5 px-3 text-sm font-bold text-slate-700">Semester GPA</td>
                      <td colSpan={3} className="py-2.5 px-3 text-sm font-bold text-indigo-600">{(r.semesterGPA as number).toFixed(2)} / 4.00 · CGPA: {(r.cgpa as number).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
