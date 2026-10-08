export type ClosedTrade = {
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
  openedAt: Date;
  closedAt: Date | null;
};

export type JournalDay = {
  id: string;
  entryDate: Date;
  notes: string;
  emotionScore: number | null;
};

export type DailySummary = {
  date: string;
  pnl: number;
  tradeCount: number;
  winningTrades: number;
  pairs: string[];
};

export type WeeklySummary = {
  weekStart: string;
  weekEnd: string;
  pnl: number;
  tradeCount: number;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfUtcWeek(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - weekday);
  return start;
}

export function calculateAnalytics(trades: ClosedTrade[], journals: JournalDay[]) {
  const realized = trades.filter((trade) => trade.closedAt && trade.pnl !== null);
  const dailyMap = new Map<string, DailySummary>();

  for (const trade of realized) {
    const date = dayKey(trade.closedAt!);
    const daily = dailyMap.get(date) ?? { date, pnl: 0, tradeCount: 0, winningTrades: 0, pairs: [] };
    daily.pnl += trade.pnl!;
    daily.tradeCount += 1;
    if (trade.pnl! > 0) daily.winningTrades += 1;
    if (!daily.pairs.includes(trade.pair)) daily.pairs.push(trade.pair);
    dailyMap.set(date, daily);
  }

  const daily = [...dailyMap.values()]
    .map((item) => ({ ...item, pnl: roundMoney(item.pnl) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const grossProfit = roundMoney(realized.reduce((sum, trade) => sum + Math.max(trade.pnl!, 0), 0));
  const grossLoss = roundMoney(realized.reduce((sum, trade) => sum + Math.min(trade.pnl!, 0), 0));
  const netPnl = roundMoney(grossProfit + grossLoss);
  const winningTrades = realized.filter((trade) => trade.pnl! > 0).length;
  const tradeCount = realized.length;

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const trade of [...realized].sort((a, b) => a.closedAt!.getTime() - b.closedAt!.getTime() || a.id.localeCompare(b.id))) {
    equity = roundMoney(equity + trade.pnl!);
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }

  let currentWinningStreak = 0;
  let longestWinningStreak = 0;
  for (const day of daily) {
    if (day.pnl > 0) {
      currentWinningStreak += 1;
      longestWinningStreak = Math.max(longestWinningStreak, currentWinningStreak);
    } else {
      currentWinningStreak = 0;
    }
  }

  const riskRewardTrades = realized.filter(
    (trade) => trade.stopLoss !== null && trade.takeProfit !== null && trade.stopLoss !== trade.entryPrice,
  );
  const rewardRiskRatio = riskRewardTrades.length
    ? roundMoney(riskRewardTrades.reduce((sum, trade) =>
      sum + Math.abs(trade.takeProfit! - trade.entryPrice) / Math.abs(trade.entryPrice - trade.stopLoss!), 0,
    ) / riskRewardTrades.length)
    : null;

  const dailyPnl = new Map(daily.map((day) => [day.date, day.pnl]));
  const emotionPairs = journals.flatMap((journal) => {
    const pnl = dailyPnl.get(dayKey(journal.entryDate));
    return journal.emotionScore === null || pnl === undefined ? [] : [{ emotion: journal.emotionScore, pnl }];
  });
  let emotionPnlCorrelation: number | null = null;
  if (emotionPairs.length >= 3) {
    const meanEmotion = emotionPairs.reduce((sum, pair) => sum + pair.emotion, 0) / emotionPairs.length;
    const meanPnl = emotionPairs.reduce((sum, pair) => sum + pair.pnl, 0) / emotionPairs.length;
    const covariance = emotionPairs.reduce(
      (sum, pair) => sum + (pair.emotion - meanEmotion) * (pair.pnl - meanPnl), 0,
    );
    const emotionVariance = emotionPairs.reduce((sum, pair) => sum + (pair.emotion - meanEmotion) ** 2, 0);
    const pnlVariance = emotionPairs.reduce((sum, pair) => sum + (pair.pnl - meanPnl) ** 2, 0);
    if (emotionVariance > 0 && pnlVariance > 0) {
      emotionPnlCorrelation = Math.round((covariance / Math.sqrt(emotionVariance * pnlVariance)) * 100) / 100;
    }
  }

  const weekMap = new Map<string, WeeklySummary>();
  for (const day of daily) {
    const start = startOfUtcWeek(new Date(`${day.date}T00:00:00.000Z`));
    const startKey = dayKey(start);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    const week = weekMap.get(startKey) ?? {
      weekStart: startKey,
      weekEnd: dayKey(end),
      pnl: 0,
      tradeCount: 0,
    };
    week.pnl += day.pnl;
    week.tradeCount += day.tradeCount;
    weekMap.set(startKey, week);
  }

  return {
    netPnl,
    grossProfit,
    grossLoss,
    tradeCount,
    winningTrades,
    losingTrades: realized.filter((trade) => trade.pnl! < 0).length,
    breakevenTrades: realized.filter((trade) => trade.pnl === 0).length,
    winRate: tradeCount ? roundMoney((winningTrades / tradeCount) * 100) : 0,
    rewardRiskRatio,
    emotionPnlCorrelation,
    maxDrawdown: roundMoney(maxDrawdown),
    tradingDays: daily.length,
    currentWinningStreak,
    longestWinningStreak,
    daily,
    weekly: [...weekMap.values()].map((week) => ({ ...week, pnl: roundMoney(week.pnl) })),
    journals: journals.map((journal) => ({
      date: dayKey(journal.entryDate),
      id: journal.id,
      notes: journal.notes,
      emotionScore: journal.emotionScore,
    })),
  };
}
