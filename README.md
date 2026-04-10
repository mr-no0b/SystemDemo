# AcademiaOne

AcademiaOne is a university management platform built with Next.js, TypeScript, Tailwind CSS, MongoDB Atlas, and NextAuth. It brings student, teacher, and admin workflows into a single web application, covering registration, classrooms, attendance, results, notices, elections, books, notes, and a moderated Q&A forum.

## Overview

The system is organized around three primary roles:

- Students can manage registration, view attendance and results, access classrooms, participate in elections, browse notices, and use the forum.
- Teachers can handle course-related workflows, attendance, result entry, registration approvals, notices, books, and forum moderation actions.
- Admins can manage users, departments, courses, sessions, registration windows, admissions, and high-level system data.

The application uses a credentials-based login flow backed by MongoDB. Passwords are stored as bcrypt hashes, and role-specific access is enforced through server-side session checks.

## Core Features

### Student Features

- Role-based dashboard
- Semester registration workflow
- Dummy payment step for registration completion
- Classroom access and assignment workflows
- Attendance view
- Result view
- Notes and books
- Election participation
- Notices
- Forum participation

### Teacher Features

- Teacher dashboard
- Classroom and course workflows
- Attendance marking
- Registration approvals
- Result entry and publishing
- Notice management
- Book recommendation management
- Election approval and moderation
- Forum moderation support for student bans

### Admin Features

- Admin dashboard
- User management
- Department management
- Course and section management
- Session management
- Registration window management
- Admissions overview
- Result window management
- Notice management

### Forum Features

- Ask and answer questions
- Upvote and downvote
- Accept answers
- Teacher-led student ban controls
- Duplicate solved-question blocking
- Stored vector encoding for each posted question

## Duplicate Question Detection

The forum includes duplicate-question detection for solved posts.

When a new forum question is submitted:

1. The title and body are normalized and tokenized.
2. Sparse vector representations are generated.
3. Those vectors are stored on the `ForumPost` document in MongoDB.
4. The new post is compared against previously solved questions using cosine similarity and overlap-based scoring.
5. If a close solved match is found, the new question is blocked and the similar solved questions are shown instead.

Relevant implementation files:

- [`src/lib/forum-similarity.ts`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/lib/forum-similarity.ts)
- [`src/models/ForumPost.ts`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/models/ForumPost.ts)
- [`src/app/api/forum/posts/route.ts`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/app/api/forum/posts/route.ts)

## Registration Flow

The registration workflow is approval-based:

1. Student submits a registration request.
2. Advisor approves it.
3. Department head approves it.
4. Student completes the dummy payment flow.
5. The system admits the student and creates enrollments.

Relevant implementation files:

- [`src/app/student/registration/page.tsx`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/app/student/registration/page.tsx)
- [`src/app/student/registration/payment/[id]/page.tsx`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/app/student/registration/payment/%5Bid%5D/page.tsx)
- [`src/app/api/registrations/[id]/route.ts`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/app/api/registrations/%5Bid%5D/route.ts)

## Tech Stack

- Next.js 16
- React 19
- TypeScript 5
- Tailwind CSS 4
- MongoDB Atlas
- Mongoose
- NextAuth v5 beta
- bcryptjs
- Nodemailer

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

## Getting Started

### 1. Install dependencies

```bash
cd "/home/lionking/Desktop/System Final/AcademiaOne"
npm install
```

### 2. Configure environment variables

Create `.env.local`:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/academiaone?retryWrites=true&w=majority
NEXTAUTH_SECRET=replace-with-a-long-random-secret
NEXTAUTH_URL=http://localhost:3000
```

Notes:

- `MONGODB_URI` should point to your MongoDB Atlas cluster.
- If your database password contains reserved URL characters, encode it.
- Your Atlas network access rules must allow your current IP.

### 3. Ensure an admin account exists

This project does not include a seed script. Before using the app, your database should contain at least one active admin user with:

- a unique `userId`
- `role: "admin"`
- `isActive: true`
- a bcrypt-hashed password

The login page does not autofill any credentials, so sign-in always uses database-backed values.

### 4. Run the development server

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run reset:keep-admin
```

### `npm run reset:keep-admin`

This script clears application data while preserving all existing admin accounts in MongoDB.

It removes:

- non-admin users
- departments
- courses
- registrations
- forum posts and answers
- notices
- elections
- notes
- assignments
- notifications
- other main application collections

Relevant file:

- [`src/scripts/reset-keep-admin.ts`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/scripts/reset-keep-admin.ts)

## Authentication

AcademiaOne uses credentials-based authentication with NextAuth.

- User lookup is performed against MongoDB.
- Passwords are verified with bcrypt.
- Sessions use JWT strategy.
- Users are redirected based on their role after login.

Relevant files:

- [`src/lib/auth.ts`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/lib/auth.ts)
- [`src/lib/auth.config.ts`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/lib/auth.config.ts)
- [`src/app/login/page.tsx`](/home/lionking/Desktop/System%20Final/AcademiaOne/src/app/login/page.tsx)

## Operational Notes

- The login form is intentionally blank by default and does not preload demo credentials.
- The forum stores vector encodings automatically for every newly posted question.
- The duplicate detector can also refresh old solved forum posts that do not yet have the latest stored vector format.
- A dummy payment interface is used for registration confirmation; it does not process real payments.

## Development Notes

- MongoDB models are registered centrally through the database bootstrap to avoid schema registration issues during population.
- The app uses App Router APIs and role-specific server/client pages.
- Build output, local environment files, editor state, and local reference files are ignored through `.gitignore`.

## License

No license file is currently included in this repository.
