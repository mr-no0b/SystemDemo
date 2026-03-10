import mongoose, { Schema, Document, models, model } from "mongoose";

export interface ElectionCandidateDocument extends Document {
  electionId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  manifesto: string;
  cgpa?: number;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  voteCount?: number;
  createdAt: Date;
}

const ElectionCandidateSchema = new Schema<ElectionCandidateDocument>(
  {
    electionId: {
      type: Schema.Types.ObjectId,
      ref: "Election",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    manifesto: { type: String, required: true },
    cgpa: { type: Number },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
    voteCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ElectionCandidateSchema.index({ electionId: 1, studentId: 1 }, { unique: true });

export const ElectionCandidate =
  models.ElectionCandidate ||
  model<ElectionCandidateDocument>("ElectionCandidate", ElectionCandidateSchema);
