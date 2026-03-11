import mongoose, { Schema, Document, models, model } from "mongoose";

export interface NotificationDocument extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: "registration" | "notice" | "announcement" | "election" | "result" | "general";
  link?: string;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<NotificationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["registration", "notice", "announcement", "election", "result", "general"],
      default: "general",
    },
    link: { type: String },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Notification =
  models.Notification || model<NotificationDocument>("Notification", NotificationSchema);
