"use client";

import React, { useState } from "react";
import { MagnifyingGlass, Bell, List, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

interface HeaderProps {
  title: string;
  breadcrumb?: string;
}

export default function Header({ title, breadcrumb }: HeaderProps) {
  const [searchVal, setSearchVal] = useState("");
  const router = useRouter();

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
          {breadcrumb && (
            <p className="text-xs text-slate-400">{breadcrumb}</p>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <form
          onSubmit={handleSearch}
          className="relative hidden sm:flex items-center"
        >
          <MagnifyingGlass
            className="absolute left-3 text-slate-400"
            size={16}
          />
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Search..."
            className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl w-56 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
          {searchVal && (
            <button
              type="button"
              onClick={() => setSearchVal("")}
              className="absolute right-3 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </form>

        {/* Notifications */}
        <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        </button>
      </div>
    </header>
  );
}
