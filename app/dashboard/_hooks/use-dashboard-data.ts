"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardData, TradeRecord } from "@/app/dashboard/_lib/dashboard-types";

type UseDashboardDataOptions = {
  from: string;
  to: string;
  currency: string;
  query: string;
};

const emptyAnalytics = (currency = "USD"): DashboardData => ({
  currency,
  netPnl: 0,
  grossProfit: 0,
  grossLoss: 0,
  tradeCount: 0,
  winningTrades: 0,
  losingTrades: 0,
  breakevenTrades: 0,
  winRate: 0,
  rewardRiskRatio: null,
  maxDrawdown: 0,
  emotionPnlCorrelation: null,
  tradingDays: 0,
  currentWinningStreak: 0,
  longestWinningStreak: 0,
  daily: [],
  weekly: [],
  journals: [],
});

export function useDashboardData({ from, to, currency, query }: UseDashboardDataOptions) {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<DashboardData>(emptyAnalytics());
  const [tradeRecords, setTradeRecords] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);

  const refresh = useCallback(() => {
    setRequestVersion((version) => version + 1);
  }, []);

  const loadAnalytics = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setErrorMessage("");
    try {
      const params = new URLSearchParams({ from, to, currency, q: query });
      const [response, tradesResponse] = await Promise.all([
        fetch(`/api/analytics?${params}`, { cache: "no-store", signal }),
        fetch(`/api/trades?${params}&limit=100`, { cache: "no-store", signal }),
      ]);
      if (response.status === 401 || tradesResponse.status === 401) {
        router.replace("/login");
        return;
      }
      const [payload, tradePayload] = await Promise.all([response.json(), tradesResponse.json()]);
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not load analytics.");
      if (!tradesResponse.ok) throw new Error(tradePayload.error?.message ?? "Could not load trades.");
      setAnalytics(payload as DashboardData);
      setTradeRecords(tradePayload.trades as TradeRecord[]);
    } catch (error) {
      if (signal.aborted) return;
      setErrorMessage(error instanceof Error ? error.message : "Could not load analytics.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [currency, from, query, router, to]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void loadAnalytics(controller.signal), 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadAnalytics, requestVersion]);

  return {
    analytics,
    tradeRecords,
    loading,
    errorMessage,
    setErrorMessage,
    refresh,
  };
}
