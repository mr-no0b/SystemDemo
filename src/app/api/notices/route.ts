import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Notice } from "@/models/Notice";
import { User } from "@/models/User";
import { createNotificationsForMany } from "@/lib/notify";
import { sendEmail, noticeEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const dept = url.searchParams.get("dept");
  const mine = url.searchParams.get("mine") === "true";

  const query: Record<string, unknown> = { isActive: true };

  if (mine) {
    // Return only the caller's own notices (management view)
    query.publishedBy = session.user.id;
  } else {
    // Viewer path — scope to what this role/department should see
    const deptId = dept || session.user.departmentId;

    if (session.user.role === "teacher") {
      query.$and = [
        {
          $or: [
            { scope: "central" },
            { scope: "departmental", departmentId: deptId },
          ],
        },
        { target: { $in: ["all", "teachers"] } },
      ];
    } else if (session.user.role === "student") {
      query.$and = [
        {
          $or: [
            { scope: "central" },
            { scope: "departmental", departmentId: deptId },
          ],
        },
        { target: { $in: ["all", "students"] } },
      ];
    } else {
      // admin — no restriction
      if (scope) query.scope = scope;
      if (dept) query.departmentId = dept;
    }
  }

  const notices = await Notice.find(query)
    .populate("publishedBy", "name userId role")
    .populate("departmentId", "name code")
    .sort({ isPinned: -1, createdAt: -1 })
    .lean();

  return NextResponse.json({ success: true, data: notices });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role === "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const body = await req.json();
  const { title, content, scope, target, departmentId, isPinned, expiresAt, attachmentLink } = body;

  if (!title || !content || !scope) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // For departmental notices, fall back to the poster's own department
  const resolvedDeptId =
    departmentId ||
    (scope === "departmental" ? session.user.departmentId : undefined);

  if (scope === "departmental" && !resolvedDeptId) {
    return NextResponse.json({ error: "Department is required for departmental notices" }, { status: 400 });
  }

  const notice = await Notice.create({
    title,
    content,
    scope,
    target: target ?? "all",
    departmentId: resolvedDeptId ?? undefined,
    publishedBy: session.user.id,
    isPinned: isPinned ?? false,
    expiresAt: expiresAt ?? undefined,
    attachmentLink: attachmentLink ?? undefined,
  });

  // Build query for target users
  const userQuery: Record<string, unknown> = { isActive: true };
  if (target === "students") userQuery.role = "student";
  else if (target === "teachers") userQuery.role = "teacher";
  else userQuery.role = { $in: ["student", "teacher"] };
  if (scope === "departmental" && resolvedDeptId) userQuery.departmentId = resolvedDeptId;

  const publisher = await User.findById(session.user.id).lean();
  const targetUsers = await User.find(userQuery).select("_id name email").lean();
  const userIds = targetUsers.map((u) => u._id);

  await createNotificationsForMany(userIds, {
    title: `Notice: ${title}`,
    message: content.slice(0, 120) + (content.length > 120 ? "…" : ""),
    type: "notice",
    link: "/teacher/notices",
  });

  // Send emails (fire-and-forget)
  const publisherName = publisher?.name ?? "Administration";
  for (const user of targetUsers) {
    if (user.email) {
      sendEmail({
        to: user.email,
        subject: `New Notice: ${title}`,
        html: noticeEmail({ recipientName: user.name, noticeTitle: title, noticeContent: content, publisherName }),
      });
    }
  }

  return NextResponse.json({ success: true, data: notice }, { status: 201 });
}
