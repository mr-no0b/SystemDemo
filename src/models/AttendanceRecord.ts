import mongoose, { Schema, Document, models, model } from "mongoose";

const AttendanceRecordEntrySchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["present", "absent", "late", "excused"],
      required: true,
    },
    remark: { type: String },
  },
  { _id: false }
);

export interface AttendanceRecordDocument extends Document {
  courseOfferingId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  date: Date;
  lectureNumber: number;
  records: {
    studentId: mongoose.Types.ObjectId;
    status: "present" | "absent" | "late" | "excused";
    remark?: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceRecordSchema = new Schema<AttendanceRecordDocument>(
  {
    courseOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "CourseSection",
      required: true,
      index: true,
    },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    lectureNumber: { type: Number, required: true },
    records: [AttendanceRecordEntrySchema],
  },
  { timestamps: true }
);

AttendanceRecordSchema.index({ courseOfferingId: 1, date: 1, lectureNumber: 1 }, { unique: true });

export const AttendanceRecord =
  models.AttendanceRecord ||
  model<AttendanceRecordDocument>("AttendanceRecord", AttendanceRecordSchema);
