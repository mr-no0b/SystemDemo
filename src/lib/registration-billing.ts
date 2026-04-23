import { RegistrationWindow } from "@/models/RegistrationWindow";

export const DEFAULT_TAKA_PER_CREDIT = 2200;
export const STRIPE_MINIMUM_BDT_CHARGE = 70;

export type BillingCourseInput = {
  _id?: unknown;
  courseId?: {
    _id?: unknown;
    code?: string;
    title?: string;
    credits?: number;
  } | null;
};

export type RegistrationBillingInput = {
  semesterLabel: string;
  academicYear: string;
  courseOfferingIds?: BillingCourseInput[];
};

export type RegistrationBilling = {
  provider: "Stripe";
  currency: "BDT";
  takaPerCredit: number;
  totalCredits: number;
  tuitionAmount: number;
  totalAmount: number;
};

function normalizePositiveNumber(value: unknown, fallback: number) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : fallback;
}

export function calculateUniqueCredits(courseOfferingIds: BillingCourseInput[] = []) {
  const seenCourses = new Set<string>();
  let credits = 0;

  for (const offering of courseOfferingIds) {
    const course = offering.courseId;
    if (!course) continue;

    const key = String(course._id ?? course.code ?? offering._id);
    if (seenCourses.has(key)) continue;

    seenCourses.add(key);
    credits += normalizePositiveNumber(course.credits, 0);
  }

  return credits;
}

export function takaToStripeMinorUnits(takaAmount: number) {
  return Math.round(takaAmount * 100);
}

export function getStripeMinimumChargeMessage(totalAmount: number) {
  return `Stripe requires this payment to be at least BDT ${STRIPE_MINIMUM_BDT_CHARGE}. The current total is BDT ${totalAmount}. Increase the Taka per credit from the admin admission window.`;
}

export async function getWindowTakaPerCredit(semesterLabel: string, academicYear: string) {
  const window = (await RegistrationWindow.findOne({ semesterLabel, academicYear })
    .select("takaPerCredit")
    .lean()) as { takaPerCredit?: number } | null;

  return normalizePositiveNumber(window?.takaPerCredit, DEFAULT_TAKA_PER_CREDIT);
}

export async function buildRegistrationBilling(
  registration: RegistrationBillingInput
): Promise<RegistrationBilling> {
  const takaPerCredit = await getWindowTakaPerCredit(
    registration.semesterLabel,
    registration.academicYear
  );
  const totalCredits = calculateUniqueCredits(registration.courseOfferingIds);
  const tuitionAmount = Math.round(totalCredits * takaPerCredit);

  return {
    provider: "Stripe",
    currency: "BDT",
    takaPerCredit,
    totalCredits,
    tuitionAmount,
    totalAmount: tuitionAmount,
  };
}
