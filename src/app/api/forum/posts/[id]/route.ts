import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { ForumPost } from "@/models/ForumPost";
import { ForumAnswer } from "@/models/ForumAnswer";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectDB();
  const post = await ForumPost.findByIdAndUpdate(
    id,
    { $inc: { views: 1 } },
    { new: true }
  ).populate("authorId", "name userId role forumBanned").lean();

  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const answers = await ForumAnswer.find({ postId: id })
    .populate("authorId", "name userId role forumBanned")
    .sort({ isAccepted: -1, upvotes: -1, createdAt: 1 })
    .lean();

  return NextResponse.json({ success: true, data: { post, answers } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const body = await req.json();
  const { action } = body;
  const post = await ForumPost.findById(id);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "upvote") {
    const userId = session.user.id;
    if (post.upvotes.map(String).includes(userId)) {
      post.upvotes = post.upvotes.filter((id: { toString(): string }) => id.toString() !== userId);
    } else {
      post.upvotes.push(userId as unknown as typeof post.upvotes[number]);
      post.downvotes = post.downvotes.filter((id: { toString(): string }) => id.toString() !== userId);
    }
    await post.save();
    return NextResponse.json({ success: true, upvotes: post.upvotes.length });
  }

  if (action === "downvote") {
    const userId = session.user.id;
    if (post.downvotes.map(String).includes(userId)) {
      post.downvotes = post.downvotes.filter((id: { toString(): string }) => id.toString() !== userId);
    } else {
      post.downvotes.push(userId as unknown as typeof post.downvotes[number]);
      post.upvotes = post.upvotes.filter((id: { toString(): string }) => id.toString() !== userId);
    }
    await post.save();
    return NextResponse.json({ success: true });
  }

  if (action === "moderate" && session.user.role === "admin") {
    post.isModerated = !post.isModerated;
    await post.save();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const post = await ForumPost.findById(id).populate("authorId", "role").lean() as { _id: unknown; authorId: { _id: { toString(): string }; role: string } } | null;
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = post.authorId._id.toString() === session.user.id;
  const isAdmin = session.user.role === "admin";
  const isTeacherDeletingStudent =
    session.user.role === "teacher" && post.authorId.role === "student";

  if (!isOwner && !isAdmin && !isTeacherDeletingStudent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ForumPost.findByIdAndDelete(id);
  await ForumAnswer.deleteMany({ postId: id });
  return NextResponse.json({ success: true });
}
