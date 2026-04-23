import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Registration } from "@/models/Registration";
import {
  buildRegistrationBilling,
  getStripeMinimumChargeMessage,
  STRIPE_MINIMUM_BDT_CHARGE,
  takaToStripeMinorUnits,
  type BillingCourseInput,
} from "@/lib/registration-billing";
import { getAppUrl, getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { registrationId } = await req.json();
  if (!registrationId) {
    return NextResponse.json({ error: "registrationId is required" }, { status: 400 });
  }

  const reg = await Registration.findById(registrationId)
    .populate("studentId", "name userId email")
    .populate({
      path: "courseOfferingIds",
      populate: { path: "courseId", select: "code title credits" },
    })
    .lean();

  if (!reg) return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  if (reg.studentId?._id?.toString() !== session.user.id) {
    return NextResponse.json({ error: "You can only pay for your own registration" }, { status: 403 });
  }
  if (reg.status !== "payment_pending") {
    return NextResponse.json({ error: "Registration is not awaiting payment" }, { status: 400 });
  }

  const billing = await buildRegistrationBilling({
    semesterLabel: reg.semesterLabel,
    academicYear: reg.academicYear,
    courseOfferingIds: reg.courseOfferingIds as BillingCourseInput[],
  });
  if (billing.totalAmount <= 0) {
    return NextResponse.json({ error: "No payable amount found for this registration" }, { status: 400 });
  }
  if (billing.totalAmount < STRIPE_MINIMUM_BDT_CHARGE) {
    return NextResponse.json(
      { error: getStripeMinimumChargeMessage(billing.totalAmount) },
      { status: 400 }
    );
  }

  const student = reg.studentId as {
    _id: unknown;
    name?: string;
    userId?: string;
    email?: string;
  };
  const metadata = {
    registrationId: reg._id.toString(),
    studentId: session.user.id,
    semesterLabel: reg.semesterLabel,
    academicYear: reg.academicYear,
    amountTaka: String(billing.totalAmount),
    takaPerCredit: String(billing.takaPerCredit),
    totalCredits: String(billing.totalCredits),
  };
  const appUrl = getAppUrl(req);

  try {
    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: reg._id.toString(),
        customer_email: student.email,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: billing.currency.toLowerCase(),
              product_data: {
                name: `Semester ${reg.semesterLabel} Registration`,
                description: `${billing.totalCredits} credits at BDT ${billing.takaPerCredit.toLocaleString()} per credit`,
              },
              unit_amount: takaToStripeMinorUnits(billing.totalAmount),
            },
            quantity: 1,
          },
        ],
        metadata,
        payment_intent_data: { metadata },
        success_url: `${appUrl}/student/registration/payment/${reg._id}?stripe_session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/student/registration/payment/${reg._id}?payment=cancelled`,
      },
      {
        idempotencyKey: `registration-${reg._id.toString()}-${billing.totalAmount}`,
      }
    );

    await Registration.findByIdAndUpdate(reg._id, {
      paymentProvider: "Stripe",
      paymentAmount: billing.totalAmount,
      paymentCurrency: billing.currency,
      paymentReference: checkoutSession.id,
    });

    return NextResponse.json({ success: true, url: checkoutSession.url });
  } catch (error) {
    const stripeError = error as { code?: string; message?: string };
    const message =
      stripeError.code === "amount_too_small"
        ? getStripeMinimumChargeMessage(billing.totalAmount)
        : stripeError.message ?? "Failed to create Stripe checkout session";
    const status = stripeError.code === "amount_too_small" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
