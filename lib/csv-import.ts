import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { tradeSchema, type TradeInput } from "@/lib/validation";

const maxCsvBytes = 2 * 1024 * 1024;
const maxCsvRows = 5000;
const requiredHeaders = ["pair", "side", "entryprice", "lotsize", "openedat"];
const eightcapHeaders = ["symbol", "side", "type", "qty", "filledqty", "updatetime", "positionid", "orderid"];

export type CsvImportRow = TradeInput & { externalId: string };

export class CsvImportError extends Error {
  constructor(message: string, readonly row?: number) {
    super(message);
    this.name = "CsvImportError";
  }
}

function normalizeHeader(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized === "pl" || normalized === "profitloss" || normalized === "realizedpnl") return "pnl";
  if (normalized === "ticketid") return "ticket";
  if (normalized === "tradeid") return "tradeid";
  return normalized;
}

function deterministicExternalId(row: Record<string, string>) {
  return createHash("sha256")
    .update(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}:${value}`).join("|"))
    .digest("hex");
}

export function parseTradeCsv(text: string): CsvImportRow[] {
  if (Buffer.byteLength(text, "utf8") > maxCsvBytes) {
    throw new CsvImportError("CSV file must be 2 MB or smaller.");
  }

  let rows: Record<string, string>[];
  try {
    rows = parse(text, {
      bom: true,
      columns: (headers: string[]) => headers.map(normalizeHeader),
      skip_empty_lines: true,
      trim: true,
      max_record_size: 16_384,
    }) as Record<string, string>[];
  } catch (error) {
    if (error instanceof Error) throw new CsvImportError(`Could not parse CSV: ${error.message}`);
    throw error;
  }

  if (rows.length === 0) throw new CsvImportError("CSV must include a header and at least one trade.");
  if (rows.length > maxCsvRows) throw new CsvImportError(`CSV can contain at most ${maxCsvRows} trades.`);
  const headers = Object.keys(rows[0]);
  const missing = requiredHeaders.filter((header) => !headers.includes(header));
  if (missing.length) throw new CsvImportError(`Missing required columns: ${missing.join(", ")}.`);

  return rows.map((row, index) => {
    const parseDate = (value: string | undefined) => {
      if (!value) return undefined;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : date.toISOString();
    };
    const pnl = row.pnl === undefined || row.pnl === "" ? undefined : row.pnl;
    const parsed = tradeSchema.safeParse({
      pair: row.pair,
      side: row.side?.toUpperCase(),
      entryPrice: row.entryprice,
      exitPrice: row.exitprice || undefined,
      stopLoss: row.stoploss || undefined,
      takeProfit: row.takeprofit || undefined,
      lotSize: row.lotsize,
      pnl,
      currency: row.currency || "USD",
      strategyTag: row.strategytag || undefined,
      externalId: row.externalid || row.ticket || row.tradeid || deterministicExternalId(row),
      openedAt: parseDate(row.openedat),
      closedAt: parseDate(row.closedat) ?? null,
    });
    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`).join("; ");
      throw new CsvImportError(errors, index + 2);
    }
    if (parsed.data.pnl !== undefined && !parsed.data.closedAt) {
      throw new CsvImportError("A realized P&L requires closedAt.", index + 2);
    }
    return { ...parsed.data, externalId: parsed.data.externalId ?? deterministicExternalId(row) };
  });
}

export function getMaxCsvBytes() {
  return maxCsvBytes;
}

export function isEightcapOrderHistoryCsv(text: string) {
  const header = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const normalizedHeaders = new Set(header.split(",").map((value) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "")));
  return eightcapHeaders.every((value) => normalizedHeaders.has(value));
}
