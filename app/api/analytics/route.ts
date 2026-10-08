import { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { calculateAnalytics, type ClosedTrade, type JournalDay } from "@/lib/analytics";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { dateRangeSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  const url = new URL(request.url);
  const range = dateRangeSchema.safeParse({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    currency: url.searchParams.get("currency") ?? "USD",
    q: url.searchParams.get("q") ?? "",
  });
  if (!range.success) return apiError(400, "VALIDATION_ERROR", "Query validation failed.", range.error.issues);
  const { from, to, currency, q } = range.data;
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000);
  const [records, journalRecords] = await Promise.all([
    prisma.trade.findMany({
      where: { userId: auth.user.id, currency, closedAt: { gte: start, lt: end }, pnl: { not: null } },
      select: {
        id: true, pair: true, side: true, entryPrice: true, exitPrice: true, stopLoss: true, takeProfit: true, lotSize: true, pnl: true,
        currency: true, strategyTag: true, openedAt: true, closedAt: true,
      },
      orderBy: [{ closedAt: "asc" }, { id: "asc" }],
    }),
    prisma.tradingJournal.findMany({
      where: { userId: auth.user.id, entryDate: { gte: start, lt: end } },
      select: { id: true, entryDate: true, notes: true, emotionScore: true },
      orderBy: { entryDate: "asc" },
    }),
  ]);

  const normalizedQuery = q.toLocaleLowerCase();
  const matchingJournals = normalizedQuery
    ? journalRecords.filter((journal) => journal.notes.toLocaleLowerCase().includes(normalizedQuery))
    : journalRecords;
  const matchingJournalDates = new Set(matchingJournals.map((journal) => journal.entryDate.toISOString().slice(0, 10)));
  const matchingTrades = normalizedQuery
    ? records.filter((trade) =>
      trade.pair.toLocaleLowerCase().includes(normalizedQuery)
      || trade.strategyTag?.toLocaleLowerCase().includes(normalizedQuery)
      || matchingJournalDates.has(trade.closedAt!.toISOString().slice(0, 10)))
    : records;
  const filteredJournals = normalizedQuery
    ? matchingJournals.filter((journal) => matchingTrades.some(
      (trade) => trade.closedAt!.toISOString().slice(0, 10) === journal.entryDate.toISOString().slice(0, 10),
    ))
    : journalRecords;
  const trades: ClosedTrade[] = matchingTrades.map((trade) => ({
    ...trade,
    entryPrice: Number(trade.entryPrice),
    exitPrice: trade.exitPrice === null ? null : Number(trade.exitPrice),
    stopLoss: trade.stopLoss === null ? null : Number(trade.stopLoss),
    takeProfit: trade.takeProfit === null ? null : Number(trade.takeProfit),
    lotSize: Number(trade.lotSize),
    pnl: trade.pnl === null ? null : Number(trade.pnl),
  }));
  const journals: JournalDay[] = filteredJournals.map((journal) => ({
    ...journal,
    entryDate: journal.entryDate,
  }));
  const analytics = calculateAnalytics(trades, journals);
  return NextResponse.json({ from, to, currency, ...analytics });
}
