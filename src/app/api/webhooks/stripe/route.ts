import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import connectDB from "@/lib/db";
import { finalizeStripeRegistrationPayment } from "@/lib/registration-payment";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");

  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured" }, { status: 500 });
  }
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    const payload = await req.text();
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Stripe webhook payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const registrationId = checkoutSession.metadata?.registrationId;
    const studentId = checkoutSession.metadata?.studentId;
    const amountTaka = Number(checkoutSession.metadata?.amountTaka);

    if (checkoutSession.payment_status === "paid" && registrationId && studentId) {
      await connectDB();
      await finalizeStripeRegistrationPayment({
        registrationId,
        studentId,
        checkoutSessionId: checkoutSession.id,
        amountTotal: checkoutSession.amount_total,
        amountTaka: Number.isFinite(amountTaka) ? amountTaka : undefined,
        currency: checkoutSession.currency,
      });
    }
  }

  return NextResponse.json({ received: true });
}
