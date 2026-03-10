import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { MarkEntry } from "@/models/MarkEntry";
import { ResultWindow } from "@/models/ResultWindow";
import { CourseSection } from "@/models/CourseSection";
import { Enrollment } from "@/models/Enrollment";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const windowId = url.searchParams.get("windowId");
  const offeringId = url.searchParams.get("offeringId");

  if (!windowId || !offeringId) {
    return NextResponse.json({ error: "windowId and offeringId are required" }, { status: 400 });
  }

  const entries = await MarkEntry.find({
    resultWindowId: windowId,
    courseOfferingId: offeringId,
  })
    .populate("studentId", "name userId")
    .lean();

  return NextResponse.json({ success: true, data: entries });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const body = await req.json();
  const { resultWindowId, offeringId, entries } = body as {
    resultWindowId: string;
    offeringId: string;
    entries: { studentId: string; achievedMarks: number; totalMarks: number }[];
  };

  if (!resultWindowId || !offeringId || !Array.isArray(entries)) {
    return NextResponse.json({ error: "resultWindowId, offeringId and entries are required" }, { status: 400 });
  }

  // Verify the result window is open
  const window = await ResultWindow.findById(resultWindowId);
  if (!window) return NextResponse.json({ error: "Result window not found" }, { status: 404 });
  if (!window.isOpen) return NextResponse.json({ error: "Result window is closed" }, { status: 400 });

  // Verify teacher owns this section
  const section = await CourseSection.findById(offeringId);
  if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });
  if (section.teacherId?.toString() !== session.user.id) {
    return NextResponse.json({ error: "You are not assigned to this section" }, { status: 403 });
  }

  const ops = entries.map((e) =>
    MarkEntry.findOneAndUpdate(
      {
        resultWindowId,
        courseOfferingId: offeringId,
        studentId: e.studentId,
      },
      {
        $set: {
          resultWindowId,
          courseOfferingId: offeringId,
          studentId: e.studentId,
          teacherId: session.user.id,
          achievedMarks: e.achievedMarks,
          totalMarks: e.totalMarks,
        },
      },
      { upsert: true, new: true }
    )
  );

  const saved = await Promise.all(ops);
  return NextResponse.json({ success: true, data: saved }, { status: 200 });
}
