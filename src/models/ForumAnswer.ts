import mongoose, { Schema, Document, models, model } from "mongoose";

export interface ForumAnswerDocument extends Document {
  postId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  body: string;
  upvotes: mongoose.Types.ObjectId[];
  downvotes: mongoose.Types.ObjectId[];
  isAccepted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ForumAnswerSchema = new Schema<ForumAnswerDocument>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "ForumPost",
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    body: { type: String, required: true },
    upvotes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    downvotes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isAccepted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ForumAnswer =
  models.ForumAnswer ||
  model<ForumAnswerDocument>("ForumAnswer", ForumAnswerSchema);
