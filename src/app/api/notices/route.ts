import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Notice } from "@/models/Notice";

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

  return NextResponse.json({ success: true, data: notice }, { status: 201 });
}
