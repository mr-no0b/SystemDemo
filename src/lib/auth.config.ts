import type { NextAuthConfig } from "next-auth";

// Lightweight auth config — no Node.js-only imports.
// Used by middleware (Edge runtime) for session/JWT reading only.
export const authConfig: NextAuthConfig = {
  providers: [], // providers only needed in the Node.js runtime (auth.ts)
  trustHost: true,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.userId = (user as { userId: string }).userId;
        token.role = (user as { role: string }).role;
        token.departmentId = (user as { departmentId?: string }).departmentId;
        token.currentSemester = (user as { currentSemester?: string }).currentSemester;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.userId = token.userId as string;
        session.user.role = token.role as "student" | "teacher" | "admin";
        session.user.departmentId = token.departmentId as string | undefined;
        session.user.currentSemester = token.currentSemester as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
