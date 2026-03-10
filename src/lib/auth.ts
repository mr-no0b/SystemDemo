import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { authConfig } from "@/lib/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        userId: { label: "User ID", type: "text" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" },
      },
      async authorize(credentials) {
      console.log('[auth] authorize called', { userId: credentials?.userId, role: credentials?.role });
      if (!credentials?.userId || !credentials?.password || !credentials?.role) {
        console.log('[auth] missing credentials');
        return null;
      }

      try {
        console.log('[auth] connecting to DB');
        await connectDB();
        console.log('[auth] connected to DB');
      } catch (e) {
        console.error('[auth] DB connection error', e);
        return null;
      }

      const user = await User.findOne({
        userId: credentials.userId,
        role: credentials.role,
        isActive: true,
      }).lean();

      if (!user) {
        console.log('[auth] user not found', { userId: credentials.userId, role: credentials.role });
        return null;
      }

      console.log('[auth] user found, verifying password for', user.userId);
      const isValid = await bcrypt.compare(credentials.password as string, user.password);

      if (!isValid) {
        console.log('[auth] invalid password for', credentials.userId);
        return null;
      }

      console.log('[auth] authentication successful for', user.userId);

      return {
          id: user._id.toString(),
          userId: user.userId,
          name: user.name,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId?.toString(),
          currentSemester: user.currentSemester,
        };
      },
    }),
  ],
});
