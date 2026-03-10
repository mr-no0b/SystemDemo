import mongoose, { Schema, Document, models, model } from "mongoose";

export interface ResultWindowDocument extends Document {
  semesterLabel: string;
  academicYear: string;
  isOpen: boolean;
  openedBy: mongoose.Types.ObjectId;
  openedAt: Date;
  closedAt?: Date;
  publishedCount?: number;
}

const ResultWindowSchema = new Schema<ResultWindowDocument>(
  {
    semesterLabel: { type: String, required: true },
    academicYear: { type: String, required: true },
    isOpen: { type: Boolean, default: true, index: true },
    openedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
    publishedCount: { type: Number },
  },
  { timestamps: true }
);

ResultWindowSchema.index({ semesterLabel: 1, academicYear: 1 }, { unique: true });

export const ResultWindow =
  models.ResultWindow ||
  model<ResultWindowDocument>("ResultWindow", ResultWindowSchema);
