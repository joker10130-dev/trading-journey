import { describe, expect, it } from "vitest";
import { EightcapCsvError, parseEightcapOrderCsv } from "@/lib/eightcap-csv";

const header = "Symbol,Side,Type,Qty,Filled Qty,Limit Price,Stop Price,Avg Fill Price,Status,Update Time,Position ID,Commission,Closed P&L,Net Closed P&L,Order ID";

describe("parseEightcapOrderCsv", () => {
  it("parses the broker format without losing decimal precision", () => {
    const result = parseEightcapOrderCsv([
      header,
      "XAUUSD,Buy,Stop Loss,0.01,0.01,,4188.6,4188.62,Filled,2026-10-09 11:48:56,XAUUSD:1250232985,0.0,-10.02,-10.02,1250232987",
      "XAUUSD,Buy,Take Profit,0.01,0,4124.19,,,Cancelled,2026-10-09 12:16:27,,,,,1250232986",
    ].join("\n"), "Asia/Bangkok");

    expect(result.summary).toMatchObject({
      totalRows: 2,
      filledRows: 1,
      cancelledRows: 1,
      errorRows: 0,
    });
    expect(result.rows[0]).toMatchObject({
      symbol: "XAUUSD",
      filledQty: "0.01",
      stopPrice: "4188.6",
      netClosedPnl: "-10.02",
      positionId: "XAUUSD:1250232985",
      updateTimeUtc: "2026-10-09T04:48:56.000Z",
    });
  });

  it("returns row-level errors instead of silently accepting bad rows", () => {
    const result = parseEightcapOrderCsv([
      header,
      "XAUUSD,Buy,Market,not-a-number,0.01,,,,Filled,2026-10-09 11:48:56,XAUUSD:1,0,,,1",
      "XAUUSD,Buy,Market,0.01,0.01,,,,Unknown,2026-10-09 11:48:56,XAUUSD:2,0,,,2",
    ].join("\n"), "UTC");

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toEqual([
      { rowNumber: 2, message: "Qty must be a decimal number." },
      { rowNumber: 3, message: "Status must be Filled, Cancelled, Rejected." },
    ]);
  });

  it("requires the exact broker headers and a valid timezone", () => {
    expect(() => parseEightcapOrderCsv("Symbol,Side\nXAUUSD,Buy", "UTC")).toThrow(EightcapCsvError);
    expect(() => parseEightcapOrderCsv(`${header}\nXAUUSD,Buy,Market,1,1,,,,Filled,2026-10-09 11:48:56,,,,,1`, "Not/AZone"))
      .toThrow("Unknown source timezone");
  });
});
