import { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { apiError, hasSameOrigin, parseJson } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { tradeSchema, tradeUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

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
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  const { id } = await context.params;
  const trade = await prisma.trade.findFirst({ where: { id, userId: auth.user.id } });
  if (!trade) return apiError(404, "TRADE_NOT_FOUND", "Trade was not found.");
  return NextResponse.json({ trade: serializeTrade(trade) });
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!hasSameOrigin(request)) return apiError(403, "INVALID_ORIGIN", "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  const { id } = await context.params;
  const parsed = await parseJson(request, tradeUpdateSchema);
  if ("response" in parsed) return parsed.response;

  const existing = await prisma.trade.findFirst({ where: { id, userId: auth.user.id } });
  if (!existing) return apiError(404, "TRADE_NOT_FOUND", "Trade was not found.");
  const combined = tradeSchema.safeParse({
    pair: existing.pair,
    side: existing.side,
    entryPrice: Number(existing.entryPrice),
    exitPrice: existing.exitPrice === null ? null : Number(existing.exitPrice),
    stopLoss: existing.stopLoss === null ? null : Number(existing.stopLoss),
    takeProfit: existing.takeProfit === null ? null : Number(existing.takeProfit),
    lotSize: Number(existing.lotSize),
    pnl: existing.pnl === null ? null : Number(existing.pnl),
    currency: existing.currency,
    strategyTag: existing.strategyTag,
    externalId: existing.externalId,
    openedAt: existing.openedAt.toISOString(),
    closedAt: existing.closedAt?.toISOString() ?? null,
    ...parsed.data,
  });
  if (!combined.success) return apiError(400, "VALIDATION_ERROR", "Updated trade is invalid.", combined.error.issues);

  const trade = combined.data;
  try {
    const updated = await prisma.trade.update({
      where: { id },
      data: {
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
    return NextResponse.json({ trade: serializeTrade(updated) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError(409, "DUPLICATE_TRADE", "A trade with this external ID already exists.");
    }
    throw error;
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!hasSameOrigin(request)) return apiError(403, "INVALID_ORIGIN", "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  const { id } = await context.params;
  const deleted = await prisma.trade.deleteMany({ where: { id, userId: auth.user.id } });
  if (!deleted.count) return apiError(404, "TRADE_NOT_FOUND", "Trade was not found.");
  return NextResponse.json({ ok: true });
}
