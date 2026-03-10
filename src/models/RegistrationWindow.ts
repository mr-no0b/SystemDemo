import mongoose, { Schema, Document, models, model } from "mongoose";

export interface RegistrationWindowDocument extends Document {
  semesterLabel: string;
  academicYear: string;
  isOpen: boolean;
  openedBy: mongoose.Types.ObjectId;
  openedAt: Date;
  closedAt?: Date;
  createdAt: Date;
}

const RegistrationWindowSchema = new Schema<RegistrationWindowDocument>(
  {
    semesterLabel: { type: String, required: true },
    academicYear: { type: String, required: true },
    isOpen: { type: Boolean, default: true, index: true },
    openedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

// Only one window record per semester + year
RegistrationWindowSchema.index({ semesterLabel: 1, academicYear: 1 }, { unique: true });

export const RegistrationWindow =
  models.RegistrationWindow ||
  model<RegistrationWindowDocument>("RegistrationWindow", RegistrationWindowSchema);
