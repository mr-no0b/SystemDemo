import mongoose, { Schema, Document, models, model } from "mongoose";

export interface NoticeDocument extends Document {
  title: string;
  content: string;
  scope: "central" | "departmental" | "classroom";
  target: "all" | "students" | "teachers";
  departmentId?: mongoose.Types.ObjectId;
  courseSectionId?: mongoose.Types.ObjectId;
  publishedBy: mongoose.Types.ObjectId;
  isPinned: boolean;
  expiresAt?: Date;
  attachmentLink?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NoticeSchema = new Schema<NoticeDocument>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    scope: {
      type: String,
      enum: ["central", "departmental", "classroom"],
      required: true,
      index: true,
    },
    target: {
      type: String,
      enum: ["all", "students", "teachers"],
      default: "all",
    },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", index: true },
    courseSectionId: { type: Schema.Types.ObjectId, ref: "CourseSection", index: true },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isPinned: { type: Boolean, default: false },
    expiresAt: { type: Date },
    attachmentLink: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

NoticeSchema.index({ scope: 1, isActive: 1, isPinned: -1, createdAt: -1 });

export const Notice =
  models.Notice || model<NoticeDocument>("Notice", NoticeSchema);
