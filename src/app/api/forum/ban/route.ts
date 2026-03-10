import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { User } from "@/models/User";

// GET — if teacher + ?list=true: returns all banned students
//        otherwise: returns current user's ban status
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const list = new URL(req.url).searchParams.get("list");

  if (list === "true") {
    if (session.user.role !== "teacher") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const banned = await User.find({ role: "student", forumBanned: true })
      .select("name userId departmentId")
      .populate("departmentId", "code name")
      .lean();
    return NextResponse.json({ success: true, data: banned });
  }

  const user = await User.findById(session.user.id).select("forumBanned").lean();
  const banned = (user as { forumBanned?: boolean } | null)?.forumBanned === true;
  return NextResponse.json({ banned });
}

// POST — teacher bans or unbans a student
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { userId, banned } = await req.json();

  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const target = await User.findById(userId);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.role !== "student") {
    return NextResponse.json({ error: "Can only ban students" }, { status: 400 });
  }

  await User.findByIdAndUpdate(userId, { $set: { forumBanned: !!banned } });
  return NextResponse.json({ success: true, banned: !!banned, userId: String(userId) });
}
