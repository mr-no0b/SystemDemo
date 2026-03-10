import mongoose, { Schema, Document, models, model } from "mongoose";

export interface DepartmentDocument extends Document {
  name: string;
  code: string;
  headId?: mongoose.Types.ObjectId;
  advisorIds: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const DepartmentSchema = new Schema<DepartmentDocument>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    headId: { type: Schema.Types.ObjectId, ref: "User" },
    advisorIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export const Department =
  models.Department || model<DepartmentDocument>("Department", DepartmentSchema);
