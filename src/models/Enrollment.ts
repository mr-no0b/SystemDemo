import mongoose, { Schema, Document, models, model } from "mongoose";

export interface EnrollmentDocument extends Document {
  studentId: mongoose.Types.ObjectId;
  courseOfferingId: mongoose.Types.ObjectId;
  semesterLabel: string;
  academicYear: string;
  registrationId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const EnrollmentSchema = new Schema<EnrollmentDocument>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    courseOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "CourseSection",
      required: true,
      index: true,
    },
    semesterLabel: { type: String, required: true },
    academicYear: { type: String, required: true },
    registrationId: {
      type: Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },
  },
  { timestamps: true }
);

EnrollmentSchema.index(
  { studentId: 1, courseOfferingId: 1 },
  { unique: true }
);

export const Enrollment =
  models.Enrollment || model<EnrollmentDocument>("Enrollment", EnrollmentSchema);
