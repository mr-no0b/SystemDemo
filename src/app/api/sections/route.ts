import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { CourseSection } from "@/models/CourseSection";
import { Result } from "@/models/Result";

export async function GET(req: NextRequest) {
  const session = await auth();
  await connectDB();
  const url = new URL(req.url);
  const mine = url.searchParams.get("mine") === "true";
  const teacherId = url.searchParams.get("teacherId");
  const dept = url.searchParams.get("dept");
  const sem = url.searchParams.get("semester");

  const query: Record<string, unknown> = { isActive: true };
  if (mine && session) {
    query.teacherId = session.user.id;
  } else if (teacherId) {
    query.teacherId = teacherId;
  } else if (dept || sem) {
    // For registration browsing: only show sections that have a teacher assigned
    query.teacherId = { $exists: true, $ne: null };
  }
  if (dept) query.departmentId = dept;
  if (sem) query.semesterLabel = sem;

  let sections = await CourseSection.find(query)
    .populate("courseId", "code title credits description")
    .populate("teacherId", "name userId")
    .populate("departmentId", "name code")
    .lean();

  // Strip sections from semesters that already have published results.
  // Applies to ALL callers (teacher, admin, student registration) so stale
  // data from before the semester-cleanup feature never leaks through.
  if (sections.length > 0) {
    const combos = [...new Set(sections.map((s) => `${s.semesterLabel}::${s.academicYear}`))];
    const completedCombos = new Set<string>();
    await Promise.all(
      combos.map(async (key) => {
        const [semLabel, acYear] = key.split("::");
        const exists = await Result.exists({ semesterLabel: semLabel, academicYear: acYear, isPublished: true });
        if (exists) completedCombos.add(key);
      })
    );
    sections = sections.filter(
      (s) => !completedCombos.has(`${s.semesterLabel}::${s.academicYear}`)
    );
  }

  return NextResponse.json({ success: true, data: sections });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const body = await req.json();

  const { courseId, semesterLabel, academicYear, teacherId, departmentId, isActive } = body;

  // Fetch only ACTIVE sections for this course + year (inactive = semester closed)
  const existingSections = await CourseSection.find({ courseId, semesterLabel, academicYear, isActive: true }).lean();

  // Prevent assigning the same teacher twice to the same course/year
  if (teacherId) {
    const alreadyAssigned = existingSections.find(
      (s) => s.teacherId?.toString() === teacherId
    );
    if (alreadyAssigned) {
      return NextResponse.json(
        { error: "This teacher is already assigned to this course for this session." },
        { status: 409 }
      );
    }
  }

  // If there is an existing slot with no teacher (auto-created by back-fill), claim it
  const unassigned = existingSections.find((s) => !s.teacherId);
  if (unassigned) {
    const updated = await CourseSection.findByIdAndUpdate(
      unassigned._id,
      {
        $set: {
          teacherId: teacherId || null,
          ...(departmentId && { departmentId }),
          ...(isActive !== undefined && { isActive }),
        },
      },
      { new: true }
    )
      .populate("courseId", "code title credits")
      .populate("teacherId", "name userId")
      .lean();
    return NextResponse.json({ success: true, data: updated });
  }

  // All existing slots are taken — auto-assign the next section letter (A → B → C …)
  const usedLetters = existingSections.map((s) => s.section).sort();
  const nextLetter =
    usedLetters.length === 0
      ? "A"
      : String.fromCharCode(usedLetters[usedLetters.length - 1].charCodeAt(0) + 1);

  try {
    const newSection = await CourseSection.create({ ...body, section: nextLetter });
    return NextResponse.json({ success: true, data: newSection }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 11000) {
      return NextResponse.json(
        { error: "This course is already scheduled for that teacher, semester and section." },
        { status: 409 }
      );
    }
    throw err;
  }
}
