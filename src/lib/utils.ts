import { GRADE_SCALE } from "@/types";

export function getGrade(marks: number): { letter: string; point: number } {
  for (const grade of GRADE_SCALE) {
    if (marks >= grade.min) {
      return { letter: grade.letter, point: grade.point };
    }
  }
  return { letter: "F", point: 0 };
}

export function calculateGPA(
  courses: { credits: number; gradePoint: number }[]
): number {
  if (courses.length === 0) return 0;
  const totalQualityPoints = courses.reduce(
    (sum, c) => sum + c.credits * c.gradePoint,
    0
  );
  const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);
  if (totalCredits === 0) return 0;
  return Math.round((totalQualityPoints / totalCredits) * 100) / 100;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function timeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function getAttendanceStatus(percentage: number): {
  label: string;
  color: string;
} {
  if (percentage >= 70) return { label: "Good", color: "success" };
  if (percentage >= 65) return { label: "Warning", color: "warning" };
  return { label: "Critical", color: "danger" };
}

export function serializeDoc<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc));
}

export function generateUserId(role: "student" | "teacher" | "admin", n: number): string {
  const prefix = role === "student" ? "ST" : role === "teacher" ? "TE" : "AD";
  const year = new Date().getFullYear();
  return `${prefix}-${year}${String(n).padStart(3, "0")}`;
}

export const CURRENT_ACADEMIC_YEAR = "2024-25";
