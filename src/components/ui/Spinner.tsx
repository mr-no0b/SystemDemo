import React from "react";

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="animate-spin text-indigo-600"
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size={32} />
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-slate-300 mb-4 text-6xl">{icon}</div>}
      <h3 className="text-slate-600 font-semibold text-lg mb-1">{title}</h3>
      {description && (
        <p className="text-slate-400 text-sm max-w-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}
