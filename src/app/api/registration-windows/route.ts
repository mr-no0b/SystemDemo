import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { RegistrationWindow } from "@/models/RegistrationWindow";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const url = new URL(req.url);
  const onlyOpen = url.searchParams.get("isOpen") === "true";
  const query: Record<string, unknown> = {};
  if (onlyOpen) query.isOpen = true;
  const windows = await RegistrationWindow.find(query)
    .populate("openedBy", "name userId")
    .sort({ createdAt: -1 })
    .lean();
  return NextResponse.json({ success: true, data: windows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const { semesterLabel, academicYear, takaPerCredit } = await req.json();
  const normalizedTakaPerCredit = Number(takaPerCredit);

  if (!semesterLabel || !academicYear) {
    return NextResponse.json(
      { error: "semesterLabel and academicYear are required" },
      { status: 400 }
    );
  }

  if (!Number.isFinite(normalizedTakaPerCredit) || normalizedTakaPerCredit <= 0) {
    return NextResponse.json(
      { error: "A valid Taka per credit amount is required" },
      { status: 400 }
    );
  }

  // If a window already exists for this semester+year, just reopen it
  const existing = await RegistrationWindow.findOne({ semesterLabel, academicYear });
  if (existing) {
    existing.isOpen = true;
    existing.closedAt = undefined;
    existing.openedAt = new Date();
    existing.openedBy = session.user.id as unknown as typeof existing.openedBy;
    existing.takaPerCredit = normalizedTakaPerCredit;
    await existing.save();
    return NextResponse.json({ success: true, data: existing });
  }

  const win = await RegistrationWindow.create({
    semesterLabel,
    academicYear,
    takaPerCredit: normalizedTakaPerCredit,
    isOpen: true,
    openedBy: session.user.id,
    openedAt: new Date(),
  });
  return NextResponse.json({ success: true, data: win }, { status: 201 });
}
