import { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { apiError, hasSameOrigin, parseJson } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { tradeSchema } from "@/lib/validation";
import { z } from "zod";

export const runtime = "nodejs";

const listQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  currency: z.string().length(3).default("USD").transform((value) => value.toUpperCase()),
  q: z.string().trim().max(120).default(""),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
}).refine((query) => !query.from || !query.to || query.from <= query.to, {
  message: "from must be on or before to",
}).refine((query) => (query.from === undefined) === (query.to === undefined), {
  message: "from and to must be supplied together",
}).refine((query) => {
  if (!query.from || !query.to) return true;
  const from = new Date(`${query.from}T00:00:00.000Z`).getTime();
  const to = new Date(`${query.to}T00:00:00.000Z`).getTime();
  return to - from <= 3660 * 86_400_000;
}, {
  message: "Date ranges cannot exceed 10 years",
});

function serializeTrade(trade: {
  id: string;
  pair: string;
  side: "BUY" | "SELL";
  entryPrice: Prisma.Decimal;
  exitPrice: Prisma.Decimal | null;
  stopLoss: Prisma.Decimal | null;
  takeProfit: Prisma.Decimal | null;
  lotSize: Prisma.Decimal;
  pnl: Prisma.Decimal | null;
  currency: string;
  strategyTag: string | null;
  externalId: string | null;
  brokerImportId: string | null;
  sourcePositionId: string | null;
  sourceOrderIds: string[];
  brokerClosedPnl: Prisma.Decimal | null;
  brokerNetPnl: Prisma.Decimal | null;
  commission: Prisma.Decimal | null;
  reconciliationDifference: Prisma.Decimal | null;
  openedAt: Date;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...trade,
    entryPrice: Number(trade.entryPrice),
    exitPrice: trade.exitPrice === null ? null : Number(trade.exitPrice),
    stopLoss: trade.stopLoss === null ? null : Number(trade.stopLoss),
    takeProfit: trade.takeProfit === null ? null : Number(trade.takeProfit),
    lotSize: Number(trade.lotSize),
    pnl: trade.pnl === null ? null : Number(trade.pnl),
    brokerImportId: trade.brokerImportId,
    sourcePositionId: trade.sourcePositionId,
    sourceOrderIds: trade.sourceOrderIds,
    brokerClosedPnl: trade.brokerClosedPnl === null ? null : Number(trade.brokerClosedPnl),
    brokerNetPnl: trade.brokerNetPnl === null ? null : Number(trade.brokerNetPnl),
    commission: trade.commission === null ? null : Number(trade.commission),
    reconciliationDifference: trade.reconciliationDifference === null ? null : Number(trade.reconciliationDifference),
  };
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  const url = new URL(request.url);
  const query = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) return apiError(400, "VALIDATION_ERROR", "Query validation failed.", query.error.issues);
  const { from, to, currency, q, limit, offset } = query.data;
  const dateFilter = from && to ? {
    openedAt: {
      gte: new Date(`${from}T00:00:00.000Z`),
      lt: new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000),
    },
  } : {};
  const searchFilter = q ? {
    OR: [
      { pair: { contains: q, mode: "insensitive" as const } },
      { strategyTag: { contains: q, mode: "insensitive" as const } },
    ],
  } : {};
  const [trades, total] = await Promise.all([
    prisma.trade.findMany({
      where: { userId: auth.user.id, currency, ...dateFilter, ...searchFilter },
      orderBy: [{ closedAt: "desc" }, { openedAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.trade.count({ where: { userId: auth.user.id, currency, ...dateFilter, ...searchFilter } }),
  ]);
  return NextResponse.json({ trades: trades.map(serializeTrade), total, limit, offset });
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return apiError(403, "INVALID_ORIGIN", "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  const parsed = await parseJson(request, tradeSchema);
  if ("response" in parsed) return parsed.response;
  const trade = parsed.data;

  try {
    const created = await prisma.trade.create({
      data: {
        userId: auth.user.id,
        pair: trade.pair,
        side: trade.side,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice ?? null,
        stopLoss: trade.stopLoss ?? null,
        takeProfit: trade.takeProfit ?? null,
        lotSize: trade.lotSize,
        pnl: trade.pnl ?? null,
        currency: trade.currency,
        strategyTag: trade.strategyTag ?? null,
        externalId: trade.externalId ?? null,
        openedAt: new Date(trade.openedAt),
        closedAt: trade.closedAt ? new Date(trade.closedAt) : null,
      },
    });
    return NextResponse.json({ trade: serializeTrade(created) }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError(409, "DUPLICATE_TRADE", "A trade with this external ID already exists.");
    }
    throw error;
  }
}
