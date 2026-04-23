import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { RegistrationWindow } from "@/models/RegistrationWindow";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const { id } = await params;
  const win = await RegistrationWindow.findById(id);
  if (!win) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (win.isOpen) {
    return NextResponse.json(
      { error: "Cannot delete an open registration window. Close it first." },
      { status: 400 }
    );
  }
  await win.deleteOne();
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const { id } = await params;
  const { isOpen, takaPerCredit } = await req.json();

  const win = await RegistrationWindow.findById(id);
  if (!win) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!Number.isFinite(Number(win.takaPerCredit)) || Number(win.takaPerCredit) <= 0) {
    win.takaPerCredit = 2200;
  }

  if (typeof isOpen === "boolean") {
    win.isOpen = isOpen;
    if (isOpen) {
      win.closedAt = undefined;
      win.openedAt = new Date();
      win.openedBy = session.user.id as unknown as typeof win.openedBy;
    } else {
      win.closedAt = new Date();
    }
  }

  if (takaPerCredit !== undefined) {
    const normalizedTakaPerCredit = Number(takaPerCredit);
    if (!Number.isFinite(normalizedTakaPerCredit) || normalizedTakaPerCredit <= 0) {
      return NextResponse.json(
        { error: "A valid Taka per credit amount is required" },
        { status: 400 }
      );
    }
    win.takaPerCredit = normalizedTakaPerCredit;
  }

  await win.save();
  return NextResponse.json({ success: true, data: win });
}
