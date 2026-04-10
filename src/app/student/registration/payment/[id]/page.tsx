"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CreditCard, LockKey, ShieldCheck } from "@phosphor-icons/react";
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
  const { toast } = useToast();

  const [registration, setRegistration] = useState<RegistrationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
    const credits = courses.reduce((sum, course) => sum + course.credits, 0);
    const tuition = credits * 2200;
    const semesterFee = 2500;
    const gatewayCharge = 35;

    return {
      courses,
      credits,
      tuition,
      semesterFee,
      gatewayCharge,
      total: tuition + semesterFee + gatewayCharge,
    };
  }, [registration]);

  async function completePayment() {
    if (!registration) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/registrations/${registration._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay" }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Payment failed");
      }

      router.replace("/student/registration?payment=success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Payment failed", "error");
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
              <p className="text-xs uppercase tracking-[0.28em] text-indigo-500 font-semibold">Dummy Gateway</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-800">AcademiaOne Secure Checkout</h2>
              <p className="mt-2 text-sm text-slate-500">
                Complete your semester payment to confirm admission for Semester {registration.semesterLabel} ({registration.academicYear}).
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <CreditCard size={24} weight="duotone" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Card Holder</p>
              <p className="mt-2 text-sm font-semibold text-slate-700">Student Demo Account</p>
              <p className="mt-1 text-xs text-slate-500">Use this mock gateway to simulate an online payment.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Payment Method</p>
              <p className="mt-2 text-sm font-semibold text-slate-700">Visa / MasterCard / Mobile Banking</p>
              <p className="mt-1 text-xs text-slate-500">No real transaction is processed in this demo flow.</p>
            </div>
          </div>

          <div className="rounded-3xl border border-indigo-100 bg-[linear-gradient(135deg,#eef2ff_0%,#ffffff_55%,#f8fafc_100%)] p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Card Number</span>
              <span className="font-medium text-slate-700">4242 4242 4242 4242</span>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-slate-500">Expiry</span>
              <span className="font-medium text-slate-700">12/29</span>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-slate-500">CVV</span>
              <span className="font-medium tracking-[0.3em] text-slate-700">123</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
              <ShieldCheck size={14} />
              256-bit SSL secure
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5">
              <LockKey size={14} />
              Sandbox payment
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
              <span>Tuition ({paymentSummary.credits.toFixed(1)} credits)</span>
              <span>BDT {paymentSummary.tuition.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Semester fee</span>
              <span>BDT {paymentSummary.semesterFee.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Gateway charge</span>
              <span>BDT {paymentSummary.gatewayCharge.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 font-bold text-slate-800">
              <span>Total</span>
              <span>BDT {paymentSummary.total.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button onClick={completePayment} isLoading={submitting} className="w-full justify-center">
              Pay Now
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
