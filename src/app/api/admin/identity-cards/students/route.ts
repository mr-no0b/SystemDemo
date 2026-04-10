import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { User } from "@/models/User";

type StudentItem = {
  _id: string;
  name: string;
  userId: string;
  profileImage?: string;
  currentSemester?: string;
  session?: string;
  departmentId?: { _id: string; name: string; code: string } | null;
};

function compareStudentIds(left: string, right: string) {
  const leftSerial = Number(left.replace(/^S/i, ""));
  const rightSerial = Number(right.replace(/^S/i, ""));

  if (Number.isNaN(leftSerial) || Number.isNaN(rightSerial)) {
    return left.localeCompare(right, undefined, { numeric: true });
  }

  return leftSerial - rightSerial;
}

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const students = await User.find({ role: "student", userId: { $regex: /^S\d+$/ } })
    .select("name userId profileImage currentSemester session departmentId")
    .populate("departmentId", "name code")
    .lean();

  const sorted = (students as StudentItem[]).sort((left, right) => compareStudentIds(left.userId, right.userId));

  return NextResponse.json({ success: true, data: sorted });
}

export const runtime = "nodejs";
