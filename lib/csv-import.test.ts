import { describe, expect, it } from "vitest";
import { CsvImportError, isEightcapOrderHistoryCsv, parseTradeCsv } from "@/lib/csv-import";

describe("parseTradeCsv", () => {
  it("detects TradingView/Eightcap order-history exports", () => {
    expect(isEightcapOrderHistoryCsv("Symbol,Side,Type,Qty,Filled Qty,Update Time,Position ID,Order ID\nXAUUSD,Buy,Market,1,1,,,,")).toBe(true);
    expect(isEightcapOrderHistoryCsv("pair,side,entryPrice,lotSize,openedAt\nEURUSD,BUY,1.08,1,2026-03-02T09:00:00Z")).toBe(false);
  });

  it("parses quoted fields and normalizes trade data", () => {
    const rows = parseTradeCsv([
      "Ticket,Pair,Side,Entry Price,Exit Price,Stop Loss,Take Profit,Lot Size,P&L,Currency,Strategy Tag,Opened At,Closed At",
      'abc-123,eurusd,buy,1.08,1.09,1.07,1.10,0.5,125.50,usd,"London, breakout",2026-03-02T09:00:00Z,2026-03-02T10:00:00Z',
    ].join("\n"));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      pair: "EURUSD",
      side: "BUY",
      entryPrice: 1.08,
      pnl: 125.5,
      stopLoss: 1.07,
      takeProfit: 1.1,
      currency: "USD",
      strategyTag: "London, breakout",
      externalId: "abc-123",
    });
  });

  it("creates a stable external ID if the broker export has no ticket", () => {
    const csv = "pair,side,entryPrice,lotSize,openedAt\nEURUSD,BUY,1.08,1,2026-03-02T09:00:00Z";
    expect(parseTradeCsv(csv)[0].externalId).toBe(parseTradeCsv(csv)[0].externalId);
  });

  it("rejects missing columns and invalid records with row numbers", () => {
    expect(() => parseTradeCsv("pair,side\nEURUSD,BUY")).toThrow(CsvImportError);
    try {
      parseTradeCsv("pair,side,entryPrice,lotSize,openedAt\nEURUSD,BUY,-1,1,2026-03-02T09:00:00Z");
      throw new Error("Expected the CSV row to be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(CsvImportError);
      expect((error as CsvImportError).row).toBe(2);
    }
  });

  it("rejects malformed CSV syntax", () => {
    expect(() => parseTradeCsv('pair,side,entryPrice,lotSize,openedAt\n"EURUSD,BUY,1,1,2026-03-02')).toThrow(CsvImportError);
  });
});
