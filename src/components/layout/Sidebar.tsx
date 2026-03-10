"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  GraduationCap,
  SquaresFour,
  NotePencil,
  Chalkboard,
  CheckCircle,
  ChartBar,
  Files,
  ChatsCircle,
  Flag,
  ChalkboardTeacher,
  UserCheck,
  CheckSquare,
  Megaphone,
  Users,
  Student,
  ShieldCheck,
  SignOut,
  Books,
  Trophy,
  Bell,
  ClipboardText,
  CalendarBlank,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavGroup {
  cat: string;
  items: NavItem[];
}

const iconProps = { size: 20, weight: "regular" as const };

const studentNav: NavGroup[] = [
  {
    cat: "Main",
    items: [
      { id: "dashboard", label: "Dashboard", href: "/student", icon: <SquaresFour {...iconProps} /> },
      { id: "registration", label: "Registration", href: "/student/registration", icon: <NotePencil {...iconProps} /> },
      { id: "classroom", label: "Classrooms", href: "/student/classroom", icon: <Chalkboard {...iconProps} /> },
    ],
  },
  {
    cat: "Academic",
    items: [
      { id: "attendance", label: "Attendance", href: "/student/attendance", icon: <CheckCircle {...iconProps} /> },
      { id: "results", label: "Results", href: "/student/results", icon: <ChartBar {...iconProps} /> },
      { id: "notes", label: "Notes & Books", href: "/student/notes", icon: <Files {...iconProps} /> },
    ],
  },
  {
    cat: "Community",
    items: [
      { id: "forum", label: "Forum", href: "/forum", icon: <ChatsCircle {...iconProps} /> },
      { id: "elections", label: "Elections", href: "/student/elections", icon: <Flag {...iconProps} /> },
      { id: "notices", label: "Notices", href: "/student/notices", icon: <Bell {...iconProps} /> },
    ],
  },
];

const teacherNav: NavGroup[] = [
  {
    cat: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", href: "/teacher", icon: <SquaresFour {...iconProps} /> },
    ],
  },
  {
    cat: "Teaching",
    items: [
      { id: "classroom", label: "Classrooms", href: "/teacher/classroom", icon: <Chalkboard {...iconProps} /> },
      { id: "attendance", label: "Attendance", href: "/teacher/attendance", icon: <UserCheck {...iconProps} /> },
      { id: "results", label: "Results", href: "/teacher/results", icon: <Trophy {...iconProps} /> },
      { id: "books", label: "Book Recs", href: "/teacher/books", icon: <Books {...iconProps} /> },
    ],
  },
  {
    cat: "Advisorship",
    items: [
      { id: "advisees", label: "Advisees", href: "/teacher/advisees", icon: <Student {...iconProps} /> },
    ],
  },
  {
    cat: "Administration",
    items: [
      { id: "registrations", label: "Registrations", href: "/teacher/registrations", icon: <ClipboardText {...iconProps} /> },
      { id: "forum", label: "Forum", href: "/forum", icon: <ChatsCircle {...iconProps} /> },
      { id: "elections", label: "Elections", href: "/teacher/elections", icon: <CheckSquare {...iconProps} /> },
      { id: "notices", label: "Notices", href: "/teacher/notices", icon: <Megaphone {...iconProps} /> },
    ],
  },
];

const adminNav: NavGroup[] = [
  {
    cat: "Control Panel",
    items: [
      { id: "dashboard", label: "Overview", href: "/admin", icon: <SquaresFour {...iconProps} /> },
      { id: "users", label: "Users", href: "/admin/users", icon: <Users {...iconProps} /> },
      { id: "admissions", label: "Admissions", href: "/admin/admissions", icon: <Student {...iconProps} /> },
    ],
  },
  {
    cat: "Setup",
    items: [
      { id: "sessions", label: "Sessions", href: "/admin/sessions", icon: <CalendarBlank {...iconProps} /> },
      { id: "departments", label: "Departments", href: "/admin/departments", icon: <ShieldCheck {...iconProps} /> },
      { id: "courses", label: "Courses", href: "/admin/courses", icon: <Books {...iconProps} /> },
    ],
  },
  {
    cat: "Content",
    items: [
      { id: "results", label: "Results", href: "/admin/results", icon: <Trophy {...iconProps} /> },
      { id: "notices", label: "Notices", href: "/admin/notices", icon: <Megaphone {...iconProps} /> },
    ],
  },
];

interface SidebarProps {
  role: "student" | "teacher" | "admin";
  userName: string;
  userId: string;
}

export default function Sidebar({ role, userName, userId }: SidebarProps) {
  const pathname = usePathname();

  const navConfig =
    role === "student" ? studentNav : role === "teacher" ? teacherNav : adminNav;

  const isActive = (href: string) => {
    if (href === "/student" || href === "/teacher" || href === "/admin") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <aside
      style={{ width: "var(--sidebar-width)", backgroundColor: "var(--sidebar-bg)" }}
      className="flex flex-col flex-shrink-0 h-screen sticky top-0"
    >
      {/* Brand */}
      <div
        className="flex items-center px-6 border-b border-slate-800"
        style={{ height: "var(--header-height)" }}
      >
        <Link href={`/${role}`} className="flex items-center gap-3 text-white no-underline">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <GraduationCap size={22} color="white" weight="bold" />
          </div>
          <span className="font-bold text-lg text-white">AcademiaOne</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navConfig.map((group) => (
          <div key={group.cat} className="mb-4">
            <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold px-3 mb-2 mt-2">
              {group.cat}
            </p>
            {group.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all no-underline",
                  isActive(item.href)
                    ? "bg-indigo-600 text-white shadow-[0_4px_6px_-1px_rgba(79,70,229,0.4)]"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-800">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] transition-colors cursor-pointer group">
          <div className="w-9 h-9 bg-indigo-700 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">{userName}</p>
            <p className="text-slate-500 text-xs">{userId}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-slate-500 hover:text-white transition-colors ml-auto"
            title="Sign out"
          >
            <SignOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
