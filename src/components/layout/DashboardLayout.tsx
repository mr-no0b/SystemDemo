"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { ToastProvider } from "@/components/ui/Toast";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: "student" | "teacher" | "admin";
  title?: string;
  breadcrumb?: string;
}

export function DashboardLayout({
  children,
  role,
  title = "Dashboard",
  breadcrumb,
}: DashboardLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && session.user.role !== role) {
      router.replace(`/${session.user.role}`);
    }
  }, [status, session, role, router]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-body)" }}>
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--bg-body)" }}>
        <Sidebar
          role={role}
          userName={session.user.name ?? "User"}
          userId={session.user.userId}
        />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header
            title={title}
            breadcrumb={breadcrumb ?? `Home / ${title}`}
          />
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
