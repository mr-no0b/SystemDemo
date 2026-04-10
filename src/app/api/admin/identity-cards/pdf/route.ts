import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { User } from "@/models/User";

type StudentCardRecord = {
  name: string;
  userId: string;
  profileImage?: string;
  departmentId?: { name?: string; code?: string } | null;
};

function parseStudentSerial(userId: string) {
  const match = userId.trim().match(/^S(\d+)$/i);
  return match ? Number(match[1]) : null;
}

function compareStudentIds(left: string, right: string) {
  const leftSerial = parseStudentSerial(left);
  const rightSerial = parseStudentSerial(right);

  if (leftSerial === null || rightSerial === null) {
    return left.localeCompare(right, undefined, { numeric: true });
  }

  return leftSerial - rightSerial;
}

function truncate(text: string, maxLength: number) {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

async function embedRemoteImage(
  pdfDoc: PDFDocument,
  imageUrl: string,
  cache: Map<string, Promise<PDFImage | null>>
) {
  if (!cache.has(imageUrl)) {
    cache.set(
      imageUrl,
      (async () => {
        try {
          const response = await fetch(imageUrl);
          if (!response.ok) return null;

          const contentType = response.headers.get("content-type") ?? "";
          const bytes = await response.arrayBuffer();

          if (contentType.includes("png") || imageUrl.match(/\.png(\?|$)/i)) {
            return await pdfDoc.embedPng(bytes);
          }

          if (
            contentType.includes("jpeg") ||
            contentType.includes("jpg") ||
            imageUrl.match(/\.(jpe?g)(\?|$)/i)
          ) {
            return await pdfDoc.embedJpg(bytes);
          }

          return null;
        } catch {
          return null;
        }
      })()
    );
  }

  return cache.get(imageUrl)!;
}

function drawPhotoPlaceholder(page: Parameters<PDFDocument["addPage"]>[0] extends never ? never : any, x: number, y: number, width: number, height: number, font: Awaited<ReturnType<PDFDocument["embedFont"]>>) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderWidth: 1,
    borderColor: rgb(0.82, 0.85, 0.91),
    color: rgb(0.97, 0.98, 1),
  });
  page.drawText("PHOTO", {
    x: x + 12,
    y: y + height / 2 - 5,
    size: 10,
    font,
    color: rgb(0.58, 0.63, 0.72),
  });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";

  const fromSerial = parseStudentSerial(from);
  const toSerial = parseStudentSerial(to);

  if (fromSerial === null || toSerial === null) {
    return NextResponse.json({ error: "Please provide a valid student range like S1 to S10." }, { status: 400 });
  }

  if (fromSerial > toSerial) {
    return NextResponse.json({ error: "The start student ID must be before or equal to the end student ID." }, { status: 400 });
  }

  await connectDB();

  const students = await User.find({ role: "student", userId: { $regex: /^S\d+$/ } })
    .select("name userId profileImage departmentId")
    .populate("departmentId", "name code")
    .lean();

  const selected = (students as StudentCardRecord[])
    .filter((student) => {
      const serial = parseStudentSerial(student.userId);
      return serial !== null && serial >= fromSerial && serial <= toSerial;
    })
    .sort((left, right) => compareStudentIds(left.userId, right.userId));

  if (selected.length === 0) {
    return NextResponse.json({ error: "No students were found in that range." }, { status: 404 });
  }

  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const imageCache = new Map<string, Promise<PDFImage | null>>();

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 28;
  const marginY = 28;
  const gapX = 18;
  const gapY = 18;
  const columns = 2;
  const rows = 4;
  const cardsPerPage = columns * rows;
  const cardWidth = (pageWidth - marginX * 2 - gapX) / columns;
  const cardHeight = (pageHeight - marginY * 2 - gapY * (rows - 1)) / rows;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);

  for (let index = 0; index < selected.length; index += 1) {
    if (index > 0 && index % cardsPerPage === 0) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
    }

    const slot = index % cardsPerPage;
    const col = slot % columns;
    const row = Math.floor(slot / columns);

    const x = marginX + col * (cardWidth + gapX);
    const y = pageHeight - marginY - cardHeight - row * (cardHeight + gapY);
    const student = selected[index];

    page.drawRectangle({
      x,
      y,
      width: cardWidth,
      height: cardHeight,
      borderWidth: 1,
      borderColor: rgb(0.82, 0.85, 0.91),
      color: rgb(1, 1, 1),
    });

    page.drawRectangle({
      x,
      y: y + cardHeight - 34,
      width: cardWidth,
      height: 34,
      color: rgb(0.31, 0.27, 0.95),
    });

    page.drawText("AcademiaOne", {
      x: x + 14,
      y: y + cardHeight - 22,
      size: 13,
      font: bold,
      color: rgb(1, 1, 1),
    });

    page.drawText("Student Identity Card", {
      x: x + cardWidth - 118,
      y: y + cardHeight - 22,
      size: 9,
      font: regular,
      color: rgb(0.93, 0.93, 1),
    });

    const photoX = x + 16;
    const photoY = y + cardHeight - 132;
    const photoWidth = 72;
    const photoHeight = 84;

    const embeddedImage = student.profileImage
      ? await embedRemoteImage(pdfDoc, student.profileImage, imageCache)
      : null;

    if (embeddedImage) {
      page.drawRectangle({
        x: photoX,
        y: photoY,
        width: photoWidth,
        height: photoHeight,
        borderWidth: 1,
        borderColor: rgb(0.82, 0.85, 0.91),
        color: rgb(0.98, 0.99, 1),
      });

      const scaled = embeddedImage.scaleToFit(photoWidth - 8, photoHeight - 8);
      page.drawImage(embeddedImage, {
        x: photoX + (photoWidth - scaled.width) / 2,
        y: photoY + (photoHeight - scaled.height) / 2,
        width: scaled.width,
        height: scaled.height,
      });
    } else {
      drawPhotoPlaceholder(page, photoX, photoY, photoWidth, photoHeight, regular);
    }

    const textX = photoX + photoWidth + 16;
    const labelColor = rgb(0.42, 0.48, 0.58);
    const valueColor = rgb(0.12, 0.16, 0.22);

    page.drawText(truncate(student.name, 26), {
      x: textX,
      y: y + cardHeight - 62,
      size: 13,
      font: bold,
      color: valueColor,
    });

    const rowsData = [
      { label: "Student ID", value: student.userId },
      { label: "Department", value: student.departmentId?.code ?? student.departmentId?.name ?? "—" },
    ];

    rowsData.forEach((rowItem, rowIndex) => {
      const baseY = y + cardHeight - 84 - rowIndex * 22;
      page.drawText(rowItem.label, {
        x: textX,
        y: baseY,
        size: 8,
        font: regular,
        color: labelColor,
      });
      page.drawText(truncate(rowItem.value, 28), {
        x: textX,
        y: baseY - 10,
        size: 10,
        font: bold,
        color: valueColor,
      });
    });

    page.drawLine({
      start: { x: x + 16, y: y + 30 },
      end: { x: x + cardWidth - 16, y: y + 30 },
      thickness: 1,
      color: rgb(0.9, 0.92, 0.96),
    });

    page.drawText("Authorized by Administration", {
      x: x + 16,
      y: y + 16,
      size: 8,
      font: regular,
      color: rgb(0.47, 0.51, 0.6),
    });
  }

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="student-id-cards-${from}-to-${to}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

export const runtime = "nodejs";
