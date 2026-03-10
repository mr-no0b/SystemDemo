import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Public routes
  if (pathname === "/login" || pathname === "/" || pathname.startsWith("/api/auth")) {
    // Redirect logged-in users away from login
    if (session && pathname === "/login") {
      const role = session.user.role;
      return NextResponse.redirect(new URL(`/${role}`, req.url));
    }
    return NextResponse.next();
  }

  // Protected routes — must be logged in
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = session.user.role;

  // Role-based guards
  if (pathname.startsWith("/student") && role !== "student") {
    return NextResponse.redirect(new URL(`/${role}`, req.url));
  }
  if (pathname.startsWith("/teacher") && role !== "teacher") {
    return NextResponse.redirect(new URL(`/${role}`, req.url));
  }
  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL(`/${role}`, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)",
  ],
};
