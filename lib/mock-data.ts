export type TradeDay = {
  day: number;
  pnl: number;
  trades: number;
  winningTrades: number;
  pairs: string[];
  note: string;
};

export const demoMonth = { year: 2025, month: 2 };

export const tradesByDay: Record<number, TradeDay> = {
  3: { day: 3, pnl: 2104, trades: 2, winningTrades: 1, pairs: ["EURUSD", "XAUUSD"], note: "Waited for confirmation and followed the plan." },
  4: { day: 4, pnl: 1500, trades: 1, winningTrades: 1, pairs: ["GBPUSD"], note: "Clean breakout entry. Stayed patient." },
  5: { day: 5, pnl: -500, trades: 1, winningTrades: 0, pairs: ["XAUUSD"], note: "Entered early before the candle closed." },
  6: { day: 6, pnl: 1787, trades: 1, winningTrades: 1, pairs: ["EURUSD"], note: "Good risk management on a trend continuation." },
  10: { day: 10, pnl: -212, trades: 1, winningTrades: 0, pairs: ["GBPJPY"], note: "Stopped after one loss. No revenge trading." },
  11: { day: 11, pnl: 883, trades: 1, winningTrades: 1, pairs: ["EURUSD"], note: "A+ setup, risk kept within limits." },
  12: { day: 12, pnl: 250, trades: 1, winningTrades: 1, pairs: ["XAUUSD"], note: "Small win. Could have let the trade run." },
  18: { day: 18, pnl: -510, trades: 4, winningTrades: 0, pairs: ["XAUUSD", "GBPUSD"], note: "Overtraded after a frustrating start." },
  20: { day: 20, pnl: 640, trades: 2, winningTrades: 1, pairs: ["EURUSD", "USDJPY"], note: "Took a break between trades." },
  24: { day: 24, pnl: 220, trades: 1, winningTrades: 1, pairs: ["EURUSD"], note: "Steady execution. No plan changes." },
  26: { day: 26, pnl: -180, trades: 1, winningTrades: 0, pairs: ["GBPUSD"], note: "Moved stop loss too early." },
};

export const emotionValues = [16, 25, 19, 42, 22, 30, 18, 34, 27, 48, 24, 39, 32, 55, 28, 41, 35, 62, 30, 45, 34, 51, 40, 68];
