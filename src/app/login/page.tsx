"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { GraduationCap, Student, ChalkboardTeacher, ShieldCheck, ArrowRight, Eye, EyeSlash } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

type Role = "student" | "teacher" | "admin";

const roles: { id: Role; label: string; icon: React.ReactNode; placeholder: string; demoId: string; demoPassword: string }[] = [
  { id: "student", label: "Student", icon: <Student size={28} />, placeholder: "e.g. S1", demoId: "S1", demoPassword: "pass123" },
  { id: "teacher", label: "Teacher", icon: <ChalkboardTeacher size={28} />, placeholder: "e.g. T1", demoId: "T1", demoPassword: "pass123" },
  { id: "admin", label: "Admin", icon: <ShieldCheck size={28} />, placeholder: "e.g. admin", demoId: "admin", demoPassword: "admin123" },
];

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>("student");
  const [userId, setUserId] = useState("S1");
  const [password, setPassword] = useState("pass123");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    const r = roles.find((r) => r.id === role)!;
    setUserId(r.demoId);
    setPassword(r.demoPassword);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        userId: userId.trim(),
        password,
        role: selectedRole,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid credentials. Please check your ID and password.");
      } else {
        router.push(`/${selectedRole}`);
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "radial-gradient(circle at top right, #e0e7ff 0%, #f8fafc 40%)",
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-modal border border-slate-200 p-8">
        {/* Logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 text-white rounded-2xl mb-3 shadow-lg">
            <GraduationCap size={30} weight="bold" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">AcademiaOne</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to your portal</p>
        </div>

        {/* Role Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Select Role</label>
          <div className="grid grid-cols-3 gap-3">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => handleRoleSelect(role.id)}
                className={cn(
                  "flex flex-col items-center py-3 px-2 rounded-xl border-2 transition-all text-sm font-semibold gap-1.5 cursor-pointer",
                  selectedRole === role.id
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:bg-indigo-50/50"
                )}
              >
                <span className={selectedRole === role.id ? "text-indigo-600" : "text-slate-400"}>
                  {role.icon}
                </span>
                {role.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              University ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder={roles.find((r) => r.id === selectedRole)!.placeholder}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPass ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-sm mt-2"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <>
                Sign In <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Locked system — contact IT Department for access
        </p>
      </div>
    </div>
  );
}
