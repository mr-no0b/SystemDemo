import React from "react";
import { cn } from "@/lib/cn";

type BadgeVariant = "primary" | "success" | "warning" | "danger" | "gray" | "blue" | "purple";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  primary: "bg-indigo-100 text-indigo-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  gray: "bg-slate-100 text-slate-600",
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
};

export function Badge({ variant = "gray", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function roleVariant(role: string): BadgeVariant {
  if (role === "student") return "primary";
  if (role === "teacher") return "warning";
  if (role === "admin") return "purple";
  return "gray";
}

export function statusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    active: "success",
    admitted: "success",
    good: "success",
    approved: "success",
    published: "success",
    paid: "success",
    present: "success",
    pending: "warning",
    pending_advisor: "warning",
    pending_head: "warning",
    payment_pending: "warning",
    draft: "gray",
    warning: "warning",
    late: "warning",
    upcoming: "blue",
    open: "success",
    rejected: "danger",
    absent: "danger",
    critical: "danger",
    closed: "gray",
    inactive: "gray",
    excused: "blue",
  };
  return map[status.toLowerCase()] ?? "gray";
}
