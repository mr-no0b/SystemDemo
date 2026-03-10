import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Result } from "@/models/Result";
import { User } from "@/models/User";
import { Enrollment } from "@/models/Enrollment";
import { CourseSection } from "@/models/CourseSection";
import { SEMESTERS } from "@/types";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const { action } = await req.json();
  
  if (action === "publish") {
    const result = await Result.findByIdAndUpdate(
      id,
      { $set: { isPublished: true, publishedBy: session.user.id, publishedAt: new Date() } },
      { new: true }
    );
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Compute department ranks for this semester
    const allForSem = await Result.find({
      departmentId: result.departmentId,
      semesterLabel: result.semesterLabel,
      academicYear: result.academicYear,
      isPublished: true,
    }).sort({ semesterGPA: -1 }).lean();

    const rankUpdates = allForSem.map((r, i) =>
      Result.findByIdAndUpdate(r._id, { departmentRank: i + 1 })
    );
    await Promise.all(rankUpdates);

    // Advance student's currentSemester to next semester
    const semIdx = SEMESTERS.indexOf(result.semesterLabel as typeof SEMESTERS[number]);
    if (semIdx >= 0 && semIdx < SEMESTERS.length - 1) {
      const nextSem = SEMESTERS[semIdx + 1];
      await User.findByIdAndUpdate(result.studentId, { currentSemester: nextSem });
    }

    // Deactivate sections where ALL enrolled students now have a published result
    // for this semester+year (meaning the section is fully complete)
    const studentEnrollments = await Enrollment.find({
      studentId: result.studentId,
      semesterLabel: result.semesterLabel,
      academicYear: result.academicYear,
    }).lean();

    await Promise.all(
      studentEnrollments.map(async (enr) => {
        const allStudentIds = await Enrollment.distinct("studentId", {
          courseOfferingId: enr.courseOfferingId,
        });
        const publishedCount = await Result.countDocuments({
          studentId: { $in: allStudentIds },
          semesterLabel: result.semesterLabel,
          academicYear: result.academicYear,
          isPublished: true,
        });
        if (publishedCount >= allStudentIds.length) {
          await CourseSection.findByIdAndUpdate(enr.courseOfferingId, { isActive: false });
        }
      })
    );

    return NextResponse.json({ success: true, data: result });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
