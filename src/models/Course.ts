import mongoose, { Schema, Document, models, model } from "mongoose";

export interface CourseDocument extends Document {
  code: string;
  title: string;
  credits: number;
  departmentId: mongoose.Types.ObjectId;
  semesterLabel: string;
  description?: string;
  teacherId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const CourseSchema = new Schema<CourseDocument>(
  {
    code: { type: String, required: true, uppercase: true },
    title: { type: String, required: true },
    credits: { type: Number, required: true, default: 3 },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    semesterLabel: { type: String, required: true, index: true },
    description: { type: String },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// Code must be unique within a department, but two departments can share the same code
CourseSchema.index({ code: 1, departmentId: 1 }, { unique: true });

export const Course = models.Course || model<CourseDocument>("Course", CourseSchema);
