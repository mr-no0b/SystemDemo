import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    userId: string;
    role: "student" | "teacher" | "admin";
    departmentId?: string;
    currentSemester?: string;
  }
  interface Session {
    user: User & {
      name?: string | null;
      email?: string | null;
    };
  }
}

// JWT type is extended inside next-auth module above via the Session/User extension

export const SEMESTERS = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2", "4-1", "4-2"] as const;
export type SemesterLabel = typeof SEMESTERS[number];

export const GRADE_SCALE = [
  { min: 80, letter: "A+", point: 4.0 },
  { min: 75, letter: "A", point: 3.75 },
  { min: 70, letter: "A-", point: 3.5 },
  { min: 65, letter: "B+", point: 3.25 },
  { min: 60, letter: "B", point: 3.0 },
  { min: 55, letter: "B-", point: 2.75 },
  { min: 50, letter: "C+", point: 2.5 },
  { min: 45, letter: "C", point: 2.25 },
  { min: 40, letter: "D", point: 2.0 },
  { min: 0, letter: "F", point: 0.0 },
] as const;

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
