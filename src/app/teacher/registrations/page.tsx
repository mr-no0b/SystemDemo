"use client";
import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, statusVariant } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useSession } from "next-auth/react";
import { CheckCircle, XCircle, User } from "@phosphor-icons/react";

type Offering = {
  _id: string;
  courseId: { code: string; title: string; credits: number };
  section: string;
};

type Registration = {
  _id: string;
  studentId: { _id: string; name: string; userId: string };
  semesterLabel: string;
  academicYear: string;
  status: string;
  courseOfferingIds: Offering[];
  rejectionReason?: string;
  advisorId?: { name: string };
  headId?: { name: string };
  createdAt: string;
};

type Dept = {
  _id: string;
  name: string;
  advisorId?: { _id: string };
  headId?: { _id: string };
};

export default function TeacherRegistrationsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [advisorRegs, setAdvisorRegs] = useState<Registration[]>([]);
  const [headRegs, setHeadRegs] = useState<Registration[]>([]);
  const [myDept, setMyDept] = useState<Dept | null>(null);
  const [isAdvisor, setIsAdvisor] = useState(false);
  const [isHead, setIsHead] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<{ id: string; action: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      // Fetch registrations where this teacher is the assigned advisor
      const [advisorRes, deptRes] = await Promise.all([
        fetch(`/api/registrations?advisorId=${session.user.id}&status=pending_advisor`),
        fetch("/api/departments"),
      ]);
      const [advisorData, deptData] = await Promise.all([advisorRes.json(), deptRes.json()]);
      const pendingAdvisor: Registration[] = advisorData.data ?? [];

      // Find if this teacher is a dept head
      const depts: Dept[] = deptData.data ?? [];
      const headDept = depts.find((d) => d.headId?._id === session.user.id) ?? null;

      setMyDept(headDept);
      setIsAdvisor(true); // all teachers can act as advisors
      setIsHead(!!headDept);
      setAdvisorRegs(pendingAdvisor);

      // Head regs: fetch by dept
      if (headDept) {
        const headRes = await fetch(`/api/registrations?dept=${headDept._id}&status=pending_head`);
        const headData = await headRes.json();
        setHeadRegs(headData.data ?? []);
      } else {
        setHeadRegs([]);
      }
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAction(id: string, action: string, reason?: string) {
    setActioning(id + action);
    const res = await fetch(`/api/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, rejectionReason: reason }),
    });
    const d = await res.json();
    if (d.success) {
      toast(action.includes("approve") ? "Registration approved!" : "Registration rejected.", action.includes("approve") ? "success" : "warning");
      fetchData();
    } else {
      toast(d.error || "Action failed", "error");
    }
    setActioning(null);
    setRejectModal(null);
    setRejectReason("");
  }

  function RegCard({ reg, approveAction }: { reg: Registration; approveAction: string }) {
    const offerings = reg.courseOfferingIds ?? [];
    const totalCredits = offerings.reduce((s, o) => s + (o.courseId?.credits ?? 0), 0);
    return (
      <Card className="mb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <User size={20} className="text-indigo-600" />
            </div>
            <div>
              <p className="font-bold text-slate-800">{reg.studentId?.name}</p>
              <p className="text-xs text-slate-400">{reg.studentId?.userId} · {reg.semesterLabel} · {reg.academicYear}</p>
            </div>
          </div>
          <Badge variant={statusVariant(reg.status)}>
            {reg.status.replace(/_/g, " ").toUpperCase()}
          </Badge>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Courses ({offerings.length}) · {totalCredits} credits total</p>
          <div className="space-y-1">
            {offerings.map((o) => (
              <div key={o._id} className="flex justify-between text-sm">
                <span className="text-slate-700 font-medium">{o.courseId?.code} — {o.courseId?.title}</span>
                <span className="text-slate-400">{o.courseId?.credits} cr</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRejectModal({ id: reg._id, action: "reject" })}
          >
            <XCircle size={15} className="mr-1" /> Reject
          </Button>
          <Button
            size="sm"
            isLoading={actioning === reg._id + approveAction}
            onClick={() => handleAction(reg._id, approveAction)}
          >
            <CheckCircle size={15} className="mr-1" /> Approve
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <DashboardLayout role="teacher" title="Registration Approvals" breadcrumb="Home / Registrations">
      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-8">
          {isHead && myDept && (
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between">
              <p className="font-semibold text-indigo-800 text-sm">{myDept.name} — Department Head</p>
              <Badge variant="blue">Head · {headRegs.length} pending</Badge>
            </div>
          )}

          <section>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                Pending Advisor Approval ({advisorRegs.length})
              </h2>
              {advisorRegs.length === 0 ? (
                <Card><p className="text-center text-slate-400 py-8 text-sm">No registrations pending advisor approval.</p></Card>
              ) : (
                advisorRegs.map((r) => <RegCard key={r._id} reg={r} approveAction="advisor_approve" />)
              )}
            </section>

          {isHead && (
            <section>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                Pending Head Approval ({headRegs.length})
              </h2>
              {headRegs.length === 0 ? (
                <Card><p className="text-center text-slate-400 py-8 text-sm">No registrations pending head approval.</p></Card>
              ) : (
                headRegs.map((r) => <RegCard key={r._id} reg={r} approveAction="head_approve" />)
              )}
            </section>
          )}
        </div>
      )}

      {/* Reject Modal */}
      <Modal
        isOpen={!!rejectModal}
        onClose={() => { setRejectModal(null); setRejectReason(""); }}
        title="Reject Registration"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setRejectModal(null); setRejectReason(""); }}>Cancel</Button>
            <Button
              variant="danger"
              isLoading={actioning === (rejectModal?.id ?? "") + "reject"}
              onClick={() => rejectModal && handleAction(rejectModal.id, "reject", rejectReason)}
            >
              Confirm Reject
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600 mb-3">Provide a reason for rejection (optional):</p>
        <textarea
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          rows={3}
          placeholder="e.g. Credit limit exceeded, pre-requisite not met..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </DashboardLayout>
  );
}
