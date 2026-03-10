import mongoose from "mongoose";

// Import all models here so their schemas are always registered before any query runs.
// This prevents MissingSchemaError when using .populate() across relations.
import "@/models/User";
import "@/models/Department";
import "@/models/Course";
import "@/models/CourseSection";
import "@/models/Enrollment";
import "@/models/Registration";
import "@/models/Assignment";
import "@/models/Submission";
import "@/models/AttendanceRecord";
import "@/models/Result";
import "@/models/Notice";
import "@/models/ForumPost";
import "@/models/ForumAnswer";
import "@/models/Election";
import "@/models/ElectionCandidate";
import "@/models/ElectionVote";
import "@/models/Note";
import "@/models/BookRecommendation";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable in .env.local");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Use a global to cache the connection in development
declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache;
}

let cached: MongooseCache = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    // Always use the latest schema in development (safe in production too)
    mongoose.set("overwriteModels", true);
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
    };
    cached.promise = mongoose.connect(MONGODB_URI, opts);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
