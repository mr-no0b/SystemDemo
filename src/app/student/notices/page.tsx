import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import connectDB from "@/lib/db";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/models/Notice";
import { User } from "@/models/User";
import { serializeDoc } from "@/lib/utils";
import { Bell, Paperclip, PushPin } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export default async function StudentNoticesPage() {
  const session = await auth();
  if (!session || session.user.role !== "student") redirect("/login");
  await connectDB();

  const notices = await Notice.find({
    isActive: true,
    $and: [
      {
        $or: [
          { scope: "central" },
          { scope: "departmental", departmentId: session.user.departmentId },
        ],
      },
      {
        $or: [{ target: "all" }, { target: "students" }],
      },
    ],
  }).sort({ isPinned: -1, createdAt: -1 }).populate("publishedBy", "name").lean();

  const serialized = serializeDoc(notices);

  const scopeColor = (scope: string) =>
    scope === "central" ? "bg-indigo-50 text-indigo-600" : "bg-purple-50 text-purple-600";

  return (
    <DashboardLayout role="student" title="Notices" breadcrumb="Home / Notices">
      <div className="max-w-3xl mx-auto">
        {serialized.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <Bell size={40} className="mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400">No notices at the moment</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {serialized.map((n: Record<string, unknown>) => (
              <Card key={n._id as string} className={(n.isPinned as boolean) ? "border-indigo-200 bg-indigo-50/20" : ""}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {Boolean(n.isPinned) && <PushPin size={14} className="text-indigo-500" weight="fill" />}
                      <h3 className="font-bold text-slate-800">{n.title as string}</h3>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${scopeColor(n.scope as string)}`}>{n.scope as string}</span>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">{n.content as string}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>By {String((n.publishedBy as Record<string, unknown>)?.name ?? "")}</span>
                      <span>{new Date(n.createdAt as string).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                      {Boolean(n.expiresAt) && <span>Expires: {new Date(String(n.expiresAt)).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  {Boolean(n.attachmentLink) && (
                    <a href={n.attachmentLink as string} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 transition flex-shrink-0" title="View attachment">
                      <Paperclip size={18} />
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
