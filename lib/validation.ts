import { z } from "zod";

const dateTime = z.iso.datetime({ offset: true });

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(12).max(128),
  name: z.string().trim().min(1).max(80).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(1).max(128),
});

export const emailRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
});

export const tokenSchema = z.object({
  token: z.string().min(32).max(128),
});

export const passwordResetSchema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(12).max(128),
});

export const tradingAccountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  baseCurrency: z.string().trim().regex(/^[A-Za-z]{3}$/).default("USD").transform((value) => value.toUpperCase()),
});

const tradeBaseSchema = z.object({
  pair: z.string().trim().min(1).max(32).transform((value) => value.toUpperCase()),
  side: z.enum(["BUY", "SELL"]),
  entryPrice: z.coerce.number().positive(),
  exitPrice: z.coerce.number().positive().nullable().optional(),
  stopLoss: z.coerce.number().positive().nullable().optional(),
  takeProfit: z.coerce.number().positive().nullable().optional(),
  lotSize: z.coerce.number().positive(),
  pnl: z.coerce.number().nullable().optional(),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).default("USD").transform((value) => value.toUpperCase()),
  strategyTag: z.string().trim().max(80).nullable().optional(),
  externalId: z.string().trim().max(160).nullable().optional(),
  openedAt: dateTime,
  closedAt: dateTime.nullable().optional(),
});

export const tradeSchema = tradeBaseSchema.refine((trade) => !trade.closedAt || new Date(trade.closedAt) >= new Date(trade.openedAt), {
  message: "closedAt must be on or after openedAt",
  path: ["closedAt"],
}).refine((trade) => trade.pnl == null || trade.closedAt, {
  message: "A realized P&L requires a closed trade",
  path: ["pnl"],
}).superRefine((trade, context) => {
  const invalidStop = trade.stopLoss != null && (
    trade.side === "BUY" ? trade.stopLoss >= trade.entryPrice : trade.stopLoss <= trade.entryPrice
  );
  const invalidTarget = trade.takeProfit != null && (
    trade.side === "BUY" ? trade.takeProfit <= trade.entryPrice : trade.takeProfit >= trade.entryPrice
  );
  if (invalidStop) {
    context.addIssue({
      code: "custom",
      path: ["stopLoss"],
      message: "Stop loss must be beyond the entry price in the direction of risk",
    });
  }
  if (invalidTarget) {
    context.addIssue({
      code: "custom",
      path: ["takeProfit"],
      message: "Take profit must be beyond the entry price in the direction of reward",
    });
  }
});

export const tradeUpdateSchema = tradeBaseSchema.partial().refine(
  (trade) => Object.keys(trade).length > 0,
  { message: "At least one field is required" },
);

export const journalSchema = z.object({
  entryDate: z.iso.date(),
  notes: z.string().trim().min(1).max(10_000),
  emotionScore: z.number().int().min(0).max(100).nullable().optional(),
  screenshots: z.array(z.url().refine((value) => value.startsWith("https://") || value.startsWith("http://"))).max(10).default([]),
});

export const journalUpdateSchema = journalSchema.partial().refine(
  (entry) => Object.keys(entry).length > 0,
  { message: "At least one field is required" },
);

export const dateRangeSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  currency: z.string().regex(/^[A-Za-z]{3}$/).default("USD").transform((value) => value.toUpperCase()),
  q: z.string().trim().max(120).default(""),
}).refine((range) => range.from <= range.to, {
  message: "from must be on or before to",
  path: ["from"],
}).refine((range) => {
  const start = new Date(`${range.from}T00:00:00.000Z`).getTime();
  const end = new Date(`${range.to}T00:00:00.000Z`).getTime();
  return end - start <= 3660 * 24 * 60 * 60 * 1000;
}, {
  message: "Date ranges cannot exceed 10 years",
  path: ["to"],
});

export type TradeInput = z.infer<typeof tradeSchema>;
export type JournalInput = z.infer<typeof journalSchema>;
export type TradingAccountInput = z.infer<typeof tradingAccountSchema>;
