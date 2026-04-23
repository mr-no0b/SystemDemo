import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";
import { ObjectId } from "mongodb";
import { getMongoConnectionConfig } from "../lib/mongo-config";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const { uri: MONGO_URI, target } = getMongoConnectionConfig();
const DEFAULT_KEEP_ADMIN_USER_ID = "admin";

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

function getKeepAdminUserId(argv: string[]) {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--userId" && argv[i + 1]?.trim()) {
      return argv[i + 1].trim();
    }
  }

  return process.env.KEEP_ADMIN_USER_ID?.trim() || DEFAULT_KEEP_ADMIN_USER_ID;
}

async function resetKeepAdmin() {
  const keepAdminUserId = getKeepAdminUserId(process.argv.slice(2));
  console.log(`Connecting to MongoDB (${target})...`);
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  const adminToKeep = await db.collection(USER_COLLECTION).findOne(
    { role: "admin", userId: keepAdminUserId },
    { projection: { _id: 1, userId: 1, name: 1 } }
  );

  if (!adminToKeep) {
    throw new Error(
      `Admin user "${keepAdminUserId}" not found. Aborting so no access account is lost.`
    );
  }

  console.log(
    `Keeping single admin account: ${adminToKeep.userId}${adminToKeep.name ? ` (${adminToKeep.name})` : ""}`
  );

  const userDeletion = await db.collection(USER_COLLECTION).deleteMany({
    _id: { $ne: adminToKeep._id as ObjectId },
  });
  console.log(`Removed ${userDeletion.deletedCount} other user account(s)`);

  for (const collectionName of COLLECTIONS_TO_CLEAR) {
    try {
      const result = await db.collection(collectionName).deleteMany({});
      console.log(`Cleared ${collectionName}: ${result.deletedCount}`);
    } catch {
      console.log(`Skipped ${collectionName} (missing collection)`);
    }
  }

  await mongoose.disconnect();
  console.log(`Database reset complete. Only admin "${keepAdminUserId}" was preserved.`);
}

resetKeepAdmin().catch(async (error) => {
  console.error("Reset failed:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
