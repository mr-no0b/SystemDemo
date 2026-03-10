import mongoose, { Schema, Document, models, model } from "mongoose";

export interface RegistrationDocument extends Document {
  studentId: mongoose.Types.ObjectId;
  semesterLabel: string;
  academicYear: string;
  departmentId: mongoose.Types.ObjectId;
  courseOfferingIds: mongoose.Types.ObjectId[];
  status:
    | "draft"
    | "pending_advisor"
    | "pending_head"
    | "approved"
    | "payment_pending"
    | "paid"
    | "admitted"
    | "rejected";
  advisorId?: mongoose.Types.ObjectId;
  advisorApprovedAt?: Date;
  headId?: mongoose.Types.ObjectId;
  headApprovedAt?: Date;
  paymentCompletedAt?: Date;
  adminAdmittedAt?: Date;
  adminAdmittedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RegistrationSchema = new Schema<RegistrationDocument>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    semesterLabel: { type: String, required: true },
    academicYear: { type: String, required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    courseOfferingIds: [{ type: Schema.Types.ObjectId, ref: "CourseSection" }],
    status: {
      type: String,
      enum: [
        "draft",
        "pending_advisor",
        "pending_head",
        "approved",
        "payment_pending",
        "paid",
        "admitted",
        "rejected",
      ],
      default: "draft",
      index: true,
    },
    advisorId: { type: Schema.Types.ObjectId, ref: "User" },
    advisorApprovedAt: { type: Date },
    headId: { type: Schema.Types.ObjectId, ref: "User" },
    headApprovedAt: { type: Date },
    paymentCompletedAt: { type: Date },
    adminAdmittedAt: { type: Date },
    adminAdmittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

// A student can only have one registration per semester per year
RegistrationSchema.index(
  { studentId: 1, semesterLabel: 1, academicYear: 1 },
  { unique: true }
);

export const Registration =
  models.Registration ||
  model<RegistrationDocument>("Registration", RegistrationSchema);
