import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { ForumPost } from "@/models/ForumPost";
import { ForumAnswer } from "@/models/ForumAnswer";
import { User } from "@/models/User";

export async function GET(req: NextRequest) {
  await connectDB();
  const url = new URL(req.url);
  const search = url.searchParams.get("q");
  const tag = url.searchParams.get("tag");
  const sort = url.searchParams.get("sort") ?? "newest";
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = 20;

  const query: Record<string, unknown> = { isModerated: false };
  if (tag) query.tags = tag;
  if (search) query.$text = { $search: search };

  const sortOptions: Record<string, Record<string, 1 | -1>> = {
    newest: { createdAt: -1 },
    votes: { upvotes: -1 },
    unanswered: { answerCount: 1, createdAt: -1 },
  };

  const posts = await ForumPost.find(query)
    .populate("authorId", "name userId role")
    .sort(sortOptions[sort] ?? sortOptions.newest)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await ForumPost.countDocuments(query);

  return NextResponse.json({ success: true, data: posts, total, page, pages: Math.ceil(total / limit) });
}

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

  const { title, body, tags } = await req.json();

  if (!title || !body) {
    return NextResponse.json({ error: "Title and body required" }, { status: 400 });
  }

  const post = await ForumPost.create({
    authorId: session.user.id,
    title,
    body,
    tags: tags ?? [],
  });

  return NextResponse.json({ success: true, data: post }, { status: 201 });
}
