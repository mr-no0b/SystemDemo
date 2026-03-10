"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, Warning, X, Info, XCircle } from "@phosphor-icons/react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: "2rem",
          right: "2rem",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            toast={t}
            onClose={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const icons = {
    success: <CheckCircle size={22} weight="fill" className="text-emerald-500" />,
    error: <XCircle size={22} weight="fill" className="text-red-500" />,
    warning: <Warning size={22} weight="fill" className="text-amber-500" />,
    info: <Info size={22} weight="fill" className="text-indigo-500" />,
  };

  const borders = {
    success: "border-l-emerald-500",
    error: "border-l-red-500",
    warning: "border-l-amber-500",
    info: "border-l-indigo-500",
  };

  return (
    <div
      className={`flex items-center gap-3 bg-white px-4 py-3 rounded-xl shadow-card-hover border border-border border-l-4 ${borders[toast.type]} min-w-[300px] max-w-[420px] animate-slide-in`}
    >
      {icons[toast.type]}
      <span className="flex-1 text-sm font-medium text-slate-700">{toast.message}</span>
      <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
        <X size={16} />
      </button>
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
