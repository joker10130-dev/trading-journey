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

export type TradeRecord = {
  id: string;
  pair: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  lotSize: number;
  pnl: number | null;
  currency: string;
  strategyTag: string | null;
  brokerImportId: string | null;
  sourcePositionId: string | null;
  sourceOrderIds: string[];
  brokerNetPnl: number | null;
  commission: number | null;
  reconciliationDifference: number | null;
  openedAt: string;
  closedAt: string | null;
};

export type DashboardData = {
  currency: string;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  tradeCount: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number;
  rewardRiskRatio: number | null;
  maxDrawdown: number;
  emotionPnlCorrelation: number | null;
  tradingDays: number;
  currentWinningStreak: number;
  longestWinningStreak: number;
  daily: { date: string; pnl: number; tradeCount: number; winningTrades: number; pairs: string[] }[];
  weekly: { weekStart: string; weekEnd: string; pnl: number; tradeCount: number }[];
  journals: { id: string; date: string; notes: string; emotionScore: number | null }[];
};

export type UserProfile = { id: string; email: string; name: string | null };
export type TradingAccount = { id: string; name: string; baseCurrency: string };

export type EightcapPreview = {
  filename: string;
  timezone: string;
  summary: { totalRows: number; filledRows: number; cancelledRows: number; rejectedRows: number; errorRows: number };
  positions: {
    positionId: string;
    symbol: string;
    direction: "LONG" | "SHORT" | null;
    entryQty: string;
    entryPrice: string | null;
    exitQty: string;
    exitPrice: string | null;
    netClosedPnl: string | null;
    status: "open" | "closed" | "needs_review";
    issues: { message: string; rowNumbers: number[] }[];
  }[];
  exceptions: { rowNumber: number; message: string }[];
};

export type EmotionAnalysis = {
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  composureScore: number;
  summary: string;
  cues: string[];
  reflectionQuestion: string;
};

export type CoachingResult = {
  coaching: {
    summary: string;
    patterns: { observation: string; evidenceIds: string[]; confidence: "low" | "medium" | "high" }[];
    reflectionQuestion: string;
  };
  evidence: {
    id: string;
    type: string;
    pair?: string;
    side?: string;
    strategy?: string | null;
    pnl?: number;
    closedAt?: string;
    weekday?: string;
    date?: string;
    emotionScore?: number | null;
    note?: string;
  }[];
  tradeCount: number;
  journalCount: number;
  periodDays: number;
};
