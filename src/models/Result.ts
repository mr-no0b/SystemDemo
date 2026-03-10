import mongoose, { Schema, Document, models, model } from "mongoose";

const CourseResultSchema = new Schema(
  {
    courseOfferingId: { type: Schema.Types.ObjectId, ref: "CourseSection" },
    courseCode: { type: String, required: true },
    courseTitle: { type: String, required: true },
    credits: { type: Number, required: true },
    gradePoint: { type: Number, required: true, min: 0, max: 4 },
    gradeLetter: { type: String, required: true },
    marks: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

export interface ResultDocument extends Document {
  studentId: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  semesterLabel: string;
  academicYear: string;
  courses: {
    courseOfferingId: mongoose.Types.ObjectId;
    courseCode: string;
    courseTitle: string;
    credits: number;
    gradePoint: number;
    gradeLetter: string;
    marks: number;
  }[];
  semesterGPA: number;
  cgpa: number;
  departmentRank?: number;
  isPublished: boolean;
  publishedBy?: mongoose.Types.ObjectId;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ResultSchema = new Schema<ResultDocument>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    semesterLabel: { type: String, required: true, index: true },
    academicYear: { type: String, required: true },
    courses: [CourseResultSchema],
    semesterGPA: { type: Number, required: true, min: 0, max: 4 },
    cgpa: { type: Number, required: true, min: 0, max: 4 },
    departmentRank: { type: Number },
    isPublished: { type: Boolean, default: false, index: true },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

ResultSchema.index({ studentId: 1, semesterLabel: 1, academicYear: 1 }, { unique: true });

export const Result = models.Result || model<ResultDocument>("Result", ResultSchema);
