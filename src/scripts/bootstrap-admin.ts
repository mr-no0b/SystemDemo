import mongoose from "mongoose";
import * as dotenv from "dotenv";
import path from "path";
import bcrypt from "bcryptjs";
import { getMongoConnectionConfig } from "../lib/mongo-config";
import { User } from "../models/User";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type ParsedArgs = {
  userId?: string;
  password?: string;
  name?: string;
  email?: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--userId" && next) {
      parsed.userId = next;
      i += 1;
      continue;
    }
    if (arg === "--password" && next) {
      parsed.password = next;
      i += 1;
      continue;
    }
    if (arg === "--name" && next) {
      parsed.name = next;
      i += 1;
      continue;
    }
    if (arg === "--email" && next) {
      parsed.email = next;
      i += 1;
    }
  }

  return parsed;
}

function printUsage() {
  console.log(
    [
      "Usage:",
      'npm run bootstrap:admin:local -- --userId admin --password admin123 --name "Admin"',
      "",
      "Optional:",
      "--email admin@example.com",
    ].join("\n")
  );
}

async function bootstrapAdmin() {
  const args = parseArgs(process.argv.slice(2));
  const userId = args.userId?.trim();
  const password = args.password;
  const name = args.name?.trim();
  const email = args.email?.trim();

  if (!userId || !password) {
    printUsage();
    throw new Error("Both --userId and --password are required.");
  }

  const { target, uri } = getMongoConnectionConfig();
  console.log(`Connecting to MongoDB (${target})...`);
  console.log(`Target URI: ${uri.replace(/\/\/.*@/, "//<credentials>@")}`);

  await mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 10000,
  });

  const hashedPassword = await bcrypt.hash(password, 12);
  const existing = await User.findOne({ userId, role: "admin" });

  if (existing) {
    existing.name = name || existing.name || "Admin";
    if (email !== undefined) {
      existing.email = email || undefined;
    }
    existing.password = hashedPassword;
    existing.isActive = true;
    await existing.save();
    console.log(`Updated admin user "${userId}".`);
  } else {
    await User.create({
      userId,
      name: name || "Admin",
      email: email || undefined,
      password: hashedPassword,
      role: "admin",
      isActive: true,
    });
    console.log(`Created admin user "${userId}".`);
  }

  console.log("Admin bootstrap complete.");
}

bootstrapAdmin().catch(async (error) => {
  console.error("Admin bootstrap failed:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
}).finally(async () => {
  await mongoose.disconnect().catch(() => undefined);
});
