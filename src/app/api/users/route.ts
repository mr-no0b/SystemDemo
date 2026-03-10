import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  const dept = url.searchParams.get("dept");
  const search = url.searchParams.get("search");

  const query: Record<string, unknown> = {};
  if (role) query.role = role;
  if (dept) query.departmentId = dept;
  if (search) query.$or = [
    { name: { $regex: search, $options: "i" } },
    { userId: { $regex: search, $options: "i" } },
  ];

  const users = await User.find(query)
    .select("-password")
    .populate("departmentId", "name code")
    .populate("advisorId", "name userId")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return NextResponse.json({ success: true, data: users });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const body = await req.json();
  const { userId, name, email, password, role, departmentId, advisorId, currentSemester, session: userSession } = body;

  if (!userId || !name || !password || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const existingId = await User.findOne({ userId });
  if (existingId) {
    return NextResponse.json({ error: "User ID already exists" }, { status: 409 });
  }

  if (email) {
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  const hashed = await bcrypt.hash(password, 12);
  try {
    const user = await User.create({
      userId,
      name,
      email: email || undefined,
      password: hashed,
      role,
      departmentId: departmentId || undefined,
      advisorId: advisorId || undefined,
      currentSemester: currentSemester || undefined,
      session: userSession || undefined,
    });
    const { password: _, ...userData } = user.toObject();
    return NextResponse.json({ success: true, data: userData }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 11000) {
      const keyValue = (err as { keyValue?: Record<string, unknown> })?.keyValue ?? {};
      const field = Object.keys(keyValue)[0] ?? "field";
      return NextResponse.json({ error: `Duplicate value for ${field}` }, { status: 409 });
    }
    throw err;
  }
}
