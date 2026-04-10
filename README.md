# AcademiaOne

AcademiaOne is a full-stack university management system built with Next.js App Router, TypeScript, Tailwind CSS, MongoDB Atlas, and NextAuth credentials-based authentication.

The project supports separate student, teacher, and admin workflows for registration, classrooms, attendance, results, notices, elections, books, notes, and a forum system with duplicate-question blocking.

## Current Status

This repository is no longer in seeded demo mode.

- Login uses real users stored in MongoDB.
- The login form does not autofill demo credentials.
- The database was reset to keep only the existing admin account.
- There is no seed script in the project anymore.
- Forum duplicate detection stores per-question vectors in MongoDB and uses them for similarity checks.
- Student registration includes a dummy payment page that redirects back with a payment success state.

If you run this project against the current database, only the preserved admin user will remain unless you add more users through the app or directly in MongoDB.

## Tech Stack

- Next.js 16.1.6
- React 19
- TypeScript 5
- Tailwind CSS 4
- MongoDB Atlas with Mongoose
- NextAuth v5 beta
- bcryptjs
- Nodemailer

## Main Modules

### Student

- Dashboard
- Registration
- Dummy payment completion flow
- Classrooms
- Attendance
- Results
- Notes
- Notices
- Elections
- Forum access

### Teacher

- Dashboard
- Course/classroom management
- Attendance marking
- Registration approvals
- Result publishing
- Notices
- Book recommendations
- Election moderation
- Forum moderation tools for student bans

### Admin

- Dashboard
- User management
- Department management
- Course and section management
- Admissions and registration windows
- Session management
- Notices
- Results window controls

### Forum

- Ask and answer questions
- Upvote and downvote
- Accept answers
- Student ban controls for teachers
- Duplicate solved-question blocking
- Stored vector encoding on every question

## Duplicate Question Detection

Forum duplicate detection uses stored sparse vectors, not just temporary in-memory comparison.

For every forum question:

- the title and body are normalized and tokenized
- vector terms are generated and stored on the `ForumPost` document
- solved questions are compared against new questions using cosine similarity plus overlap-based scoring
- if a new question is too similar to a solved one, posting is blocked and similar solved questions are returned to the UI

Relevant files:

- [`src/lib/forum-similarity.ts`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/lib/forum-similarity.ts)
- [`src/models/ForumPost.ts`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/models/ForumPost.ts)
- [`src/app/api/forum/posts/route.ts`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/app/api/forum/posts/route.ts)

## Registration and Payment Flow

The registration flow is approval-based:

1. Student submits registration
2. Advisor approves
3. Department head approves
4. Student is sent to a dummy online payment page
5. Payment completion redirects back to registration
6. The student is admitted and enrollments are created

Relevant files:

- [`src/app/student/registration/page.tsx`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/app/student/registration/page.tsx)
- [`src/app/student/registration/payment/[id]/page.tsx`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/app/student/registration/payment/%5Bid%5D/page.tsx)
- [`src/app/api/registrations/[id]/route.ts`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/app/api/registrations/%5Bid%5D/route.ts)

## Authentication

- Credentials auth only
- Users are validated from MongoDB
- Passwords are bcrypt hashes
- Role-specific redirects are handled after login

Relevant files:

- [`src/lib/auth.ts`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/lib/auth.ts)
- [`src/lib/auth.config.ts`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/lib/auth.config.ts)
- [`src/app/login/page.tsx`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/app/login/page.tsx)

## Project Structure

```text
src/
├── app/
│   ├── admin/
│   ├── teacher/
│   ├── student/
│   ├── forum/
│   ├── login/
│   └── api/
├── components/
│   ├── layout/
│   └── ui/
├── lib/
│   ├── auth.ts
│   ├── auth.config.ts
│   ├── db.ts
│   ├── email.ts
│   ├── forum-similarity.ts
│   └── utils.ts
├── models/
├── scripts/
│   └── reset-keep-admin.ts
└── types/
```

## Installation

```bash
cd "/home/lionking/Desktop/System Final/AcademiaOne"
npm install
```

## Environment Variables

Create `.env.local` with:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/academiaone?retryWrites=true&w=majority
NEXTAUTH_SECRET=replace-with-a-long-random-secret
NEXTAUTH_URL=http://localhost:3000
```

Notes:

- `MONGODB_URI` must point to your MongoDB Atlas cluster.
- If the password contains special characters, URL-encode it.
- Your Atlas network access rules must allow your current IP.

## Running the Project

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Available npm Scripts

```bash
npm run dev
npm run build
npm run start
npm run reset:keep-admin
```

### `npm run reset:keep-admin`

This script connects to MongoDB and removes all application data except existing admin user accounts.

It preserves:

- users with `role: "admin"`

It clears:

- non-admin users
- departments
- courses
- registrations
- forum posts and answers
- elections
- notes
- notices
- assignments
- notifications
- and the rest of the main app collections

Relevant file:

- [`src/scripts/reset-keep-admin.ts`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/scripts/reset-keep-admin.ts)

## Database Notes

Current expected state after the last reset:

- the database keeps the existing admin account
- most academic and community data has been cleared

Because there is no seed script now, a fresh database will not automatically create demo users, departments, or courses.

If you need a working first admin on a brand-new database, create an admin user document manually with:

- a unique `userId`
- `role: "admin"`
- `isActive: true`
- a bcrypt-hashed password

## Git Ignore Notes

The repository ignores generated and local-only files such as:

- `.next/`
- `node_modules/`
- `.env.local`
- editor settings
- logs
- PDFs and local reference files

## Known Notes

- Next.js may warn that `middleware` naming is deprecated in favor of `proxy`; that does not stop the app from running.
- There is no seeded demo dataset in the current project state.

## License

No license file is currently included in this repository.
