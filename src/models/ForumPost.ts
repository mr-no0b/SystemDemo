import mongoose, { Schema, Document, models, model } from "mongoose";
import { encodeForumQuestion, FORUM_VECTOR_VERSION, type ForumVectorTerm } from "@/lib/forum-similarity";

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
  forumVector: ForumVectorTerm[];
  forumTitleVector: ForumVectorTerm[];
  forumVectorVersion: number;
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
    forumVector: [
      new Schema<ForumVectorTerm>(
        {
          token: { type: String, required: true },
          weight: { type: Number, required: true },
        },
        { _id: false }
      ),
    ],
    forumTitleVector: [
      new Schema<ForumVectorTerm>(
        {
          token: { type: String, required: true },
          weight: { type: Number, required: true },
        },
        { _id: false }
      ),
    ],
    forumVectorVersion: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

ForumPostSchema.index({ title: "text", body: "text", tags: "text" });
ForumPostSchema.index({ createdAt: -1 });
ForumPostSchema.index({ acceptedAnswerId: 1, forumVectorVersion: 1 });

ForumPostSchema.pre("save", function ensureForumVectors() {
  if (
    !this.isModified("title") &&
    !this.isModified("body") &&
    Array.isArray(this.forumVector) &&
    Array.isArray(this.forumTitleVector) &&
    this.forumVectorVersion === FORUM_VECTOR_VERSION
  ) {
    return;
  }

  const encoded = encodeForumQuestion({
    title: this.title ?? "",
    body: this.body ?? "",
  });

  this.forumVector = encoded.forumVector;
  this.forumTitleVector = encoded.forumTitleVector;
  this.forumVectorVersion = encoded.forumVectorVersion;
});

export const ForumPost =
  models.ForumPost || model<ForumPostDocument>("ForumPost", ForumPostSchema);
