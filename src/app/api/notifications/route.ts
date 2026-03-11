import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Notification } from "@/models/Notification";

// GET  /api/notifications        — fetch for current user (latest 50)
// PATCH /api/notifications       — mark all as read
// DELETE /api/notifications      — clear all for current user
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const notifications = await Notification.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const unreadCount = await Notification.countDocuments({ userId: session.user.id, isRead: false });

  return NextResponse.json({ success: true, data: notifications, unreadCount });
}

export async function PATCH() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  await Notification.updateMany({ userId: session.user.id, isRead: false }, { isRead: true });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (id) {
    // Delete single notification
    await Notification.deleteOne({ _id: id, userId: session.user.id });
  } else {
    // Clear all
    await Notification.deleteMany({ userId: session.user.id });
  }

  return NextResponse.json({ success: true });
}
