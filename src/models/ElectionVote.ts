import mongoose, { Schema, Document, models, model } from "mongoose";

export interface ElectionVoteDocument extends Document {
  electionId: mongoose.Types.ObjectId;
  voterId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ElectionVoteSchema = new Schema<ElectionVoteDocument>(
  {
    electionId: {
      type: Schema.Types.ObjectId,
      ref: "Election",
      required: true,
      index: true,
    },
    voterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: "ElectionCandidate",
      required: true,
    },
  },
  { timestamps: true }
);

// One vote per voter per election (secret ballot enforced at DB level)
ElectionVoteSchema.index({ electionId: 1, voterId: 1 }, { unique: true });

export const ElectionVote =
  models.ElectionVote ||
  model<ElectionVoteDocument>("ElectionVote", ElectionVoteSchema);
