import mongoose, { Schema, Document, models, model } from "mongoose";

export interface SessionDocument extends Document {
  year: string; // e.g. "2025-26"
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const SessionSchema = new Schema<SessionDocument>(
  {
    year: { type: String, required: true, unique: true, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Session =
  models.Session || model<SessionDocument>("Session", SessionSchema);
