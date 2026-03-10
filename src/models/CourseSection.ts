import mongoose, { Schema, Document, models, model } from "mongoose";

export interface CourseSectionDocument extends Document {
  courseId: mongoose.Types.ObjectId;
  teacherId?: mongoose.Types.ObjectId;
  semesterLabel: string;
  academicYear: string;
  section: string;
  departmentId: mongoose.Types.ObjectId;
  plannedClasses: number;
  isActive: boolean;
  createdAt: Date;
}

const CourseSectionSchema = new Schema<CourseSectionDocument>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    semesterLabel: { type: String, required: true, index: true },
    academicYear: { type: String, required: true },
    section: { type: String, required: true, default: "A" },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    plannedClasses: { type: Number, default: 40 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CourseSectionSchema.index(
  { courseId: 1, teacherId: 1, semesterLabel: 1, academicYear: 1, section: 1 },
  { unique: true, sparse: true }
);

// Use the existing "courseofferings" collection — no data migration needed
export const CourseSection =
  models.CourseSection ||
  model<CourseSectionDocument>("CourseSection", CourseSectionSchema, "courseofferings");
