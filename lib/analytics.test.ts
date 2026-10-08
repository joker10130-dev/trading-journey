import { describe, expect, it } from "vitest";
import { calculateAnalytics, type ClosedTrade } from "@/lib/analytics";

function trade(id: string, pnl: number, closedAt: string): ClosedTrade {
  return {
    id,
    pair: "EURUSD",
    side: "BUY",
    entryPrice: 1.08,
    exitPrice: 1.09,
    stopLoss: null,
    takeProfit: null,
    lotSize: 1,
    pnl,
    currency: "USD",
    strategyTag: null,
    openedAt: new Date(`${closedAt.slice(0, 10)}T08:00:00.000Z`),
    closedAt: new Date(closedAt),
  };
}

describe("calculateAnalytics", () => {
  it("calculates realized metrics, drawdown and streaks from closed trades only", () => {
    const trades = [
      trade("1", 100, "2026-03-02T10:00:00.000Z"),
      trade("2", -40, "2026-03-02T11:00:00.000Z"),
      trade("3", 0, "2026-03-03T10:00:00.000Z"),
      trade("4", 30, "2026-03-05T10:00:00.000Z"),
      { ...trade("open", 999, "2026-03-06T10:00:00.000Z"), closedAt: null },
    ];

    const result = calculateAnalytics(trades, []);
    expect(result.netPnl).toBe(90);
    expect(result.grossProfit).toBe(130);
    expect(result.grossLoss).toBe(-40);
    expect(result.tradeCount).toBe(4);
    expect(result.winningTrades).toBe(2);
    expect(result.breakevenTrades).toBe(1);
    expect(result.winRate).toBe(50);
    expect(result.rewardRiskRatio).toBeNull();
    expect(result.maxDrawdown).toBe(40);
    expect(result.currentWinningStreak).toBe(1);
    expect(result.longestWinningStreak).toBe(1);
    expect(result.daily).toEqual([
      { date: "2026-03-02", pnl: 60, tradeCount: 2, winningTrades: 1, pairs: ["EURUSD"] },
      { date: "2026-03-03", pnl: 0, tradeCount: 1, winningTrades: 0, pairs: ["EURUSD"] },
      { date: "2026-03-05", pnl: 30, tradeCount: 1, winningTrades: 1, pairs: ["EURUSD"] },
    ]);
  });

  it("groups daily results into Monday-to-Sunday UTC weeks", () => {
    const result = calculateAnalytics([
      trade("mon", 10, "2026-03-02T10:00:00.000Z"),
      trade("sun", -5, "2026-03-08T10:00:00.000Z"),
      trade("next", 20, "2026-03-09T10:00:00.000Z"),
    ], []);
    expect(result.weekly).toEqual([
      { weekStart: "2026-03-02", weekEnd: "2026-03-08", pnl: 5, tradeCount: 2 },
      { weekStart: "2026-03-09", weekEnd: "2026-03-15", pnl: 20, tradeCount: 1 },
    ]);
  });

  it("returns zero metrics for an empty range and no planned ratio without stop/target values", () => {
    const empty = calculateAnalytics([], []);
    expect(empty.netPnl).toBe(0);
    expect(empty.winRate).toBe(0);
    expect(empty.rewardRiskRatio).toBeNull();

    const winnersOnly = calculateAnalytics([trade("winner", 25, "2026-03-02T10:00:00.000Z")], []);
    expect(winnersOnly.rewardRiskRatio).toBeNull();
  });

  it("averages planned reward divided by planned risk for closed trades with stop and target", () => {
    const result = calculateAnalytics([
      { ...trade("two-r", 10, "2026-03-02T10:00:00.000Z"), stopLoss: 1.07, takeProfit: 1.1 },
      { ...trade("half-r", -5, "2026-03-03T10:00:00.000Z"), stopLoss: 1.06, takeProfit: 1.09 },
      trade("no-plan", 10, "2026-03-04T10:00:00.000Z"),
    ], []);
    expect(result.rewardRiskRatio).toBe(1.25);
  });
});
