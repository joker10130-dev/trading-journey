import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EightcapOrder } from "@/lib/eightcap-csv";

const prismaMocks = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: prismaMocks.transaction } }));

import { persistEightcapImport } from "@/lib/eightcap-persistence";

const order: EightcapOrder = {
  rowNumber: 2,
  symbol: "XAUUSD",
  side: "Buy",
  type: "Market",
  qty: "0.01",
  filledQty: "0.01",
  limitPrice: null,
  stopPrice: null,
  avgFillPrice: "4188.62",
  status: "Filled",
  updateTimeUtc: "2026-10-09T04:48:56.000Z",
  positionId: "XAUUSD:1",
  commission: "0.0",
  closedPnl: null,
  netClosedPnl: null,
  orderId: "1",
  raw: {
    Symbol: "XAUUSD",
    Side: "Buy",
    Type: "Market",
    Qty: "0.01",
    "Filled Qty": "0.01",
    "Limit Price": "",
    "Stop Price": "",
    "Avg Fill Price": "4188.62",
    Status: "Filled",
    "Update Time": "2026-10-09 11:48:56",
    "Position ID": "XAUUSD:1",
    Commission: "0.0",
    "Closed P&L": "",
    "Net Closed P&L": "",
    "Order ID": "1",
  },
};

describe("persistEightcapImport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not persist when the account belongs to another user", async () => {
    const transaction = {
      tradingAccount: { findFirst: vi.fn().mockResolvedValue(null) },
      brokerImport: { create: vi.fn() },
      importedOrder: { createMany: vi.fn() },
    };
    prismaMocks.transaction.mockImplementation(async (callback) => callback(transaction));

    expect(await persistEightcapImport({
      userId: "user-1",
      accountId: "account-2",
      filename: "orders.csv",
      timezone: "UTC",
      orders: [order],
    })).toBeNull();
    expect(transaction.brokerImport.create).not.toHaveBeenCalled();
  });

  it("persists the import and skips duplicate order IDs", async () => {
    const transaction = {
      tradingAccount: { findFirst: vi.fn().mockResolvedValue({ id: "account-1", baseCurrency: "USD" }) },
      brokerImport: { create: vi.fn().mockResolvedValue({ id: "import-1" }) },
      importedOrder: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      trade: { upsert: vi.fn().mockResolvedValue({}) },
    };
    prismaMocks.transaction.mockImplementation(async (callback) => callback(transaction));

    const result = await persistEightcapImport({
      userId: "user-1",
      accountId: "account-1",
      filename: "orders.csv",
      timezone: "UTC",
      orders: [order, { ...order, rowNumber: 3 }],
    });

    expect(result).toMatchObject({ importId: "import-1", inserted: 1, tradesLinked: 1 });
    expect(transaction.importedOrder.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: expect.arrayContaining([expect.objectContaining({
        externalOrderId: "1",
        accountId: "account-1",
      })]),
    }));
    expect(transaction.trade.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        sourcePositionId: "XAUUSD:1",
        sourceOrderIds: ["1"],
        brokerImportId: "import-1",
      }),
    }));
  });
});
