import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: process.env.SMTP_SECURE !== "false", // true for 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    // Email not configured — skip silently in dev/test
    console.warn("[email] SMTP not configured, skipping email to:", payload.to);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"AcademiaOne" <${process.env.SMTP_USER}>`,
      to: Array.isArray(payload.to) ? payload.to.join(", ") : payload.to,
      subject: payload.subject,
      html: payload.html,
    });
  } catch (err) {
    console.error("[email] Failed to send email:", err);
  }
}

// ── Template helpers ──────────────────────────────────────────

function baseTemplate(title: string, body: string) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;background:#f8fafc;border-radius:12px">
      <div style="background:#4f46e5;padding:16px 24px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">AcademiaOne</h1>
      </div>
      <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
        <h2 style="color:#1e293b;margin-top:0">${title}</h2>
        ${body}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
        <p style="color:#94a3b8;font-size:12px;margin:0">This is an automated message from AcademiaOne. Please do not reply to this email.</p>
      </div>
    </div>
  `;
}

export function registrationStatusEmail(opts: {
  studentName: string;
  status: string;
  semesterLabel: string;
  academicYear: string;
  reason?: string;
}) {
  const statusLabels: Record<string, string> = {
    pending_head: "Approved by Advisor — Pending Head Approval",
    payment_pending: "Approved — Awaiting Payment",
    admitted: "Admitted ✅",
    rejected: "Rejected ❌",
  };
  const label = statusLabels[opts.status] ?? opts.status;
  const color = opts.status === "admitted" ? "#16a34a" : opts.status === "rejected" ? "#dc2626" : "#d97706";

  return baseTemplate(
    "Registration Status Update",
    `<p>Dear <strong>${opts.studentName}</strong>,</p>
     <p>Your registration for <strong>Semester ${opts.semesterLabel} (${opts.academicYear})</strong> has been updated:</p>
     <p style="font-size:18px;font-weight:bold;color:${color}">${label}</p>
     ${opts.reason ? `<p><strong>Reason:</strong> ${opts.reason}</p>` : ""}
     <p>Please log in to AcademiaOne for more details.</p>`
  );
}

export function noticeEmail(opts: {
  recipientName: string;
  noticeTitle: string;
  noticeContent: string;
  publisherName: string;
}) {
  return baseTemplate(
    `New Notice: ${opts.noticeTitle}`,
    `<p>Dear <strong>${opts.recipientName}</strong>,</p>
     <p>A new notice has been published by <strong>${opts.publisherName}</strong>:</p>
     <div style="background:#f1f5f9;padding:16px;border-radius:8px;margin:16px 0">
       <h3 style="margin-top:0;color:#1e293b">${opts.noticeTitle}</h3>
       <p style="color:#475569;white-space:pre-line">${opts.noticeContent}</p>
     </div>
     <p>Log in to AcademiaOne to view the full notice.</p>`
  );
}

export function announcementEmail(opts: {
  recipientName: string;
  courseCode: string;
  courseTitle: string;
  announcementTitle: string;
  announcementContent: string;
  teacherName: string;
}) {
  return baseTemplate(
    `Classroom Announcement: ${opts.courseCode}`,
    `<p>Dear <strong>${opts.recipientName}</strong>,</p>
     <p>Your teacher <strong>${opts.teacherName}</strong> posted a new announcement in <strong>${opts.courseCode} — ${opts.courseTitle}</strong>:</p>
     <div style="background:#f1f5f9;padding:16px;border-radius:8px;margin:16px 0">
       <h3 style="margin-top:0;color:#1e293b">${opts.announcementTitle}</h3>
       <p style="color:#475569;white-space:pre-line">${opts.announcementContent}</p>
     </div>
     <p>Log in to AcademiaOne to view more details.</p>`
  );
}

export function electionUpdateEmail(opts: {
  recipientName: string;
  electionTitle: string;
  newStatus: string;
}) {
  const statusLabels: Record<string, string> = {
    applications_open: "Applications are now open 📝",
    voting: "Voting has started 🗳️",
    completed: "Election completed 🏁",
  };
  const label = statusLabels[opts.newStatus] ?? opts.newStatus;
  return baseTemplate(
    `Election Update: ${opts.electionTitle}`,
    `<p>Dear <strong>${opts.recipientName}</strong>,</p>
     <p>The election <strong>${opts.electionTitle}</strong> has been updated:</p>
     <p style="font-size:18px;font-weight:bold;color:#4f46e5">${label}</p>
     <p>Log in to AcademiaOne to participate.</p>`
  );
}

export function resultPublishedEmail(opts: {
  recipientName: string;
  semesterLabel: string;
  academicYear: string;
}) {
  return baseTemplate(
    "Results Published",
    `<p>Dear <strong>${opts.recipientName}</strong>,</p>
     <p>Results for <strong>Semester ${opts.semesterLabel} (${opts.academicYear})</strong> have been published.</p>
     <p>Log in to AcademiaOne to view your results.</p>`
  );
}
