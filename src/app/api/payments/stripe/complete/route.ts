import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { finalizeStripeRegistrationPayment } from "@/lib/registration-payment";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await req.json();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
    const registrationId = checkoutSession.metadata?.registrationId;
    const studentId = checkoutSession.metadata?.studentId;
    const amountTaka = Number(checkoutSession.metadata?.amountTaka);

    if (!registrationId || !studentId) {
      return NextResponse.json({ error: "Stripe session is missing registration metadata" }, { status: 400 });
    }
    if (studentId !== session.user.id) {
      return NextResponse.json({ error: "Stripe session does not belong to this student" }, { status: 403 });
    }
    if (checkoutSession.payment_status !== "paid") {
      return NextResponse.json({ error: "Stripe payment has not completed yet" }, { status: 400 });
    }

    await connectDB();
    const registration = await finalizeStripeRegistrationPayment({
      registrationId,
      studentId: session.user.id,
      checkoutSessionId: checkoutSession.id,
      amountTotal: checkoutSession.amount_total,
      amountTaka: Number.isFinite(amountTaka) ? amountTaka : undefined,
      currency: checkoutSession.currency,
    });

    return NextResponse.json({ success: true, data: registration });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify Stripe payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
