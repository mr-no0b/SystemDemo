import { Notification } from "@/models/Notification";
import mongoose from "mongoose";

export interface CreateNotificationInput {
  userId: string | mongoose.Types.ObjectId;
  title: string;
  message: string;
  type?: "registration" | "notice" | "announcement" | "election" | "result" | "general";
  link?: string;
}

export async function createNotification(input: CreateNotificationInput) {
  try {
    await Notification.create({
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type ?? "general",
      link: input.link,
    });
  } catch (err) {
    console.error("[notification] Failed to create notification:", err);
  }
}

export async function createNotificationsForMany(
  userIds: (string | mongoose.Types.ObjectId)[],
  input: Omit<CreateNotificationInput, "userId">
) {
  try {
    const docs = userIds.map((userId) => ({
      userId,
      title: input.title,
      message: input.message,
      type: input.type ?? "general",
      link: input.link,
    }));
    if (docs.length > 0) await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    console.error("[notification] Failed to create bulk notifications:", err);
  }
}
