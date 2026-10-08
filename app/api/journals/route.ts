import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api-auth";
import { apiError, hasSameOrigin, parseJson } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { journalSchema } from "@/lib/validation";

export const runtime = "nodejs";

const listSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
}).refine((value) => value.from <= value.to, { message: "from must be on or before to" }).refine((value) => {
  const from = new Date(`${value.from}T00:00:00.000Z`).getTime();
  const to = new Date(`${value.to}T00:00:00.000Z`).getTime();
  return to - from <= 3660 * 86_400_000;
}, { message: "Date ranges cannot exceed 10 years" });

function serializeJournal(journal: {
  id: string;
  entryDate: Date;
  notes: string;
  emotionScore: number | null;
  screenshots: string[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return { ...journal, entryDate: journal.entryDate.toISOString().slice(0, 10) };
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  const url = new URL(request.url);
  const parsed = listSchema.safeParse({ from: url.searchParams.get("from"), to: url.searchParams.get("to") });
  if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Query validation failed.", parsed.error.issues);

  const journals = await prisma.tradingJournal.findMany({
    where: {
      userId: auth.user.id,
      entryDate: {
        gte: new Date(`${parsed.data.from}T00:00:00.000Z`),
        lt: new Date(new Date(`${parsed.data.to}T00:00:00.000Z`).getTime() + 86_400_000),
      },
    },
    orderBy: { entryDate: "asc" },
  });
  return NextResponse.json({ journals: journals.map(serializeJournal) });
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return apiError(403, "INVALID_ORIGIN", "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  const parsed = await parseJson(request, journalSchema);
  if ("response" in parsed) return parsed.response;

  const journal = await prisma.tradingJournal.upsert({
    where: {
      userId_entryDate: {
        userId: auth.user.id,
        entryDate: new Date(`${parsed.data.entryDate}T00:00:00.000Z`),
      },
    },
    create: {
      userId: auth.user.id,
      entryDate: new Date(`${parsed.data.entryDate}T00:00:00.000Z`),
      notes: parsed.data.notes,
      emotionScore: parsed.data.emotionScore ?? null,
      screenshots: parsed.data.screenshots,
    },
    update: {
      notes: parsed.data.notes,
      emotionScore: parsed.data.emotionScore ?? null,
      screenshots: parsed.data.screenshots,
    },
  });
  return NextResponse.json({ journal: serializeJournal(journal) }, { status: 200 });
}
