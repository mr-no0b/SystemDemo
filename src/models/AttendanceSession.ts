import mongoose, { Schema, Document, models, model } from "mongoose";

export interface AttendanceSessionDocument extends Document {
  courseOfferingId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  /** 6-character uppercase alphanumeric code shown to students */
  code: string;
  date: Date;
  lectureNumber: number;
  /** Students who have successfully submitted the correct code */
  presentStudentIds: mongoose.Types.ObjectId[];
  /** False once teacher closes the session */
  isOpen: boolean;
  createdAt: Date;
}

const AttendanceSessionSchema = new Schema<AttendanceSessionDocument>(
  {
    courseOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "CourseSection",
      required: true,
      index: true,
    },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    code: { type: String, required: true },
    date: { type: Date, required: true },
    lectureNumber: { type: Number, required: true },
    presentStudentIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isOpen: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// At most one open session per offering
AttendanceSessionSchema.index({ courseOfferingId: 1, isOpen: 1 });

export const AttendanceSession =
  models.AttendanceSession ||
  model<AttendanceSessionDocument>("AttendanceSession", AttendanceSessionSchema);
