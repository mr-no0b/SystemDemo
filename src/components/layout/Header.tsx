"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { MagnifyingGlass, Bell, X, Trash, Check } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

interface HeaderProps {
  title: string;
  breadcrumb?: string;
}

export default function Header({ title, breadcrumb }: HeaderProps) {
  const [searchVal, setSearchVal] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.data ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleBellClick = async () => {
    setOpen((v) => !v);
    if (!open && unreadCount > 0) {
      await fetch("/api/notifications", { method: "PATCH" });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  };

  const handleClearAll = async () => {
    await fetch("/api/notifications", { method: "DELETE" });
    setNotifications([]);
    setUnreadCount(0);
  };

  const handleNotificationClick = (n: Notification) => {
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const typeIcon: Record<string, string> = {
    registration: "📋",
    notice: "📢",
    announcement: "📌",
    election: "🗳️",
    result: "🎓",
    general: "🔔",
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      router.push(`/student/forum?q=${encodeURIComponent(searchVal)}`);
    }
  };

  return (
    <header
      className="flex items-center justify-between bg-white border-b border-slate-200 px-6 flex-shrink-0"
      style={{ height: "var(--header-height)" }}
    >
      {/* Left */}
      <div className="flex items-center gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          {breadcrumb && <p className="text-xs text-slate-400">{breadcrumb}</p>}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <form onSubmit={handleSearch} className="relative hidden sm:flex items-center">
          <MagnifyingGlass className="absolute left-3 text-slate-400" size={16} />
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Search..."
            className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl w-56 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
          {searchVal && (
            <button type="button" onClick={() => setSearchVal("")} className="absolute right-3 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </form>

        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handleBellClick}
            className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-12 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <span className="font-semibold text-slate-700 text-sm">Notifications</span>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                    >
                      <Trash size={13} />
                      Clear all
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Check size={32} className="mb-2 text-slate-300" />
                    <p className="text-sm">All caught up!</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n._id}
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors flex gap-3 ${!n.isRead ? "bg-indigo-50/60" : ""}`}
                    >
                      <span className="text-lg flex-shrink-0 mt-0.5">{typeIcon[n.type] ?? "🔔"}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium text-slate-700 truncate ${!n.isRead ? "font-semibold" : ""}`}>{n.title}</p>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(n.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {!n.isRead && <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0 mt-1.5" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
