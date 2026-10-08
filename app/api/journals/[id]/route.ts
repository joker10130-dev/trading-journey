import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { apiError, hasSameOrigin, parseJson } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { journalSchema, journalUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  if (!hasSameOrigin(request)) return apiError(403, "INVALID_ORIGIN", "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  const { id } = await context.params;
  const parsed = await parseJson(request, journalUpdateSchema);
  if ("response" in parsed) return parsed.response;

  const existing = await prisma.tradingJournal.findFirst({ where: { id, userId: auth.user.id } });
  if (!existing) return apiError(404, "JOURNAL_NOT_FOUND", "Journal entry was not found.");
  const combined = journalSchema.safeParse({
    entryDate: existing.entryDate.toISOString().slice(0, 10),
    notes: existing.notes,
    emotionScore: existing.emotionScore,
    screenshots: existing.screenshots,
    ...parsed.data,
  });
  if (!combined.success) return apiError(400, "VALIDATION_ERROR", "Updated journal entry is invalid.", combined.error.issues);

  try {
    const journal = await prisma.tradingJournal.update({
      where: { id },
      data: {
        entryDate: new Date(`${combined.data.entryDate}T00:00:00.000Z`),
        notes: combined.data.notes,
        emotionScore: combined.data.emotionScore ?? null,
        screenshots: combined.data.screenshots,
      },
    });
    return NextResponse.json({ journal: { ...journal, entryDate: journal.entryDate.toISOString().slice(0, 10) } });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return apiError(409, "JOURNAL_EXISTS", "A journal entry already exists for this date.");
    }
    throw error;
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!hasSameOrigin(request)) return apiError(403, "INVALID_ORIGIN", "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  const { id } = await context.params;
  const deleted = await prisma.tradingJournal.deleteMany({ where: { id, userId: auth.user.id } });
  if (!deleted.count) return apiError(404, "JOURNAL_NOT_FOUND", "Journal entry was not found.");
  return NextResponse.json({ ok: true });
}
