import { describe, expect, it } from "vitest";
import type { EightcapOrder } from "@/lib/eightcap-csv";
import { reconstructEightcapPositions } from "@/lib/eightcap-reconstruction";

function order(overrides: Partial<EightcapOrder>): EightcapOrder {
  return {
    rowNumber: 2,
    symbol: "XAUUSD",
    side: "Buy",
    type: "Market",
    qty: "0.01",
    filledQty: "0.01",
    limitPrice: null,
    stopPrice: null,
    avgFillPrice: "100",
    status: "Filled",
    updateTimeUtc: "2026-10-10T01:00:00.000Z",
    positionId: "position-1",
    commission: "0.50",
    closedPnl: null,
    netClosedPnl: null,
    orderId: "order-1",
    raw: {} as EightcapOrder["raw"],
    ...overrides,
  };
}

describe("reconstructEightcapPositions", () => {
  it("reconstructs a long position with weighted fills and a stop-loss exit", () => {
    const result = reconstructEightcapPositions([
      order({ filledQty: "0.01", avgFillPrice: "100", orderId: "entry-1" }),
      order({
        rowNumber: 3,
        type: "Limit",
        filledQty: "0.02",
        qty: "0.02",
        avgFillPrice: "101",
        commission: "0.25",
        orderId: "entry-2",
        updateTimeUtc: "2026-10-10T01:01:00.000Z",
      }),
      order({
        rowNumber: 4,
        side: "Sell",
        type: "Stop Loss",
        filledQty: "0.03",
        qty: "0.03",
        stopPrice: "98",
        avgFillPrice: "98.1",
        netClosedPnl: "-5.70",
        orderId: "exit-1",
        updateTimeUtc: "2026-10-10T02:00:00.000Z",
      }),
    ]);

    expect(result.exceptions).toHaveLength(0);
    expect(result.positions[0]).toMatchObject({
      direction: "LONG",
      entryQty: "0.03",
      entryPrice: "100.666666666666",
      exitQty: "0.03",
      exitPrice: "98.1",
      stopLossPrice: "98",
      netClosedPnl: "-5.7",
      commission: "1.25",
      status: "closed",
    });
  });

  it("marks incomplete and contradictory positions for review", () => {
    const result = reconstructEightcapPositions([
      order({ positionId: "bad-1", side: "Buy", type: "Market" }),
      order({
        rowNumber: 3,
        positionId: "bad-1",
        side: "Buy",
        type: "Stop Loss",
        filledQty: "0.02",
        orderId: "bad-exit",
      }),
      order({ rowNumber: 4, positionId: null, orderId: "orphan" }),
    ]);

    expect(result.positions[0].status).toBe("needs_review");
    expect(result.positions[0].issues.map((issue) => issue.message)).toContain(
      "Exit order side does not match the position direction.",
    );
    expect(result.exceptions).toMatchObject([{ rowNumber: 4, message: "Order has no Position ID." }]);
  });

  it("ignores cancelled protection orders but preserves them in the group", () => {
    const result = reconstructEightcapPositions([
      order({ orderId: "entry" }),
      order({
        rowNumber: 3,
        side: "Sell",
        type: "Take Profit",
        status: "Cancelled",
        filledQty: "0",
        limitPrice: "105",
        orderId: "cancelled-tp",
      }),
    ]);

    expect(result.positions[0].status).toBe("open");
    expect(result.positions[0].exitQty).toBe("0");
    expect(result.positions[0].orders).toHaveLength(2);
  });
});
