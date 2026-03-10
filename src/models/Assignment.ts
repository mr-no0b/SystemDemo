import mongoose, { Schema, Document, models, model } from "mongoose";

export interface AssignmentDocument extends Document {
  courseOfferingId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  driveLink?: string;
  dueDate: Date;
  totalMarks: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSchema = new Schema<AssignmentDocument>(
  {
    courseOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "CourseSection",
      required: true,
      index: true,
    },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    driveLink: { type: String },
    dueDate: { type: Date, required: true },
    totalMarks: { type: Number, required: true, default: 100 },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Assignment =
  models.Assignment || model<AssignmentDocument>("Assignment", AssignmentSchema);
