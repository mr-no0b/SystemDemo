import mongoose, { Schema, Document, models, model } from "mongoose";

export interface SubmissionDocument extends Document {
  assignmentId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  driveLink: string;
  submittedAt: Date;
  marks?: number;
  feedback?: string;
  gradedBy?: mongoose.Types.ObjectId;
  gradedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubmissionSchema = new Schema<SubmissionDocument>(
  {
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    driveLink: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
    marks: { type: Number, min: 0 },
    feedback: { type: String },
    gradedBy: { type: Schema.Types.ObjectId, ref: "User" },
    gradedAt: { type: Date },
  },
  { timestamps: true }
);

SubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

export const Submission =
  models.Submission || model<SubmissionDocument>("Submission", SubmissionSchema);
