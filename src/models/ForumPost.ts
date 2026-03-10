import mongoose, { Schema, Document, models, model } from "mongoose";

export interface ForumPostDocument extends Document {
  authorId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  tags: string[];
  upvotes: mongoose.Types.ObjectId[];
  downvotes: mongoose.Types.ObjectId[];
  views: number;
  acceptedAnswerId?: mongoose.Types.ObjectId;
  answerCount: number;
  isClosed: boolean;
  isModerated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ForumPostSchema = new Schema<ForumPostDocument>(
  {
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    tags: [{ type: String, index: true }],
    upvotes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    downvotes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    views: { type: Number, default: 0 },
    acceptedAnswerId: { type: Schema.Types.ObjectId, ref: "ForumAnswer" },
    answerCount: { type: Number, default: 0 },
    isClosed: { type: Boolean, default: false },
    isModerated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ForumPostSchema.index({ title: "text", body: "text", tags: "text" });
ForumPostSchema.index({ createdAt: -1 });

export const ForumPost =
  models.ForumPost || model<ForumPostDocument>("ForumPost", ForumPostSchema);
