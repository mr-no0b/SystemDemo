import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Department } from "@/models/Department";
import { User } from "@/models/User";

export async function GET() {
  await connectDB();
  const depts = await Department.find()
    .populate("headId", "name userId")
    .lean();

  const teacherAdvisors = await User.find({ role: "teacher", isActive: true, departmentId: { $ne: null } })
    .select("name userId departmentId")
    .lean();

  const advisorsByDept = new Map<string, Array<{ _id: string; name: string; userId: string }>>();
  for (const teacher of teacherAdvisors) {
    const deptId = teacher.departmentId?.toString();
    if (!deptId) continue;
    if (!advisorsByDept.has(deptId)) advisorsByDept.set(deptId, []);
    advisorsByDept.get(deptId)!.push({
      _id: teacher._id.toString(),
      name: teacher.name,
      userId: teacher.userId,
    });
  }

  const enriched = depts.map((dept) => ({
    ...dept,
    advisorIds: (advisorsByDept.get(dept._id.toString()) ?? []).sort((left, right) =>
      left.userId.localeCompare(right.userId, undefined, { numeric: true })
    ),
  }));

  return NextResponse.json({ success: true, data: enriched });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const body = await req.json();
  const dept = await Department.create(body);
  return NextResponse.json({ success: true, data: dept }, { status: 201 });
}
