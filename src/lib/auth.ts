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
        if (!credentials?.userId || !credentials?.password || !credentials?.role) {
          return null;
        }

        await connectDB();

        const user = await User.findOne({
          userId: credentials.userId,
          role: credentials.role,
          isActive: true,
        }).lean();

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

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
