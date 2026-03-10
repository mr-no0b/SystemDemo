import mongoose, { Schema, Document, models, model } from "mongoose";

export interface BookRecommendationDocument extends Document {
  courseId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  title: string;
  author?: string;
  link?: string;
  comment?: string;
  createdAt: Date;
}

const BookRecommendationSchema = new Schema<BookRecommendationDocument>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    author: { type: String },
    link: { type: String },
    comment: { type: String },
  },
  { timestamps: true }
);

export const BookRecommendation =
  models.BookRecommendation ||
  model<BookRecommendationDocument>("BookRecommendation", BookRecommendationSchema);
