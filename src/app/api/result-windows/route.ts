import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { ResultWindow } from "@/models/ResultWindow";
import { MarkEntry } from "@/models/MarkEntry";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const isOpen = url.searchParams.get("isOpen");

  const query: Record<string, unknown> = {};
  if (isOpen !== null) query.isOpen = isOpen === "true";

  const windows = await ResultWindow.find(query)
    .populate("openedBy", "name")
    .sort({ createdAt: -1 })
    .lean();

  const windowsWithCounts = await Promise.all(
    windows.map(async (w) => {
      const entryCount = await MarkEntry.countDocuments({ resultWindowId: w._id });
      return { ...w, entryCount };
    })
  );

  return NextResponse.json({ success: true, data: windowsWithCounts });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const body = await req.json();
  const { semesterLabel, academicYear } = body;

  if (!semesterLabel) {
    return NextResponse.json(
      { error: "semesterLabel is required" },
      { status: 400 }
    );
  }
  if (!academicYear) {
    return NextResponse.json(
      { error: "academicYear (session) is required" },
      { status: 400 }
    );
  }

  const existing = await ResultWindow.findOne({ semesterLabel, academicYear });
  if (existing) {
    return NextResponse.json(
      { error: "A result window for this semester already exists" },
      { status: 409 }
    );
  }

  const window = await ResultWindow.create({
    semesterLabel,
    academicYear,
    isOpen: true,
    openedBy: session.user.id,
    openedAt: new Date(),
  });

  return NextResponse.json({ success: true, data: window }, { status: 201 });
}
