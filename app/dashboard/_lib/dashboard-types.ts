import { z } from "zod";

export type TradeDay = {
  date: string;
  day: number;
  pnl: number;
  trades: number;
  winningTrades: number;
  pairs: string[];
  note: string;
  journalId?: string;
  emotionScore: number | null;
};

export type UserProfile = { id: string; email: string; name: string | null };

export const tradeRecordSchema = z.object({
  id: z.string(),
  pair: z.string(),
  side: z.enum(["BUY", "SELL"]),
  entryPrice: z.number(),
  exitPrice: z.number().nullable(),
  stopLoss: z.number().nullable(),
  takeProfit: z.number().nullable(),
  lotSize: z.number(),
  pnl: z.number().nullable(),
  currency: z.string(),
  strategyTag: z.string().nullable(),
  brokerImportId: z.string().nullable(),
  sourcePositionId: z.string().nullable(),
  sourceOrderIds: z.array(z.string()),
  brokerNetPnl: z.number().nullable(),
  commission: z.number().nullable(),
  reconciliationDifference: z.number().nullable(),
  openedAt: z.string(),
  closedAt: z.string().nullable(),
});

export const dashboardDataSchema = z.object({
  currency: z.string(),
  netPnl: z.number(),
  grossProfit: z.number(),
  grossLoss: z.number(),
  tradeCount: z.number(),
  winningTrades: z.number(),
  losingTrades: z.number(),
  breakevenTrades: z.number(),
  winRate: z.number(),
  rewardRiskRatio: z.number().nullable(),
  maxDrawdown: z.number(),
  emotionPnlCorrelation: z.number().nullable(),
  tradingDays: z.number(),
  currentWinningStreak: z.number(),
  longestWinningStreak: z.number(),
  daily: z.array(
    z.object({
      date: z.string(),
      pnl: z.number(),
      tradeCount: z.number(),
      winningTrades: z.number(),
      pairs: z.array(z.string()),
    }),
  ),
  weekly: z.array(
    z.object({
      weekStart: z.string(),
      weekEnd: z.string(),
      pnl: z.number(),
      tradeCount: z.number(),
    }),
  ),
  journals: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      notes: z.string(),
      emotionScore: z.number().nullable(),
    }),
  ),
});

export const tradingAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseCurrency: z.string(),
});

export const eightcapPreviewSchema = z.object({
  filename: z.string(),
  timezone: z.string(),
  summary: z.object({
    totalRows: z.number(),
    filledRows: z.number(),
    cancelledRows: z.number(),
    rejectedRows: z.number(),
    errorRows: z.number(),
  }),
  positions: z.array(
    z.object({
      positionId: z.string(),
      symbol: z.string(),
      direction: z.enum(["LONG", "SHORT"]).nullable(),
      entryQty: z.string(),
      entryPrice: z.string().nullable(),
      exitQty: z.string(),
      exitPrice: z.string().nullable(),
      netClosedPnl: z.string().nullable(),
      status: z.enum(["open", "closed", "needs_review"]),
      issues: z.array(z.object({ message: z.string(), rowNumbers: z.array(z.number()) })),
    }),
  ),
  exceptions: z.array(z.object({ rowNumber: z.number(), message: z.string() })),
});

export const emotionAnalysisSchema = z.object({
  sentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
  composureScore: z.number(),
  summary: z.string(),
  cues: z.array(z.string()),
  reflectionQuestion: z.string(),
});

export const coachingResultSchema = z.object({
  coaching: z.object({
    summary: z.string(),
    patterns: z.array(
      z.object({
        observation: z.string(),
        evidenceIds: z.array(z.string()),
        confidence: z.enum(["low", "medium", "high"]),
      }),
    ),
    reflectionQuestion: z.string(),
  }),
  evidence: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      pair: z.string().optional(),
      side: z.string().optional(),
      strategy: z.string().nullish(),
      pnl: z.number().optional(),
      closedAt: z.string().optional(),
      weekday: z.string().optional(),
      date: z.string().optional(),
      emotionScore: z.number().nullish(),
      note: z.string().optional(),
    }),
  ),
  tradeCount: z.number(),
  journalCount: z.number(),
  periodDays: z.number(),
});

export type TradeRecord = z.infer<typeof tradeRecordSchema>;
export type DashboardData = z.infer<typeof dashboardDataSchema>;
export type TradingAccount = z.infer<typeof tradingAccountSchema>;
export type EightcapPreview = z.infer<typeof eightcapPreviewSchema>;
export type EmotionAnalysis = z.infer<typeof emotionAnalysisSchema>;
export type CoachingResult = z.infer<typeof coachingResultSchema>;

export function parseApiPayload<T extends z.ZodType>(
  schema: T,
  payload: unknown,
  label: string,
): z.output<T> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new Error(`Received an unexpected ${label} response from the server.`);
  }
  return result.data;
}
