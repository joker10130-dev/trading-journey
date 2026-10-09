import { describe, expect, it } from "vitest";
import { dateRangeSchema, journalSchema, tradeSchema } from "@/lib/validation";

describe("request validation", () => {
  it("accepts a complete trade and normalizes its pair and currency", () => {
    const result = tradeSchema.parse({
      pair: " eurusd ",
      side: "BUY",
      entryPrice: "1.08",
      exitPrice: "1.09",
      lotSize: "0.5",
      pnl: "12.50",
      openedAt: "2026-03-02T09:00:00Z",
      closedAt: "2026-03-02T10:00:00Z",
    });
    expect(result.pair).toBe("EURUSD");
    expect(result.currency).toBe("USD");
    expect(result.pnl).toBe(12.5);
  });

  it("rejects realized P&L on an open trade and closes before open", () => {
    const base = {
      pair: "EURUSD", side: "BUY", entryPrice: 1, lotSize: 1,
      openedAt: "2026-03-02T09:00:00Z",
    };
    expect(tradeSchema.safeParse({ ...base, pnl: 10 }).success).toBe(false);
    expect(tradeSchema.safeParse({
      ...base, pnl: 10, closedAt: "2026-03-02T08:00:00Z",
    }).success).toBe(false);
    expect(tradeSchema.safeParse({ ...base, entryPrice: Number.POSITIVE_INFINITY }).success).toBe(false);
  });

  it("validates stop-loss and take-profit placement for the trade side", () => {
    const base = {
      pair: "EURUSD", side: "BUY", entryPrice: 1.08, lotSize: 1,
      openedAt: "2026-03-02T09:00:00Z",
    };
    expect(tradeSchema.safeParse({ ...base, stopLoss: 1.07, takeProfit: 1.1 }).success).toBe(true);
    expect(tradeSchema.safeParse({ ...base, stopLoss: 1.09, takeProfit: 1.07 }).success).toBe(false);
    expect(tradeSchema.safeParse({
      ...base, side: "SELL", stopLoss: 1.09, takeProfit: 1.07,
    }).success).toBe(true);
  });

  it("bounds journal emotion scores and limits analytics date ranges", () => {
    expect(journalSchema.safeParse({ entryDate: "2026-03-02", notes: "Review", emotionScore: 101 }).success).toBe(false);
    expect(dateRangeSchema.safeParse({ from: "2026-01-01", to: "2026-02-01" }).success).toBe(true);
    expect(dateRangeSchema.safeParse({ from: "2026-03-02", to: "2026-01-01" }).success).toBe(false);
    expect(dateRangeSchema.safeParse({ from: "2000-01-01", to: "2026-01-01" }).success).toBe(false);
  });
});
