import mongoose, { Schema, Document, models, model } from "mongoose";

export interface UserDocument extends Document {
  userId: string;
  name: string;
  email?: string;
  password: string;
  role: "student" | "teacher" | "admin";
  departmentId?: mongoose.Types.ObjectId;
  advisorId?: mongoose.Types.ObjectId;
  currentSemester?: string;
  session?: string; // e.g. "2025-26" — intake academic year (students)
  profileImage?: string;
  isActive: boolean;
  forumBanned?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, sparse: true, index: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["student", "teacher", "admin"],
      required: true,
      index: true,
    },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", index: true },
    advisorId: { type: Schema.Types.ObjectId, ref: "User" },
    currentSemester: { type: String },
    session: { type: String },
    profileImage: { type: String },
    isActive: { type: Boolean, default: true },
    forumBanned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = models.User || model<UserDocument>("User", UserSchema);
