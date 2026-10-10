import { parse } from "csv-parse/sync";

const maxCsvBytes = 2 * 1024 * 1024;
const maxCsvRows = 5000;

const headers = [
  "Symbol",
  "Side",
  "Type",
  "Qty",
  "Filled Qty",
  "Limit Price",
  "Stop Price",
  "Avg Fill Price",
  "Status",
  "Update Time",
  "Position ID",
  "Commission",
  "Closed P&L",
  "Net Closed P&L",
  "Order ID",
] as const;

const sides = ["Buy", "Sell"] as const;
const types = ["Market", "Limit", "Stop Loss", "Take Profit"] as const;
const statuses = ["Filled", "Cancelled", "Rejected"] as const;

type Header = (typeof headers)[number];
type EightcapSide = (typeof sides)[number];
type EightcapOrderType = (typeof types)[number];
type EightcapStatus = (typeof statuses)[number];

export type EightcapOrder = {
  rowNumber: number;
  symbol: string;
  side: EightcapSide;
  type: EightcapOrderType;
  qty: string;
  filledQty: string;
  limitPrice: string | null;
  stopPrice: string | null;
  avgFillPrice: string | null;
  status: EightcapStatus;
  updateTimeUtc: string;
  positionId: string | null;
  commission: string | null;
  closedPnl: string | null;
  netClosedPnl: string | null;
  orderId: string;
  raw: Record<Header, string>;
};

export type EightcapParseError = {
  rowNumber: number;
  message: string;
};

export type EightcapParseResult = {
  rows: EightcapOrder[];
  errors: EightcapParseError[];
  summary: {
    totalRows: number;
    filledRows: number;
    cancelledRows: number;
    rejectedRows: number;
    errorRows: number;
  };
};

export class EightcapCsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EightcapCsvError";
  }
}

type RawRow = Record<Header, string>;

function isOneOf<T extends readonly string[]>(value: string, values: T): value is T[number] {
  return values.includes(value);
}

function optionalDecimal(value: string, field: string) {
  if (value === "") return null;
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw new Error(`${field} must be a decimal number.`);
  }
  return value;
}

function requiredDecimal(value: string, field: string) {
  if (value === "") throw new Error(`${field} is required.`);
  return optionalDecimal(value, field) as string;
}

function parseUtcFromTimeZone(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Update Time must use YYYY-MM-DD HH:mm:ss.");

  const [, year, month, day, hour, minute, second] = match;
  const localTimestamp = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = Object.fromEntries(formatter.formatToParts(new Date(localTimestamp))
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, part.value]));
  const displayedTimestamp = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour,
    +parts.minute,
    +parts.second,
  );
  const utcTimestamp = localTimestamp - (displayedTimestamp - localTimestamp);
  return new Date(utcTimestamp).toISOString();
}

function parseRow(raw: RawRow, rowNumber: number, timeZone: string): EightcapOrder {
  if (!raw.Symbol) throw new Error("Symbol is required.");
  if (!isOneOf(raw.Side, sides)) throw new Error(`Side must be ${sides.join(" or ")}.`);
  if (!isOneOf(raw.Type, types)) throw new Error(`Type must be ${types.join(", ")}.`);
  if (!isOneOf(raw.Status, statuses)) throw new Error(`Status must be ${statuses.join(", ")}.`);
  if (!raw["Order ID"]) throw new Error("Order ID is required.");

  return {
    rowNumber,
    symbol: raw.Symbol,
    side: raw.Side,
    type: raw.Type,
    qty: requiredDecimal(raw.Qty, "Qty"),
    filledQty: requiredDecimal(raw["Filled Qty"], "Filled Qty"),
    limitPrice: optionalDecimal(raw["Limit Price"], "Limit Price"),
    stopPrice: optionalDecimal(raw["Stop Price"], "Stop Price"),
    avgFillPrice: optionalDecimal(raw["Avg Fill Price"], "Avg Fill Price"),
    status: raw.Status,
    updateTimeUtc: parseUtcFromTimeZone(raw["Update Time"], timeZone),
    positionId: raw["Position ID"] || null,
    commission: optionalDecimal(raw.Commission, "Commission"),
    closedPnl: optionalDecimal(raw["Closed P&L"], "Closed P&L"),
    netClosedPnl: optionalDecimal(raw["Net Closed P&L"], "Net Closed P&L"),
    orderId: raw["Order ID"],
    raw,
  };
}

export function parseEightcapOrderCsv(text: string, timeZone: string): EightcapParseResult {
  if (!timeZone.trim()) throw new EightcapCsvError("A source timezone is required.");
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
  } catch {
    throw new EightcapCsvError(`Unknown source timezone: ${timeZone}.`);
  }
  if (Buffer.byteLength(text, "utf8") > maxCsvBytes) {
    throw new EightcapCsvError("CSV file must be 2 MB or smaller.");
  }

  let records: RawRow[];
  try {
    records = parse(text, {
      bom: true,
      columns: (inputHeaders: string[]) => inputHeaders.map((header) => header.trim()),
      skip_empty_lines: true,
      trim: true,
      max_record_size: 16_384,
    }) as RawRow[];
  } catch (error) {
    if (error instanceof Error) throw new EightcapCsvError(`Could not parse CSV: ${error.message}`);
    throw error;
  }

  if (records.length === 0) throw new EightcapCsvError("CSV must include a header and at least one order.");
  if (records.length > maxCsvRows) throw new EightcapCsvError(`CSV can contain at most ${maxCsvRows} orders.`);

  const actualHeaders = Object.keys(records[0]);
  const missingHeaders = headers.filter((header) => !actualHeaders.includes(header));
  if (missingHeaders.length) {
    throw new EightcapCsvError(`Missing required columns: ${missingHeaders.join(", ")}.`);
  }

  const rows: EightcapOrder[] = [];
  const errors: EightcapParseError[] = [];
  records.forEach((record, index) => {
    const rowNumber = index + 2;
    try {
      rows.push(parseRow(record, rowNumber, timeZone));
    } catch (error) {
      if (error instanceof Error) errors.push({ rowNumber, message: error.message });
      else throw error;
    }
  });

  return {
    rows,
    errors,
    summary: {
      totalRows: records.length,
      filledRows: rows.filter((row) => row.status === "Filled").length,
      cancelledRows: rows.filter((row) => row.status === "Cancelled").length,
      rejectedRows: rows.filter((row) => row.status === "Rejected").length,
      errorRows: errors.length,
    },
  };
}
