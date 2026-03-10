import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Enrollment } from "@/models/Enrollment";
import { AttendanceRecord } from "@/models/AttendanceRecord";

// Get full attendance detail for a specific offering + student
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const offeringId = url.searchParams.get("offeringId");
  const studentId = session.user.role === "student" ? session.user.id : url.searchParams.get("studentId");

  if (!offeringId) return NextResponse.json({ error: "offeringId required" }, { status: 400 });

  const records = await AttendanceRecord.find({ courseOfferingId: offeringId })
    .sort({ lectureNumber: 1 })
    .lean();

  const detail = records.map((r) => {
    const entry = r.records.find((e: { studentId: { toString(): string }; status: string; remark?: string }) => e.studentId.toString() === studentId);
    return {
      date: r.date,
      lectureNumber: r.lectureNumber,
      status: entry?.status ?? "absent",
      remark: entry?.remark,
    };
  });

  const present = detail.filter((d) => d.status === "present" || d.status === "late").length;
  const total = detail.length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

  return NextResponse.json({
    success: true,
    data: { detail, summary: { present, total, percentage } },
  });
}
