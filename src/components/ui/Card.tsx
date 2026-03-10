import React from "react";
import { cn } from "@/lib/cn";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, hover = false, onClick }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-slate-200 shadow-card p-6",
        hover && "transition-shadow hover:shadow-card-hover",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={cn("flex justify-between items-start mb-5", className)}>
      <div>
        <h3 className="font-semibold text-slate-800 text-lg">{title}</h3>
        {subtitle && <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: string; up: boolean };
  sub?: string;
  valueColor?: string;
}

export function StatCard({ label, value, icon, trend, sub, valueColor }: StatCardProps) {
  return (
    <Card hover>
      <div className="flex justify-between items-start mb-2">
        <p className="text-slate-500 text-sm font-semibold">{label}</p>
        {icon && (
          <div className="text-slate-400 text-xl">{icon}</div>
        )}
      </div>
      <p
        className={cn("text-3xl font-bold mt-2 mb-1", valueColor ?? "text-slate-800")}
      >
        {value}
      </p>
      {trend && (
        <p
          className={cn(
            "text-xs flex items-center gap-1",
            trend.up ? "text-emerald-600" : "text-red-500"
          )}
        >
          {trend.up ? "↑" : "↓"} {trend.value}
        </p>
      )}
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </Card>
  );
}
