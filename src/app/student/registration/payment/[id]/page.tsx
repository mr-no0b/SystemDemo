"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowSquareOut, CreditCard, LockKey, ShieldCheck } from "@phosphor-icons/react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";

type RegistrationDetails = {
  _id: string;
  semesterLabel: string;
  academicYear: string;
  status: string;
  billing?: {
    provider: "Stripe";
    currency: "BDT";
    takaPerCredit: number;
    totalCredits: number;
    tuitionAmount: number;
    totalAmount: number;
  };
  courseOfferingIds: Array<{
    _id: string;
    courseId?: {
      code: string;
      title: string;
      credits: number;
    };
  }>;
};

export default function RegistrationPaymentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [registration, setRegistration] = useState<RegistrationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRegistration() {
      setLoading(true);
      try {
        const res = await fetch(`/api/registrations/${params.id}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error ?? "Failed to load payment details");
        }

        if (cancelled) return;
        setRegistration(data.data);
      } catch (error) {
        if (cancelled) return;
        toast(error instanceof Error ? error.message : "Failed to load payment details", "error");
        router.replace("/student/registration");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRegistration();
    return () => {
      cancelled = true;
    };
  }, [params.id, router, toast]);

  useEffect(() => {
    const stripeSessionId = searchParams.get("stripe_session_id");
    const paymentState = searchParams.get("payment");

    if (paymentState === "cancelled") {
      toast("Stripe payment was cancelled.", "error");
      router.replace(`/student/registration/payment/${params.id}`);
      return;
    }

    if (!stripeSessionId) return;

    let cancelled = false;

    async function verifyStripePayment() {
      setVerifying(true);
      try {
        const res = await fetch("/api/payments/stripe/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: stripeSessionId }),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error ?? "Stripe payment verification failed");
        }

        if (!cancelled) {
          router.replace("/student/registration?payment=success");
        }
      } catch (error) {
        if (!cancelled) {
          toast(error instanceof Error ? error.message : "Stripe payment verification failed", "error");
          router.replace(`/student/registration/payment/${params.id}`);
        }
      } finally {
        if (!cancelled) setVerifying(false);
      }
    }

    verifyStripePayment();
    return () => {
      cancelled = true;
    };
  }, [params.id, router, searchParams, toast]);

  const paymentSummary = useMemo(() => {
    const groupedCourses = new Map<string, { code: string; title: string; credits: number }>();

    for (const offering of registration?.courseOfferingIds ?? []) {
      if (!offering.courseId?.code) continue;
      if (!groupedCourses.has(offering.courseId.code)) {
        groupedCourses.set(offering.courseId.code, {
          code: offering.courseId.code,
          title: offering.courseId.title,
          credits: offering.courseId.credits,
        });
      }
    }

    const courses = Array.from(groupedCourses.values());
    const credits =
      registration?.billing?.totalCredits ??
      courses.reduce((sum, course) => sum + course.credits, 0);
    const takaPerCredit = registration?.billing?.takaPerCredit ?? 2200;
    const tuition = registration?.billing?.tuitionAmount ?? Math.round(credits * takaPerCredit);

    return {
      courses,
      credits,
      takaPerCredit,
      tuition,
      total: registration?.billing?.totalAmount ?? tuition,
    };
  }, [registration]);

  async function completePayment() {
    if (!registration) return;
    setSubmitting(true);
    setPaymentError("");

    try {
      const res = await fetch("/api/payments/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: registration._id }),
      });
      const data = await res.json();

      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.error ?? "Failed to start Stripe Checkout");
      }

      window.location.assign(data.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start Stripe Checkout";
      setPaymentError(message);
      toast(message, "error");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="student" title="Online Payment" breadcrumb="Home / Registration / Payment">
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      </DashboardLayout>
    );
  }

  if (!registration) return null;

  return (
    <DashboardLayout role="student" title="Online Payment" breadcrumb="Home / Registration / Payment">
      <div className="max-w-4xl mx-auto grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
        <Card className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-indigo-500 font-semibold">Stripe Checkout</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-800">
                {verifying ? "Verifying Stripe Payment" : "Pay with Stripe"}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {verifying
                  ? "Please wait while Stripe confirms your payment and admission is finalized."
                  : `Complete your semester payment on Stripe to confirm admission for Semester ${registration.semesterLabel} (${registration.academicYear}).`}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <CreditCard size={24} weight="duotone" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Payment Processor</p>
              <p className="mt-2 text-sm font-semibold text-slate-700">Stripe hosted Checkout</p>
              <p className="mt-1 text-xs text-slate-500">You will be redirected to Stripe to complete payment.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Confirmation</p>
              <p className="mt-2 text-sm font-semibold text-slate-700">Verified by Stripe</p>
              <p className="mt-1 text-xs text-slate-500">Admission is completed only after Stripe reports a paid session.</p>
            </div>
          </div>

          <div className="rounded-3xl border border-indigo-100 bg-[linear-gradient(135deg,#eef2ff_0%,#ffffff_55%,#f8fafc_100%)] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-indigo-500 font-semibold">Secure Redirect</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">Stripe collects and processes the payment details.</p>
                <p className="mt-1 text-xs text-slate-500">AcademiaOne receives only the paid Checkout Session confirmation.</p>
              </div>
              <ArrowSquareOut size={24} className="text-indigo-600 shrink-0" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
              <ShieldCheck size={14} />
              256-bit SSL secure
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5">
              <LockKey size={14} />
              Stripe Checkout
            </span>
          </div>
        </Card>

        <Card className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400 font-semibold">Order Summary</p>
            <h3 className="mt-2 text-lg font-bold text-slate-800">Registration Confirmation</h3>
          </div>

          <div className="space-y-3">
            {paymentSummary.courses.map((course) => (
              <div key={course.code} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-700">{course.code}</p>
                  <p className="text-slate-500">{course.title}</p>
                </div>
                <span className="text-slate-500">{course.credits.toFixed(1)} cr</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>Rate per credit</span>
              <span>BDT {paymentSummary.takaPerCredit.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Tuition ({paymentSummary.credits.toFixed(1)} credits)</span>
              <span>BDT {paymentSummary.tuition.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 font-bold text-slate-800">
              <span>Total</span>
              <span>BDT {paymentSummary.total.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-3">
            {paymentError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                {paymentError}
              </div>
            )}
            <Button
              onClick={completePayment}
              isLoading={submitting || verifying}
              disabled={registration.status !== "payment_pending"}
              className="w-full justify-center"
            >
              Continue to Stripe
            </Button>
            <Link
              href="/student/registration"
              className="block text-center text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Cancel and go back
            </Link>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
