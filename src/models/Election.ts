import mongoose, { Schema, Document, models, model } from "mongoose";

export interface ElectionDocument extends Document {
  departmentId: mongoose.Types.ObjectId;
  positionType: string;
  positionLabel: string;
  session?: string; // semester label, e.g. "1-1" (for CR-level) or "Full Department"
  academicYear?: string; // e.g. "2025-26" — if set, only students with this academic year can vote/apply
  status: "draft" | "applications_open" | "voting" | "completed";
  createdBy: mongoose.Types.ObjectId;
  selectedCandidateId?: mongoose.Types.ObjectId;
  isEmpty: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ElectionSchema = new Schema<ElectionDocument>(
  {
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    positionType: { type: String, required: true },
    positionLabel: { type: String, required: true },
    session: { type: String },
    academicYear: { type: String },
    status: {
      type: String,
      enum: ["draft", "applications_open", "voting", "completed"],
      default: "draft",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    selectedCandidateId: {
      type: Schema.Types.ObjectId,
      ref: "ElectionCandidate",
    },
    isEmpty: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Election = models.Election || model<ElectionDocument>("Election", ElectionSchema);
