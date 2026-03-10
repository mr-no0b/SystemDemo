import mongoose, { Schema, Document, models, model } from "mongoose";

export interface MarkEntryDocument extends Document {
  resultWindowId: mongoose.Types.ObjectId;
  courseOfferingId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  achievedMarks: number;
  totalMarks: number;
}

const MarkEntrySchema = new Schema<MarkEntryDocument>(
  {
    resultWindowId: { type: Schema.Types.ObjectId, ref: "ResultWindow", required: true, index: true },
    courseOfferingId: { type: Schema.Types.ObjectId, ref: "CourseSection", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    achievedMarks: { type: Number, required: true, min: 0 },
    totalMarks: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

// One entry per student per course per window
MarkEntrySchema.index(
  { resultWindowId: 1, courseOfferingId: 1, studentId: 1 },
  { unique: true }
);

export const MarkEntry =
  models.MarkEntry ||
  model<MarkEntryDocument>("MarkEntry", MarkEntrySchema);
