import mongoose, { Schema, Document, models, model } from "mongoose";

export interface NoteDocument extends Document {
  title: string;
  description?: string;
  driveLink: string;
  courseId?: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  semesterLabel: string;
  uploadedBy: mongoose.Types.ObjectId;
  tags: string[];
  createdAt: Date;
}

const NoteSchema = new Schema<NoteDocument>(
  {
    title: { type: String, required: true },
    description: { type: String },
    driveLink: { type: String, required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    semesterLabel: { type: String, required: true, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tags: [{ type: String }],
  },
  { timestamps: true }
);

NoteSchema.index({ departmentId: 1, semesterLabel: 1 });

export const Note = models.Note || model<NoteDocument>("Note", NoteSchema);
