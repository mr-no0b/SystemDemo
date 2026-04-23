import { Registration } from "@/models/Registration";
import { Enrollment } from "@/models/Enrollment";
import { User } from "@/models/User";
import { CourseSection } from "@/models/CourseSection";
import { createNotification } from "@/lib/notify";
import { sendEmail, registrationStatusEmail } from "@/lib/email";
import {
  buildRegistrationBilling,
  takaToStripeMinorUnits,
  type BillingCourseInput,
} from "@/lib/registration-billing";

type FinalizeStripeRegistrationPaymentInput = {
  registrationId: string;
  studentId?: string;
  checkoutSessionId: string;
  amountTotal?: number | null;
  amountTaka?: number;
  currency?: string | null;
};

export async function finalizeStripeRegistrationPayment({
  registrationId,
  studentId,
  checkoutSessionId,
  amountTotal,
  amountTaka,
  currency,
}: FinalizeStripeRegistrationPaymentInput) {
  const reg = await Registration.findById(registrationId);
  if (!reg) throw new Error("Registration not found");

  if (studentId && reg.studentId.toString() !== studentId) {
    throw new Error("Stripe payment does not belong to this student");
  }

  if (reg.status !== "payment_pending" && reg.status !== "admitted") {
    throw new Error("Registration is not awaiting payment");
  }

  const billingRegistration = await Registration.findById(reg._id)
    .populate({
      path: "courseOfferingIds",
      populate: { path: "courseId", select: "code title credits" },
    })
    .lean();
  if (!billingRegistration) throw new Error("Registration not found");

  const billing = await buildRegistrationBilling({
    semesterLabel: billingRegistration.semesterLabel,
    academicYear: billingRegistration.academicYear,
    courseOfferingIds: billingRegistration.courseOfferingIds as BillingCourseInput[],
  });
  const expectedAmountTaka = amountTaka ?? reg.paymentAmount ?? billing.totalAmount;
  const expectedMinorAmount = takaToStripeMinorUnits(expectedAmountTaka);

  if (currency && currency.toLowerCase() !== "bdt") {
    throw new Error("Unexpected Stripe payment currency");
  }

  if (typeof amountTotal === "number" && amountTotal !== expectedMinorAmount) {
    throw new Error("Stripe payment amount does not match the registration bill");
  }

  const wasAlreadyAdmitted = reg.status === "admitted";

  reg.status = "admitted";
  reg.paymentCompletedAt = reg.paymentCompletedAt ?? new Date();
  reg.paymentProvider = "Stripe";
  reg.paymentAmount = expectedAmountTaka;
  reg.paymentCurrency = "BDT";
  reg.paymentReference = checkoutSessionId;
  reg.adminAdmittedAt = reg.adminAdmittedAt ?? new Date();
  await reg.save();

  const resolvedPayIds: unknown[] = [];
  for (const offeringId of reg.courseOfferingIds) {
    const sec = await CourseSection.findById(offeringId).lean() as {
      courseId: unknown;
      teacherId?: unknown;
    } | null;
    if (sec && !sec.teacherId) {
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

  const payEnrollments = resolvedPayIds.map((offeringId: unknown) => ({
    studentId: reg.studentId,
    courseOfferingId: offeringId,
    semesterLabel: reg.semesterLabel,
    academicYear: reg.academicYear,
    registrationId: reg._id,
  }));
  await Enrollment.insertMany(payEnrollments, { ordered: false }).catch(() => {});

  await User.findByIdAndUpdate(reg.studentId, { currentSemester: reg.semesterLabel });

  if (!wasAlreadyAdmitted) {
    const studentPay = await User.findById(reg.studentId).lean();
    if (studentPay) {
      await createNotification({
        userId: reg.studentId,
        title: "Enrollment Confirmed",
        message: `Your Stripe payment has been received and you have been enrolled for Semester ${reg.semesterLabel} (${reg.academicYear}).`,
        type: "registration",
        link: "/student",
      });
      if (studentPay.email) {
        await sendEmail({
          to: studentPay.email,
          subject: "Enrollment Confirmed",
          html: registrationStatusEmail({
            studentName: studentPay.name,
            status: "admitted",
            semesterLabel: reg.semesterLabel,
            academicYear: reg.academicYear,
          }),
        });
      }
    }
  }

  return Registration.findById(reg._id)
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
}
