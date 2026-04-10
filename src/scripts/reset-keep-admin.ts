import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MONGO_URI = process.env.MONGODB_URI!;
if (!MONGO_URI) throw new Error("MONGODB_URI not set in .env.local");

const USER_COLLECTION = "users";
const COLLECTIONS_TO_CLEAR = [
  "departments",
  "courses",
  "courseofferings",
  "enrollments",
  "registrations",
  "registrationwindows",
  "resultwindows",
  "sessions",
  "attendancerecords",
  "attendancesessions",
  "results",
  "markentries",
  "notices",
  "forumposts",
  "forumanswers",
  "elections",
  "electioncandidates",
  "electionvotes",
  "notes",
  "bookrecommendations",
  "assignments",
  "submissions",
  "notifications",
];

async function resetKeepAdmin() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  const admins = await db.collection(USER_COLLECTION).find({ role: "admin" }).project({ userId: 1 }).toArray();
  if (admins.length === 0) {
    throw new Error("No admin user found. Aborting so no access account is lost.");
  }

  console.log(`Keeping ${admins.length} admin account(s): ${admins.map((admin) => admin.userId).join(", ")}`);

  const userDeletion = await db.collection(USER_COLLECTION).deleteMany({ role: { $ne: "admin" } });
  console.log(`Removed ${userDeletion.deletedCount} non-admin user(s)`);

  for (const collectionName of COLLECTIONS_TO_CLEAR) {
    try {
      const result = await db.collection(collectionName).deleteMany({});
      console.log(`Cleared ${collectionName}: ${result.deletedCount}`);
    } catch {
      console.log(`Skipped ${collectionName} (missing collection)`);
    }
  }

  await mongoose.disconnect();
  console.log("Database reset complete. Admin account(s) preserved.");
}

resetKeepAdmin().catch(async (error) => {
  console.error("Reset failed:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
