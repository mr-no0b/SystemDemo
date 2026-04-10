import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { Department } from "@/models/Department";
import bcrypt from "bcryptjs";

type CsvRole = "student" | "teacher";
type CredentialRow = {
  name: string;
  email?: string;
  userId: string;
  password: string;
  role: CsvRole;
  isActive: boolean;
  department?: string;
  advisor?: string;
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(csv: string) {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { headers: [], rows: [] as Record<string, string>[] };
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? "";
    });
    return row;
  });

  return { headers, rows };
}

function generateRandomPassword(length = 10) {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < length; i += 1) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  return password;
}

async function getNextSerial(prefix: "S" | "T") {
  const regex = new RegExp(`^${prefix}(\\d+)$`);
  const users = await User.find({ userId: { $regex: regex } }).select("userId").lean();
  const maxSerial = users.reduce((max, user) => {
    const match = user.userId.match(regex);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);
  return maxSerial + 1;
}

function escapeCsv(value: string | undefined) {
  const safe = value ?? "";
  if (!safe.includes(",") && !safe.includes('"') && !safe.includes("\n")) return safe;
  return `"${safe.replace(/"/g, '""')}"`;
}

function compareSerialUserIds(left: string, right: string) {
  const parse = (value: string) => {
    const match = value.match(/^([A-Za-z]+)(\d+)$/);
    if (!match) return null;
    return { prefix: match[1], serial: Number(match[2]) };
  };

  const leftParsed = parse(left);
  const rightParsed = parse(right);

  if (!leftParsed || !rightParsed) {
    return left.localeCompare(right, undefined, { numeric: true });
  }
  if (leftParsed.prefix !== rightParsed.prefix) {
    return leftParsed.prefix.localeCompare(rightParsed.prefix);
  }
  return leftParsed.serial - rightParsed.serial;
}

function buildCredentialsCsv(role: CsvRole, users: CredentialRow[]) {
  if (role === "teacher") {
    return [
      "name,email,userId,password,role,department,isActive",
      ...users.map((user) => [
        escapeCsv(user.name),
        escapeCsv(user.email),
        escapeCsv(user.userId),
        escapeCsv(user.password),
        escapeCsv(user.role),
        escapeCsv(user.department),
        String(user.isActive),
      ].join(",")),
    ].join("\n");
  }

  return [
    "name,email,userId,password,role,department,advisor,isActive",
    ...users.map((user) => [
      escapeCsv(user.name),
      escapeCsv(user.email),
      escapeCsv(user.userId),
      escapeCsv(user.password),
      escapeCsv(user.role),
      escapeCsv(user.department),
      escapeCsv(user.advisor),
      String(user.isActive),
    ].join(",")),
  ].join("\n");
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  const dept = url.searchParams.get("dept");
  const search = url.searchParams.get("search") ?? url.searchParams.get("q");

  const query: Record<string, unknown> = {};
  if (role) query.role = role;
  if (dept) query.departmentId = dept;
  if (search) query.$or = [
    { name: { $regex: search, $options: "i" } },
    { userId: { $regex: search, $options: "i" } },
  ];

  const users = await User.find(query)
    .select("-password")
    .populate("departmentId", "name code")
    .populate("advisorId", "name userId")
    .limit(100)
    .lean();

  users.sort((left, right) => compareSerialUserIds(left.userId, right.userId));

  return NextResponse.json({ success: true, data: users });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const body = await req.json();
  if (body.mode === "bulk_csv_auto") {
    const role = body.role as CsvRole | undefined;
    const csv = typeof body.csv === "string" ? body.csv : "";
    const departmentId = body.departmentId as string | null | undefined;
    const advisorOrder = Array.isArray(body.advisorOrder) ? body.advisorOrder.map(String) : [];

    if (!role || !["student", "teacher"].includes(role)) {
      return NextResponse.json({ error: "A valid role is required for CSV import" }, { status: 400 });
    }
    if (!csv.trim()) {
      return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });
    }

    const { headers, rows } = parseCsv(csv);
    const requiredHeaders = ["name", "email"];

    const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        { error: `Missing CSV columns: ${missingHeaders.join(", ")}` },
        { status: 400 }
      );
    }

    const normalizedRows = rows.map((row, index) => ({
      rowNumber: index + 2,
      name: row.name?.trim() ?? "",
      email: row.email?.trim() ?? "",
      isActive: true,
    }));

    const errors: string[] = [];
    const seenEmails = new Set<string>();
    const invalidRows = new Set<number>();

    for (const row of normalizedRows) {
      if (!row.name) {
        errors.push(`Row ${row.rowNumber}: name is required`);
        invalidRows.add(row.rowNumber);
        continue;
      }
      if (row.email) {
        if (seenEmails.has(row.email.toLowerCase())) {
          errors.push(`Row ${row.rowNumber}: duplicate email "${row.email}" inside CSV`);
          invalidRows.add(row.rowNumber);
          continue;
        }
        seenEmails.add(row.email.toLowerCase());
      }
    }

    const candidateEmails = normalizedRows.map((row) => row.email).filter(Boolean);

    const existingUsersByEmail = candidateEmails.length > 0
      ? await User.find({ email: { $in: candidateEmails } }).select("email").lean()
      : [];
    const existingEmailSet = new Set(
      existingUsersByEmail.map((user) => String(user.email ?? "").toLowerCase()).filter(Boolean)
    );

    const rowsToCreate = normalizedRows.filter((row) => {
      if (!row.name || invalidRows.has(row.rowNumber)) return false;
      if (row.email && existingEmailSet.has(row.email.toLowerCase())) {
        errors.push(`Row ${row.rowNumber}: email "${row.email}" already exists`);
        return false;
      }
      return true;
    });

    if (rowsToCreate.length === 0) {
      return NextResponse.json(
        { error: "No valid users found in CSV", errors },
        { status: 400 }
      );
    }

    let departmentName: string | undefined;
    let teacherDepartmentValue: string | undefined;
    let orderedAdvisors: Array<{ _id: string; name: string; userId: string }> = [];

    if (role === "teacher") {
      if (departmentId === undefined) {
        return NextResponse.json({ error: "Please select a department or the global option for teachers." }, { status: 400 });
      }

      if (departmentId) {
        const department = await Department.findById(departmentId).select("name code").lean();
        if (!department) {
          return NextResponse.json({ error: "Selected teacher department not found." }, { status: 404 });
        }
        teacherDepartmentValue = String(departmentId);
        departmentName = department.code;
      } else {
        teacherDepartmentValue = undefined;
        departmentName = "GLOBAL";
      }
    }

    if (role === "student") {
      if (!departmentId) {
        return NextResponse.json({ error: "Please select a department for student import." }, { status: 400 });
      }
      if (advisorOrder.length === 0) {
        return NextResponse.json({ error: "Please choose at least one advisor for student distribution." }, { status: 400 });
      }

      const department = await Department.findById(departmentId)
        .select("name code")
        .lean();

      if (!department) {
        return NextResponse.json({ error: "Selected student department not found." }, { status: 404 });
      }

      const departmentTeachers = await User.find({
        role: "teacher",
        departmentId,
        isActive: true,
      })
        .select("name userId")
        .lean();

      const departmentAdvisors = new Map(
        departmentTeachers
          .map((advisor) => [advisor._id.toString(), { _id: advisor._id.toString(), name: advisor.name, userId: advisor.userId }])
      );

      for (const advisorId of advisorOrder) {
        if (!departmentAdvisors.has(advisorId)) {
          return NextResponse.json({ error: "Advisor list does not match the selected department." }, { status: 400 });
        }
      }

      orderedAdvisors = advisorOrder
        .map((advisorId: string) => departmentAdvisors.get(advisorId))
        .filter((advisor: { _id: string; name: string; userId: string } | undefined): advisor is { _id: string; name: string; userId: string } => Boolean(advisor));

      if (orderedAdvisors.length === 0) {
        return NextResponse.json({ error: "No valid advisors found for this department." }, { status: 400 });
      }

      departmentName = department.code;
    }

    const prefix = role === "student" ? "S" : "T";
    const nextSerial = await getNextSerial(prefix);
    const generatedUsers = await Promise.all(rowsToCreate.map(async (row, index) => {
      const userId = `${prefix}${nextSerial + index}`;
      const plainPassword = generateRandomPassword();
      const advisor = role === "student" ? orderedAdvisors[index % orderedAdvisors.length] : undefined;

      const credential = {
        name: row.name,
        email: row.email || undefined,
        userId,
        password: plainPassword,
        role,
        department: departmentName,
        advisor: advisor ? `${advisor.name} (${advisor.userId})` : undefined,
        isActive: row.isActive,
      };

      return {
        credential,
        doc: {
          userId,
          name: row.name,
          email: row.email || undefined,
          password: await bcrypt.hash(plainPassword, 12),
          role,
          departmentId: role === "teacher" ? teacherDepartmentValue : departmentId,
          advisorId: advisor?._id,
          isActive: row.isActive,
        },
      };
    }));

    const credentials = generatedUsers.map((entry) => entry.credential);
    const docs = generatedUsers.map((entry) => entry.doc);

    await User.insertMany(docs, { ordered: false });

    return NextResponse.json({
      success: true,
      createdCount: docs.length,
      warningCount: errors.length,
      errors,
      credentials,
      credentialsCsv: buildCredentialsCsv(role, credentials),
    }, { status: 201 });
  }

  const { userId, name, email, password, role, departmentId, advisorId, currentSemester, session: userSession, profileImage } = body;

  if (!userId || !name || !password || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const existingId = await User.findOne({ userId });
  if (existingId) {
    return NextResponse.json({ error: "User ID already exists" }, { status: 409 });
  }

  if (email) {
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  const hashed = await bcrypt.hash(password, 12);
  try {
    const user = await User.create({
      userId,
      name,
      email: email || undefined,
      password: hashed,
      role,
      departmentId: departmentId || undefined,
      advisorId: advisorId || undefined,
      currentSemester: currentSemester || undefined,
      session: userSession || undefined,
      profileImage: profileImage || undefined,
    });
    const { password: _, ...userData } = user.toObject();
    return NextResponse.json({ success: true, data: userData }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 11000) {
      const keyValue = (err as { keyValue?: Record<string, unknown> })?.keyValue ?? {};
      const field = Object.keys(keyValue)[0] ?? "field";
      return NextResponse.json({ error: `Duplicate value for ${field}` }, { status: 409 });
    }
    throw err;
  }
}
