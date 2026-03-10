import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Registration } from "@/models/Registration";
import { Enrollment } from "@/models/Enrollment";
import { User } from "@/models/User";
import { CourseSection } from "@/models/CourseSection";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const reg = await Registration.findById(id)
    .populate("studentId", "name userId currentSemester")
    .populate({ path: "courseOfferingIds", populate: { path: "courseId", select: "code title credits" } })
    .lean();
  if (!reg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: reg });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const body = await req.json();
  const { action, rejectionReason } = body;
  const role = session.user.role;

  const reg = await Registration.findById(id);
  if (!reg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "advisor_approve" && role === "teacher" && reg.status === "pending_advisor") {
    // Only the advisor assigned to this registration may approve it
    if (!reg.advisorId || reg.advisorId.toString() !== session.user.id) {
      return NextResponse.json({ error: "You are not the assigned advisor for this registration" }, { status: 403 });
    }
    reg.status = "pending_head";
    reg.advisorApprovedAt = new Date();
    await reg.save();
    return NextResponse.json({ success: true, data: reg });
  }

  if (action === "head_approve" && role === "teacher" && reg.status === "pending_head") {
    reg.status = "payment_pending";
    reg.headId = session.user.id as unknown as typeof reg.headId;
    reg.headApprovedAt = new Date();
    await reg.save();
    return NextResponse.json({ success: true, data: reg });
  }

  if (action === "pay" && role === "student" && reg.status === "payment_pending") {
    // Auto-admit: payment directly triggers admission, no admin step needed
    reg.status = "admitted";
    reg.paymentCompletedAt = new Date();
    reg.adminAdmittedAt = new Date();
    await reg.save();

    // Resolve any TBA (no-teacher) section IDs to teacher-assigned counterparts
    const resolvedPayIds: unknown[] = [];
    for (const offeringId of reg.courseOfferingIds) {
      const sec = await CourseSection.findById(offeringId).lean() as { courseId: unknown; teacherId?: unknown } | null;
      if (sec && !sec.teacherId) {
        // Use the registration's academicYear/semesterLabel (not the TBA section's, which may have wrong back-fill year)
        const teacherSec = await CourseSection.findOne({
          courseId: sec.courseId,
          semesterLabel: reg.semesterLabel,
          academicYear: reg.academicYear,
          teacherId: { $exists: true, $ne: null },
          isActive: true,
        }).lean() as { _id: unknown } | null;
        resolvedPayIds.push(teacherSec ? teacherSec._id : offeringId);
      } else {
        resolvedPayIds.push(offeringId);
      }
    }
    reg.courseOfferingIds = resolvedPayIds as typeof reg.courseOfferingIds;
    await reg.save();

    // Create enrollments
    const payEnrollments = resolvedPayIds.map((offeringId: unknown) => ({
      studentId: reg.studentId,
      courseOfferingId: offeringId,
      semesterLabel: reg.semesterLabel,
      academicYear: reg.academicYear,
      registrationId: reg._id,
    }));
    await Enrollment.insertMany(payEnrollments, { ordered: false }).catch(() => {});

    // Update student's current semester
    await User.findByIdAndUpdate(reg.studentId, { currentSemester: reg.semesterLabel });

    const populated = await Registration.findById(reg._id)
      .populate({
        path: "courseOfferingIds",
        select: "courseId section teacherId semesterLabel",
        populate: [
          { path: "courseId", select: "code title credits" },
          { path: "teacherId", select: "name" },
        ],
      })
      .populate("advisorId", "name")
      .populate("headId", "name")
      .lean();

    return NextResponse.json({ success: true, data: populated });
  }

  if (action === "admit" && role === "admin" && (reg.status === "paid" || reg.status === "payment_pending")) {
    reg.status = "admitted";
    reg.adminAdmittedAt = new Date();
    reg.adminAdmittedBy = session.user.id as unknown as typeof reg.adminAdmittedBy;
    await reg.save();

    // Resolve any TBA (no-teacher) section IDs to teacher-assigned counterparts
    const resolvedAdmitIds: unknown[] = [];
    for (const offeringId of reg.courseOfferingIds) {
      const sec = await CourseSection.findById(offeringId).lean() as { courseId: unknown; teacherId?: unknown } | null;
      if (sec && !sec.teacherId) {
        // Use the registration's academicYear/semesterLabel (not the TBA section's, which may have wrong back-fill year)
        const teacherSec = await CourseSection.findOne({
          courseId: sec.courseId,
          semesterLabel: reg.semesterLabel,
          academicYear: reg.academicYear,
          teacherId: { $exists: true, $ne: null },
          isActive: true,
        }).lean() as { _id: unknown } | null;
        resolvedAdmitIds.push(teacherSec ? teacherSec._id : offeringId);
      } else {
        resolvedAdmitIds.push(offeringId);
      }
    }
    reg.courseOfferingIds = resolvedAdmitIds as typeof reg.courseOfferingIds;
    await reg.save();

    // Create enrollments
    const admitEnrollments = resolvedAdmitIds.map((offeringId: unknown) => ({
      studentId: reg.studentId,
      courseOfferingId: offeringId,
      semesterLabel: reg.semesterLabel,
      academicYear: reg.academicYear,
      registrationId: reg._id,
    }));
    await Enrollment.insertMany(admitEnrollments, { ordered: false }).catch(() => {});

    // Update student's current semester
    await User.findByIdAndUpdate(reg.studentId, { currentSemester: reg.semesterLabel });

    return NextResponse.json({ success: true, data: reg });
  }

  if (action === "reject" && (role === "teacher" || role === "admin")) {
    reg.status = "rejected";
    reg.rejectionReason = rejectionReason;
    await reg.save();
    return NextResponse.json({ success: true, data: reg });
  }

  return NextResponse.json({ error: "Invalid action or permission" }, { status: 400 });
}
