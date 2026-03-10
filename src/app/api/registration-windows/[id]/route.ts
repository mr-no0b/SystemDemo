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
  const { isOpen } = await req.json();

  const update: Record<string, unknown> = { isOpen };
  if (!isOpen) update.closedAt = new Date();

  const win = await RegistrationWindow.findByIdAndUpdate(id, update, { new: true });
  if (!win) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: win });
}
