/**
 * AcademiaOne — Fresh Seed Script
 *
 * Creates: 1 admin · 3 departments · 9 teachers · 12 students · courses per dept
 * Does NOT create: advisors, dept heads, CourseSection, Enrollment, Registration
 * (You will configure those manually through the UI)
 *
 * Run: npm run seed
 *
 * Login format:
 *   Admin:    id=admin   pass=admin123
 *   Teachers: id=T1..T9  pass=pass123
 *   Students: id=S1..S12 pass=pass123
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MONGO_URI = process.env.MONGODB_URI!;
if (!MONGO_URI) throw new Error("MONGODB_URI not set in .env.local");

// ── Inline schemas (no path-alias imports needed for ts-node) ─────────────────

const UserSchema = new mongoose.Schema(
  {
    userId:          { type: String, required: true, unique: true },
    name:            { type: String, required: true },
    email:           { type: String, sparse: true },
    password:        { type: String, required: true },
    role:            { type: String, enum: ["student", "teacher", "admin"], required: true },
    departmentId:    { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    currentSemester: { type: String },
    session:         { type: String },   // intake academic year for students
    isActive:        { type: Boolean, default: true },
    forumBanned:     { type: Boolean, default: false },
  },
  { timestamps: true }
);

const DeptSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true },
    code:       { type: String, required: true, unique: true, uppercase: true },
    headId:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    advisorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

const CourseSchema = new mongoose.Schema(
  {
    code:         { type: String, required: true, uppercase: true },
    title:        { type: String, required: true },
    credits:      { type: Number, required: true, default: 3 },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    semesterLabel:{ type: String, required: true },
    description:  { type: String },
    teacherId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);
CourseSchema.index({ code: 1, departmentId: 1 }, { unique: true });

// ── Models ────────────────────────────────────────────────────────────────────

const UserModel   = mongoose.models.User       || mongoose.model("User",       UserSchema);
const DeptModel   = mongoose.models.Department || mongoose.model("Department", DeptSchema);
const CourseModel = mongoose.models.Course     || mongoose.model("Course",     CourseSchema);

// Collections to wipe (all of them for a clean start)
const COLLECTIONS = [
  "users", "departments", "courses",
  "courseofferings", "enrollments", "registrations",
  "registrationwindows", "resultwindows", "sessions",
  "attendancerecords", "attendancesessions",
  "results", "markentries",
  "notices", "forumposts", "forumanswers",
  "elections", "electioncandidates", "electionvotes",
  "notes", "bookrecommendations",
  "assignments", "submissions",
];

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

// ── Course data ───────────────────────────────────────────────────────────────

const CSE_COURSES = [
  // 1-1
  { code: "CSE101", title: "Introduction to Programming",          credits: 3,    semesterLabel: "1-1" },
  { code: "CSE102", title: "Introduction to Programming Lab",      credits: 1.5,  semesterLabel: "1-1" },
  { code: "CSE103", title: "Discrete Mathematics",                 credits: 3,    semesterLabel: "1-1" },
  { code: "MATH101",title: "Engineering Mathematics I",            credits: 3,    semesterLabel: "1-1" },
  { code: "PHY101", title: "Engineering Physics",                  credits: 3,    semesterLabel: "1-1" },
  // 1-2
  { code: "CSE111", title: "Structured Programming",               credits: 3,    semesterLabel: "1-2" },
  { code: "CSE112", title: "Structured Programming Lab",           credits: 1.5,  semesterLabel: "1-2" },
  { code: "CSE113", title: "Digital Logic Design",                 credits: 3,    semesterLabel: "1-2" },
  { code: "CSE114", title: "Digital Logic Design Lab",             credits: 1.5,  semesterLabel: "1-2" },
  { code: "MATH102",title: "Engineering Mathematics II",           credits: 3,    semesterLabel: "1-2" },
  // 2-1
  { code: "CSE201", title: "Data Structures",                      credits: 3,    semesterLabel: "2-1" },
  { code: "CSE202", title: "Data Structures Lab",                  credits: 1.5,  semesterLabel: "2-1" },
  { code: "CSE203", title: "Object-Oriented Programming",          credits: 3,    semesterLabel: "2-1" },
  { code: "CSE204", title: "Object-Oriented Programming Lab",      credits: 1.5,  semesterLabel: "2-1" },
  { code: "CSE205", title: "Computer Architecture",                credits: 3,    semesterLabel: "2-1" },
  // 2-2
  { code: "CSE211", title: "Algorithm Design and Analysis",        credits: 3,    semesterLabel: "2-2" },
  { code: "CSE212", title: "Algorithm Design and Analysis Lab",    credits: 1.5,  semesterLabel: "2-2" },
  { code: "CSE213", title: "Database Systems",                     credits: 3,    semesterLabel: "2-2" },
  { code: "CSE214", title: "Database Systems Lab",                 credits: 1.5,  semesterLabel: "2-2" },
  { code: "CSE215", title: "Numerical Methods",                    credits: 3,    semesterLabel: "2-2" },
];

const EEE_COURSES = [
  // 1-1
  { code: "EEE101", title: "Basic Electrical Engineering",         credits: 3,    semesterLabel: "1-1" },
  { code: "EEE102", title: "Basic Electrical Engineering Lab",     credits: 1.5,  semesterLabel: "1-1" },
  { code: "MATH111",title: "Engineering Mathematics I",            credits: 3,    semesterLabel: "1-1" },
  { code: "PHY111", title: "Engineering Physics",                  credits: 3,    semesterLabel: "1-1" },
  // 1-2
  { code: "EEE111", title: "Analog Electronics",                   credits: 3,    semesterLabel: "1-2" },
  { code: "EEE112", title: "Analog Electronics Lab",               credits: 1.5,  semesterLabel: "1-2" },
  { code: "EEE113", title: "Digital Electronics",                  credits: 3,    semesterLabel: "1-2" },
  { code: "EEE114", title: "Digital Electronics Lab",              credits: 1.5,  semesterLabel: "1-2" },
  // 2-1
  { code: "EEE201", title: "Signals and Systems",                  credits: 3,    semesterLabel: "2-1" },
  { code: "EEE202", title: "Electromagnetic Fields",               credits: 3,    semesterLabel: "2-1" },
  { code: "EEE203", title: "Power Systems I",                      credits: 3,    semesterLabel: "2-1" },
  // 2-2
  { code: "EEE211", title: "Control Systems",                      credits: 3,    semesterLabel: "2-2" },
  { code: "EEE212", title: "Control Systems Lab",                  credits: 1.5,  semesterLabel: "2-2" },
  { code: "EEE213", title: "Microprocessors",                      credits: 3,    semesterLabel: "2-2" },
  { code: "EEE214", title: "Microprocessors Lab",                  credits: 1.5,  semesterLabel: "2-2" },
];

const ME_COURSES = [
  // 1-1
  { code: "ME101",  title: "Engineering Drawing",                  credits: 1.5,  semesterLabel: "1-1" },
  { code: "ME102",  title: "Workshop Practice",                    credits: 1.5,  semesterLabel: "1-1" },
  { code: "MATH121",title: "Engineering Mathematics I",            credits: 3,    semesterLabel: "1-1" },
  { code: "PHY121", title: "Engineering Physics",                  credits: 3,    semesterLabel: "1-1" },
  // 1-2
  { code: "ME111",  title: "Engineering Mechanics",                credits: 3,    semesterLabel: "1-2" },
  { code: "ME112",  title: "Thermodynamics I",                     credits: 3,    semesterLabel: "1-2" },
  { code: "ME113",  title: "Material Science",                     credits: 3,    semesterLabel: "1-2" },
  // 2-1
  { code: "ME201",  title: "Fluid Mechanics",                      credits: 3,    semesterLabel: "2-1" },
  { code: "ME202",  title: "Mechanics of Materials",               credits: 3,    semesterLabel: "2-1" },
  { code: "ME203",  title: "Manufacturing Processes",              credits: 3,    semesterLabel: "2-1" },
  // 2-2
  { code: "ME211",  title: "Heat Transfer",                        credits: 3,    semesterLabel: "2-2" },
  { code: "ME212",  title: "Machine Design",                       credits: 3,    semesterLabel: "2-2" },
  { code: "ME213",  title: "Industrial Engineering",               credits: 3,    semesterLabel: "2-2" },
];

// ── Main seed ─────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected\n");

  // ── 1. Wipe entire database ────────────────────────────────────────────────
  console.log("🧹 Clearing all collections...");
  const db = mongoose.connection.db!;
  for (const col of COLLECTIONS) {
    try {
      await db.collection(col).deleteMany({});
      process.stdout.write(`   ✓ ${col}\n`);
    } catch {
      // collection may not exist yet — that's fine
    }
  }
  console.log("✅ Database cleared\n");

  // ── 2. Departments ────────────────────────────────────────────────────────
  const [cse, eee, me] = await DeptModel.insertMany([
    { name: "Computer Science & Engineering",    code: "CSE" },
    { name: "Electrical & Electronic Engineering", code: "EEE" },
    { name: "Mechanical Engineering",             code: "ME"  },
  ]);
  console.log("🏛️  3 departments created: CSE · EEE · ME");

  // ── 3. Admin ──────────────────────────────────────────────────────────────
  await UserModel.create({
    userId: "admin",
    name: "System Admin",
    email: "admin@academia.edu",
    password: await hash("admin123"),
    role: "admin",
    isActive: true,
  });
  console.log("🔐 Admin created  (id: admin  /  pass: admin123)");

  // ── 4. Teachers ───────────────────────────────────────────────────────────
  const teacherPw = await hash("pass123");

  const teacherData = [
    // CSE — T1, T2, T3
    { userId: "T1", name: "Dr. Arman Hossain",    email: "t1@academia.edu", departmentId: cse._id },
    { userId: "T2", name: "Dr. Sunita Rahman",    email: "t2@academia.edu", departmentId: cse._id },
    { userId: "T3", name: "Dr. Farhan Kabir",     email: "t3@academia.edu", departmentId: cse._id },
    // EEE — T4, T5, T6
    { userId: "T4", name: "Dr. Rakib Islam",      email: "t4@academia.edu", departmentId: eee._id },
    { userId: "T5", name: "Dr. Mitu Begum",       email: "t5@academia.edu", departmentId: eee._id },
    { userId: "T6", name: "Dr. Nayeem Chowdhury", email: "t6@academia.edu", departmentId: eee._id },
    // ME — T7, T8, T9
    { userId: "T7", name: "Dr. Samir Uddin",      email: "t7@academia.edu", departmentId: me._id  },
    { userId: "T8", name: "Dr. Laila Nur",        email: "t8@academia.edu", departmentId: me._id  },
    { userId: "T9", name: "Dr. Tanvir Alam",      email: "t9@academia.edu", departmentId: me._id  },
  ];

  await UserModel.insertMany(
    teacherData.map((t) => ({ ...t, password: teacherPw, role: "teacher", isActive: true }))
  );
  console.log("👩‍🏫 9 teachers created (T1–T9 / pass: pass123)");
  console.log("   CSE: T1 · T2 · T3   |   EEE: T4 · T5 · T6   |   ME: T7 · T8 · T9");

  // ── 5. Students ───────────────────────────────────────────────────────────
  const studentPw = await hash("pass123");

  const studentData = [
    // CSE — S1..S4
    { userId: "S1",  name: "Anika Islam",      email: "s1@academia.edu",  departmentId: cse._id, currentSemester: "1-1", session: "2025-26" },
    { userId: "S2",  name: "Bijoy Das",        email: "s2@academia.edu",  departmentId: cse._id, currentSemester: "1-1", session: "2025-26" },
    { userId: "S3",  name: "Chandra Roy",      email: "s3@academia.edu",  departmentId: cse._id, currentSemester: "2-1", session: "2024-25" },
    { userId: "S4",  name: "Dipa Saha",        email: "s4@academia.edu",  departmentId: cse._id, currentSemester: "2-1", session: "2024-25" },
    // EEE — S5..S8
    { userId: "S5",  name: "Emran Hasan",      email: "s5@academia.edu",  departmentId: eee._id, currentSemester: "1-1", session: "2025-26" },
    { userId: "S6",  name: "Farida Khanam",    email: "s6@academia.edu",  departmentId: eee._id, currentSemester: "1-1", session: "2025-26" },
    { userId: "S7",  name: "Galib Mahmud",     email: "s7@academia.edu",  departmentId: eee._id, currentSemester: "1-2", session: "2025-26" },
    { userId: "S8",  name: "Hasna Akter",      email: "s8@academia.edu",  departmentId: eee._id, currentSemester: "1-2", session: "2025-26" },
    // ME — S9..S12
    { userId: "S9",  name: "Imran Ali",        email: "s9@academia.edu",  departmentId: me._id,  currentSemester: "1-1", session: "2025-26" },
    { userId: "S10", name: "Jannat Hossain",   email: "s10@academia.edu", departmentId: me._id,  currentSemester: "1-1", session: "2025-26" },
    { userId: "S11", name: "Karim Uddin",      email: "s11@academia.edu", departmentId: me._id,  currentSemester: "1-2", session: "2025-26" },
    { userId: "S12", name: "Lina Begum",       email: "s12@academia.edu", departmentId: me._id,  currentSemester: "1-2", session: "2025-26" },
  ];

  await UserModel.insertMany(
    studentData.map((s) => ({ ...s, password: studentPw, role: "student", isActive: true }))
  );
  console.log("🎓 12 students created (S1–S12 / pass: pass123)");
  console.log("   CSE: S1–S4   |   EEE: S5–S8   |   ME: S9–S12");

  // ── 6. Courses ────────────────────────────────────────────────────────────
  const cseCourses = await CourseModel.insertMany(
    CSE_COURSES.map((c) => ({ ...c, departmentId: cse._id }))
  );
  const eeeCourses = await CourseModel.insertMany(
    EEE_COURSES.map((c) => ({ ...c, departmentId: eee._id }))
  );
  const meCourses = await CourseModel.insertMany(
    ME_COURSES.map((c) => ({ ...c, departmentId: me._id }))
  );

  const total = cseCourses.length + eeeCourses.length + meCourses.length;
  console.log(`📚 ${total} courses created`);
  console.log(`   CSE: ${cseCourses.length} courses (1-1 to 2-2)`);
  console.log(`   EEE: ${eeeCourses.length} courses (1-1 to 2-2)`);
  console.log(`   ME:  ${meCourses.length} courses (1-1 to 2-2)`);

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log("\n✨ Seed complete!\n");
  console.log("─────────────────────────────────────────────────────");
  console.log("  ROLE     ID        PASSWORD");
  console.log("─────────────────────────────────────────────────────");
  console.log("  Admin    admin     admin123");
  console.log("  Teacher  T1–T9    pass123");
  console.log("  Student  S1–S12   pass123");
  console.log("─────────────────────────────────────────────────────");
  console.log("\nNext steps (do these in the UI):");
  console.log("  1. Admin → Departments → assign Head & Advisors");
  console.log("  2. Admin → Course Sections → create sections & assign teachers");
  console.log("  3. Students → Registration → enroll in courses");
  console.log("  4. Teacher → Attendance → configure planned classes");
  console.log();

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
