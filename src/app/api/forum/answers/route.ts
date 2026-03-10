import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { ForumAnswer } from "@/models/ForumAnswer";
import { ForumPost } from "@/models/ForumPost";
import { User } from "@/models/User";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  if (session.user.role === "student") {
    const me = await User.findById(session.user.id).select("forumBanned").lean();
    if ((me as { forumBanned?: boolean })?.forumBanned) {
      return NextResponse.json({ error: "You are banned from the forum" }, { status: 403 });
    }
  }

  const { postId, body } = await req.json();

  const answer = await ForumAnswer.create({
    postId,
    authorId: session.user.id,
    body,
  });

  await ForumPost.findByIdAndUpdate(postId, { $inc: { answerCount: 1 } });

  return NextResponse.json({ success: true, data: answer }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { answerId, action, postId } = await req.json();
  const answer = await ForumAnswer.findById(answerId);
  if (!answer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "accept") {
    const post = await ForumPost.findById(postId);
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    if (post.authorId.toString() !== session.user.id) {
      return NextResponse.json({ error: "Only post author can accept" }, { status: 403 });
    }
    await ForumAnswer.updateMany({ postId }, { isAccepted: false });
    answer.isAccepted = true;
    await answer.save();
    post.acceptedAnswerId = answer._id as unknown as typeof post.acceptedAnswerId;
    await post.save();
    return NextResponse.json({ success: true });
  }

  if (action === "upvote") {
    const uid = session.user.id;
    if (answer.upvotes.map(String).includes(uid)) {
      answer.upvotes = answer.upvotes.filter((id: { toString(): string }) => id.toString() !== uid);
    } else {
      answer.upvotes.push(uid as unknown as typeof answer.upvotes[number]);
      answer.downvotes = answer.downvotes.filter((id: { toString(): string }) => id.toString() !== uid);
    }
    await answer.save();
    return NextResponse.json({ success: true, upvotes: answer.upvotes.length, downvotes: answer.downvotes.length });
  }

  if (action === "downvote") {
    const uid = session.user.id;
    if (answer.downvotes.map(String).includes(uid)) {
      answer.downvotes = answer.downvotes.filter((id: { toString(): string }) => id.toString() !== uid);
    } else {
      answer.downvotes.push(uid as unknown as typeof answer.downvotes[number]);
      answer.upvotes = answer.upvotes.filter((id: { toString(): string }) => id.toString() !== uid);
    }
    await answer.save();
    return NextResponse.json({ success: true, upvotes: answer.upvotes.length, downvotes: answer.downvotes.length });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const answerId = url.searchParams.get("id");
  if (!answerId) return NextResponse.json({ error: "Missing answer id" }, { status: 400 });

  const answer = await ForumAnswer.findById(answerId).populate("authorId", "role").lean() as { authorId: { _id: { toString(): string }; role: string }; postId: unknown } | null;
  if (!answer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = answer.authorId._id.toString() === session.user.id;
  const isAdmin = session.user.role === "admin";
  const isTeacherDeletingStudent =
    session.user.role === "teacher" && answer.authorId.role === "student";

  if (!isOwner && !isAdmin && !isTeacherDeletingStudent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ForumAnswer.findByIdAndDelete(answerId);
  await ForumPost.findByIdAndUpdate(answer.postId, { $inc: { answerCount: -1 } });
  return NextResponse.json({ success: true });
}
