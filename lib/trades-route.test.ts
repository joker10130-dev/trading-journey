import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireApiUser: mocks.requireApiUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trade: {
      findMany: mocks.findMany,
      count: mocks.count,
      create: mocks.create,
    },
  },
}));

import { GET, POST } from "@/app/api/trades/route";

describe("trades API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({
      user: { id: "user-123" },
      response: null,
    });
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
  });

  it("returns trades scoped to the authenticated user and validated filters", async () => {
    const response = await GET(new Request(
      "http://localhost/api/trades?from=2025-01-01&to=2025-01-31&currency=eur&q=eurusd&limit=5&offset=10",
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      trades: [],
      total: 0,
      limit: 5,
      offset: 10,
    });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: "user-123",
        currency: "EUR",
        openedAt: {
          gte: new Date("2025-01-01T00:00:00.000Z"),
          lt: new Date("2025-02-01T00:00:00.000Z"),
        },
        OR: [
          { pair: { contains: "eurusd", mode: "insensitive" } },
          { strategyTag: { contains: "eurusd", mode: "insensitive" } },
        ],
      }),
      take: 5,
      skip: 10,
    }));
    expect(mocks.count).toHaveBeenCalledOnce();
  });

  it("rejects invalid date ranges before querying trades", async () => {
    const response = await GET(new Request(
      "http://localhost/api/trades?from=2025-02-01&to=2025-01-01",
    ));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it("rejects POST requests without a same-origin header", async () => {
    const response = await POST(new Request("http://localhost/api/trades", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_ORIGIN" },
    });
    expect(mocks.requireApiUser).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("validates and creates a trade for the authenticated user", async () => {
    const createdTrade = {
      id: "trade-456",
      pair: "EURUSD",
      side: "BUY" as const,
      entryPrice: 1.08,
      exitPrice: null,
      stopLoss: null,
      takeProfit: null,
      lotSize: 0.1,
      pnl: null,
      currency: "USD",
      strategyTag: "breakout",
      externalId: null,
      brokerImportId: null,
      sourcePositionId: null,
      sourceOrderIds: [],
      brokerClosedPnl: null,
      brokerNetPnl: null,
      commission: null,
      reconciliationDifference: null,
      openedAt: new Date("2025-01-01T09:00:00.000Z"),
      closedAt: null,
      createdAt: new Date("2025-01-01T09:00:00.000Z"),
      updatedAt: new Date("2025-01-01T09:00:00.000Z"),
    };
    mocks.create.mockResolvedValue(createdTrade);

    const response = await POST(new Request("http://localhost/api/trades", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        pair: " eurusd ",
        side: "BUY",
        entryPrice: 1.08,
        lotSize: 0.1,
        strategyTag: "breakout",
        openedAt: "2025-01-01T09:00:00Z",
      }),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      trade: {
        id: "trade-456",
        pair: "EURUSD",
        entryPrice: 1.08,
        brokerNetPnl: null,
        sourceOrderIds: [],
      },
    });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "user-123",
        pair: "EURUSD",
        currency: "USD",
        openedAt: new Date("2025-01-01T09:00:00.000Z"),
      }),
    }));
  });
});
