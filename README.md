# AcademiaOne 🎓

A full-stack university management web system built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **MongoDB Atlas**.

---

## Features

| Module | Student | Teacher | Admin |
|---|---|---|---|
| Dashboard | ✅ Stats, notices, enrolled courses | ✅ Courses, grading summary | ✅ System-wide stats |
| Registration | ✅ Course selection → approval flow | — | ✅ Admissions (admit/reject after payment) |
| Classrooms | ✅ Assignments, submit via Drive | ✅ Manage assignments, grade submissions | — |
| Attendance | ✅ View per-course attendance % | ✅ Mark attendance (click to cycle status) | — |
| Results | ✅ Published results, GPA, CGPA, rank | ✅ Enter marks → auto-grade → publish | — |
| Notes & Books | ✅ Share/view notes, view book recs | ✅ Add book recommendations | — |
| Forum | ✅ Ask/answer, upvote/accept | — | — |
| Elections | ✅ Apply as candidate, vote | ✅ Approve/reject candidates | — |
| Notices | ✅ View central + departmental | ✅ Post/edit/delete notices | ✅ Post/pin central notices |
| User Management | — | — | ✅ Create/edit/activate users |
| Departments | — | — | ✅ Create/edit + assign head/advisor |
| Courses | — | — | ✅ Courses + offerings management |

---

## Tech Stack

- **Framework**: Next.js 14 App Router (TypeScript)
- **Database**: MongoDB Atlas via Mongoose
- **Auth**: NextAuth v5 (Credentials + JWT)
- **Styling**: Tailwind CSS (Indigo + Slate design system)
- **Icons**: @phosphor-icons/react
- **Security**: bcryptjs (password hashing)

---

## Setup

### 1. Clone & Install

```bash
cd "System Final/AcademiaOne"
npm install
```

### 2. Configure Environment

Edit `.env.local` and replace the MongoDB URI placeholders:

```env
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@academiaone.fhwvk5h.mongodb.net/academiaone?appName=academiaone
NEXTAUTH_SECRET=change-this-to-a-long-random-secret-string
NEXTAUTH_URL=http://localhost:3000
```

> ⚠️ Replace `YOUR_USERNAME` and `YOUR_PASSWORD` with your actual MongoDB Atlas credentials.
> Get them from MongoDB Atlas → Database → Connect → Connect your application.

### 3. Seed the Database

```bash
npm install --save-dev ts-node tsconfig-paths dotenv
npx ts-node --project tsconfig.json src/scripts/seed.ts
```

This creates: 1 Admin · 3 Teachers · 5 Students · 2 Departments · 5 Courses · 4 Offerings · Enrollments · Attendance · Published results · Notices · Forum posts · Election

### 4. Run the App

```bash
npm run dev
```

Open http://localhost:3000

---

## Demo Accounts

| Role    | User ID | Password    |
|---------|---------|-------------|
| Admin   | AD-001  | admin123    |
| Teacher | TE-001  | teacher123  |
| Teacher | TE-002  | teacher123  |
| Student | ST-001  | student123  |
| Student | ST-002  | student123  |

---

## Project Structure

```
src/
├── app/
│   ├── login/          # Login page with role selector
│   ├── student/        # Student dashboard + all module pages
│   ├── teacher/        # Teacher dashboard + all module pages
│   ├── admin/          # Admin dashboard + all management pages
│   └── api/            # All REST API routes
├── components/
│   ├── layout/         # DashboardLayout, Sidebar, Header
│   └── ui/             # Toast, Badge, Button, Card, Modal, Table, Spinner
├── lib/
│   ├── auth.ts         # NextAuth v5 configuration
│   ├── db.ts           # MongoDB singleton connection
│   └── utils.ts        # Helper functions (GPA, dates, etc.)
├── models/             # 14 Mongoose models
├── scripts/
│   └── seed.ts         # Database seed script
└── types/
    └── index.ts        # TypeScript types + grade scale + semester constants
```

---

## Registration Approval Flow

```
Student submits → pending_advisor
Academic Advisor approves → pending_head
Department Head approves → payment_pending
Student pays (simulated) → paid
Admin reviews → admitted (or rejected)
Enrollments auto-created on admission
```

---

## Grade Scale (4.0 System)

| Marks | Grade | Points |
|-------|-------|--------|
| ≥80   | A+    | 4.00   |
| ≥75   | A     | 3.75   |
| ≥70   | A-    | 3.50   |
| ≥65   | B+    | 3.25   |
| ≥60   | B     | 3.00   |
| ≥55   | B-    | 2.75   |
| ≥50   | C+    | 2.50   |
| ≥45   | C     | 2.25   |
| ≥40   | D     | 2.00   |
| <40   | F     | 0.00   |
