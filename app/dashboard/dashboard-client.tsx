"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Smile,
  Sparkles,
  Mic,
  Target,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

const filters = ["This Month", "Last Month", "Last Quarter", "Last Year", "Eternal"];
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const money = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

type TradeDay = { date: string; day: number; pnl: number; trades: number; winningTrades: number; pairs: string[]; note: string; journalId?: string; emotionScore: number | null };
type TradeRecord = {
  id: string; pair: string; side: "BUY" | "SELL"; entryPrice: number; exitPrice: number | null;
  stopLoss: number | null; takeProfit: number | null;
  lotSize: number; pnl: number | null; currency: string; strategyTag: string | null;
  openedAt: string; closedAt: string | null;
};
type DashboardData = {
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

type UserProfile = { id: string; email: string; name: string | null };
type EmotionAnalysis = {
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  composureScore: number;
  summary: string;
  cues: string[];
  reflectionQuestion: string;
};
type CoachingResult = {
  coaching: {
    summary: string;
    patterns: { observation: string; evidenceIds: string[]; confidence: "low" | "medium" | "high" }[];
    reflectionQuestion: string;
  };
  evidence: { id: string; type: string; pair?: string; side?: string; strategy?: string | null; pnl?: number; closedAt?: string; weekday?: string; date?: string; emotionScore?: number | null; note?: string }[];
  tradeCount: number;
  journalCount: number;
  periodDays: number;
};

type BrowserRecognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type BrowserRecognitionConstructor = new () => BrowserRecognition;

const todayUtc = () => new Date().toISOString().slice(0, 10);
const monthStart = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
const monthEnd = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
const emptyAnalytics = (currency = "USD"): DashboardData => ({
  currency, netPnl: 0, grossProfit: 0, grossLoss: 0, tradeCount: 0, winningTrades: 0,
  losingTrades: 0, breakevenTrades: 0, winRate: 0, rewardRiskRatio: null, maxDrawdown: 0,
  emotionPnlCorrelation: null,
  tradingDays: 0, currentWinningStreak: 0, longestWinningStreak: 0,
  daily: [], weekly: [], journals: [],
});

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${34 - value * 0.38}`).join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmotionChart({ values }: { values: number[] }) {
  const safeValues = values.length ? values : [0, 0];
  const min = Math.min(...safeValues, 0);
  const max = Math.max(...safeValues, 100);
  const points = safeValues.map((value, index) => `${(index / Math.max(safeValues.length - 1, 1)) * 300},${68 - ((value - min) / Math.max(max - min, 1)) * 58}`).join(" ");
  return (
    <svg className="emotion-chart" viewBox="0 0 300 72" preserveAspectRatio="none" role="img" aria-label="Emotion trend over the last 24 sessions">
      <defs>
        <linearGradient id="emotion-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#a58bfa" stopOpacity=".25" />
          <stop offset="100%" stopColor="#a58bfa" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,72 ${points} 300,72`} fill="url(#emotion-fill)" />
      <polyline points={points} fill="none" stroke="#a58bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MetricCard({
  title, value, subtitle, icon: Icon, color, children,
}: {
  title: string; value: string; subtitle: ReactNode; icon: typeof TrendingUp; color: string; children: ReactNode;
}) {
  return (
    <article className="metric-card">
      <div className="metric-copy">
        <div className="metric-title">{title}<Icon size={16} color={color} strokeWidth={2.3} /></div>
        <div className="metric-value">{value}</div>
        <div className="metric-subtitle">{subtitle}</div>
      </div>
      <div className="metric-visual">{children}</div>
    </article>
  );
}

function DayCell({ day, currentMonth, trade, currency, onSelect }: {
  day: number; currentMonth: boolean; trade?: TradeDay; currency: string; onSelect: (trade: TradeDay) => void;
}) {
  return (
    <button
      type="button"
      className={`day-cell ${!currentMonth ? "outside-month" : ""} ${trade ? trade.pnl > 0 ? "positive" : trade.pnl < 0 ? "negative" : "flat" : ""}`}
      onClick={() => trade && onSelect(trade)}
      disabled={!trade}
      aria-label={trade ? `${day}, ${money(trade.pnl, currency)}, ${trade.trades} trades` : `${day}`}
    >
      <span className="day-number">{day}</span>
      {trade && (
        <span className="day-trade">
          <strong>{trade.pnl > 0 ? "+" : trade.pnl < 0 ? "-" : ""}{money(Math.abs(trade.pnl), currency)}</strong>
          <small>{trade.trades} {trade.trades === 1 ? "trade" : "trades"}</small>
        </span>
      )}
    </button>
  );
}

function getCalendarDays(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPreviousMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  return Array.from({ length: totalCells }, (_, index) => {
    const date = index - firstWeekday + 1;
    if (date < 1) return { day: daysInPreviousMonth + date, currentMonth: false };
    if (date > daysInMonth) return { day: date - daysInMonth, currentMonth: false };
    return { day: date, currentMonth: true };
  });
}

export default function DashboardClient({ user }: { user: UserProfile }) {
  const router = useRouter();
  const initialDate = new Date();
  const [month, setMonth] = useState(initialDate.getUTCMonth());
  const [year, setYear] = useState(initialDate.getUTCFullYear());
  const [from, setFrom] = useState(monthStart(initialDate));
  const [to, setTo] = useState(monthEnd(initialDate));
  const [currency, setCurrency] = useState("USD");
  const [activeFilter, setActiveFilter] = useState("This Month");
  const [query, setQuery] = useState("");
  const [selectedTrade, setSelectedTrade] = useState<TradeDay | null>(null);
  const [reflectionDraft, setReflectionDraft] = useState("");
  const [reflectionEmotion, setReflectionEmotion] = useState("");
  const [emotionAnalysis, setEmotionAnalysis] = useState<EmotionAnalysis | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickNote, setQuickNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [analytics, setAnalytics] = useState<DashboardData>(emptyAnalytics());
  const [loading, setLoading] = useState(true);
  const [apiErrorMessage, setApiErrorMessage] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false);
  const [tradeError, setTradeError] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiBusy, setAiBusy] = useState<"emotion" | "quick-log" | "coach" | null>(null);
  const [quickLogText, setQuickLogText] = useState("");
  const [coaching, setCoaching] = useState<CoachingResult | null>(null);
  const [speechMessage, setSpeechMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const speechRecognitionRef = useRef<BrowserRecognition | null>(null);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [tradeRecords, setTradeRecords] = useState<TradeRecord[]>([]);
  const [importMessage, setImportMessage] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);
  const [tradeForm, setTradeForm] = useState({
    pair: "", side: "BUY" as "BUY" | "SELL", entryPrice: "", exitPrice: "", stopLoss: "", takeProfit: "",
    lotSize: "", pnl: "", currency: "USD", openedAt: `${todayUtc()}T09:00`,
    closedAt: `${todayUtc()}T10:00`, strategyTag: "",
  });
  const [journalEmotion, setJournalEmotion] = useState("");
  useEffect(() => () => speechRecognitionRef.current?.stop(), []);
  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);
  const monthName = new Date(year, month).toLocaleString("en-US", { month: "long", year: "numeric" });
  const dateRange = `${new Date(`${from}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(`${to}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const journalByDate = new Map(analytics.journals.map((journal) => [journal.date, journal]));
  const tradesByDay = new Map<string, TradeDay>();
  for (const day of analytics.daily) {
    const journal = journalByDate.get(day.date);
    tradesByDay.set(day.date, {
      date: day.date,
      day: Number(day.date.slice(8, 10)),
      pnl: day.pnl,
      trades: day.tradeCount,
      winningTrades: day.winningTrades,
      pairs: day.pairs,
      note: journal?.notes ?? "No journal reflection for this day.",
      journalId: journal?.id,
      emotionScore: journal?.emotionScore ?? null,
    });
  }
  for (const journal of analytics.journals) {
    if (!tradesByDay.has(journal.date)) {
      tradesByDay.set(journal.date, {
        date: journal.date, day: Number(journal.date.slice(8, 10)), pnl: 0,
        trades: 0, winningTrades: 0, pairs: [], note: journal.notes, journalId: journal.id,
        emotionScore: journal.emotionScore,
      });
    }
  }
  const emotionScores = analytics.journals.flatMap((journal) => journal.emotionScore === null ? [] : [journal.emotionScore]);
  const emotionAverage = emotionScores.length
    ? Math.round(emotionScores.reduce((total, score) => total + score, 0) / emotionScores.length)
    : 0;
  const weeklySummary = analytics.weekly.map((week, index) => ({
    label: `Week ${index + 1}`,
    range: `${new Date(`${week.weekStart}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(`${week.weekEnd}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    pnl: week.pnl,
    trades: week.tradeCount,
  }));
  const monthRange = dateRange;

  const loadAnalytics = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setApiErrorMessage("");
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
      setApiErrorMessage(error instanceof Error ? error.message : "Could not load analytics.");
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

  const shiftMonth = (amount: number) => {
    const next = new Date(Date.UTC(year, month + amount, 1));
    setMonth(next.getUTCMonth());
    setYear(next.getUTCFullYear());
    setFrom(monthStart(next));
    setTo(monthEnd(next));
    setActiveFilter("");
  };

  const applyFilter = (filter: string) => {
    const now = new Date();
    const today = todayUtc();
    let start: Date;
    let end = new Date(`${today}T00:00:00.000Z`);
    if (filter === "This Month") start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    else if (filter === "Last Month") {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    } else if (filter === "Last Quarter") {
      const quarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3 - 3;
      start = new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth, 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth + 3, 0));
    } else if (filter === "Last Year") {
      start = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
      end = new Date(Date.UTC(now.getUTCFullYear() - 1, 11, 31));
    } else {
      start = new Date(Date.UTC(now.getUTCFullYear() - 9, now.getUTCMonth(), now.getUTCDate()));
    }
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
    setMonth(start.getUTCMonth());
    setYear(start.getUTCFullYear());
    setActiveFilter(filter);
  };

  const saveTrade = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTradeError("");
    try {
      const body = {
        ...tradeForm,
        entryPrice: Number(tradeForm.entryPrice),
        exitPrice: tradeForm.exitPrice ? Number(tradeForm.exitPrice) : null,
        stopLoss: tradeForm.stopLoss ? Number(tradeForm.stopLoss) : null,
        takeProfit: tradeForm.takeProfit ? Number(tradeForm.takeProfit) : null,
        lotSize: Number(tradeForm.lotSize),
        pnl: tradeForm.pnl === "" ? null : Number(tradeForm.pnl),
        openedAt: new Date(tradeForm.openedAt).toISOString(),
        closedAt: tradeForm.closedAt ? new Date(tradeForm.closedAt).toISOString() : null,
      };
      const response = await fetch(editingTradeId ? `/api/trades/${editingTradeId}` : "/api/trades", {
        method: editingTradeId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        setTradeError(payload.error?.message ?? "Could not save this trade.");
        return;
      }
      setTradeDialogOpen(false);
      setEditingTradeId(null);
      setTradeForm({ pair: "", side: "BUY", entryPrice: "", exitPrice: "", stopLoss: "", takeProfit: "", lotSize: "", pnl: "", currency, openedAt: `${todayUtc()}T09:00`, closedAt: `${todayUtc()}T10:00`, strategyTag: "" });
      setRequestVersion((version) => version + 1);
    } catch (error) {
      setTradeError(error instanceof Error ? error.message : "Could not save this trade.");
    }
  };

  const editTrade = (trade: TradeRecord) => {
    const localInputDate = (value: string | null) => {
      if (!value) return "";
      const date = new Date(value);
      const two = (part: number) => String(part).padStart(2, "0");
      return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
    };
    setEditingTradeId(trade.id);
    setTradeError("");
    setTradeForm({
      pair: trade.pair, side: trade.side, entryPrice: String(trade.entryPrice),
      exitPrice: trade.exitPrice === null ? "" : String(trade.exitPrice),
      stopLoss: trade.stopLoss === null ? "" : String(trade.stopLoss),
      takeProfit: trade.takeProfit === null ? "" : String(trade.takeProfit),
      lotSize: String(trade.lotSize), pnl: trade.pnl === null ? "" : String(trade.pnl),
      currency: trade.currency, openedAt: localInputDate(trade.openedAt),
      closedAt: localInputDate(trade.closedAt), strategyTag: trade.strategyTag ?? "",
    });
    setTradeDialogOpen(true);
  };

  const deleteTrade = async (trade: TradeRecord) => {
    if (!window.confirm(`Delete the ${trade.pair} trade? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/trades/${trade.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not delete trade.");
      setRequestVersion((version) => version + 1);
    } catch (error) {
      setApiErrorMessage(error instanceof Error ? error.message : "Could not delete trade.");
    }
  };

  const saveCalendarReflection = async () => {
    if (!selectedTrade || !reflectionDraft.trim()) return;
    try {
      const response = await fetch("/api/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryDate: selectedTrade.date,
          notes: reflectionDraft.trim(),
          emotionScore: reflectionEmotion === "" ? null : Number(reflectionEmotion),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not save reflection.");
      setSelectedTrade(null);
      setRequestVersion((version) => version + 1);
    } catch (error) {
      setApiErrorMessage(error instanceof Error ? error.message : "Could not save reflection.");
    }
  };

  const analyzeEmotion = async () => {
    if (!selectedTrade?.journalId) return;
    setAiBusy("emotion");
    setAiError("");
    setEmotionAnalysis(null);
    try {
      const response = await fetch("/api/ai/emotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journalId: selectedTrade.journalId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not analyze this reflection.");
      const analysis = payload.analysis as EmotionAnalysis;
      setEmotionAnalysis(analysis);
      setReflectionEmotion(String(analysis.composureScore));
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Could not analyze this reflection.");
    } finally {
      setAiBusy(null);
    }
  };

  const parseQuickLog = async () => {
    if (!quickLogText.trim()) return;
    setAiBusy("quick-log");
    setAiError("");
    try {
      const response = await fetch("/api/ai/quick-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: quickLogText.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not parse this trade note.");
      const draft = payload.draft as {
        pair: string | null; side: "BUY" | "SELL" | null; entryPrice: number | null; exitPrice: number | null;
        stopLoss: number | null; takeProfit: number | null; lotSize: number | null; pnl: number | null;
        currency: string; strategyTag: string | null; openedAt: string | null; closedAt: string | null;
      };
      const toLocalInput = (value: string | null, fallback: string) => {
        const date = value ? new Date(value) : new Date();
        if (Number.isNaN(date.getTime())) return fallback;
        const two = (part: number) => String(part).padStart(2, "0");
        return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
      };
      setEditingTradeId(null);
      setTradeError("");
      setTradeForm({
        pair: draft.pair ?? "",
        side: draft.side ?? "BUY",
        entryPrice: draft.entryPrice === null ? "" : String(draft.entryPrice),
        exitPrice: draft.exitPrice === null ? "" : String(draft.exitPrice),
        stopLoss: draft.stopLoss === null ? "" : String(draft.stopLoss),
        takeProfit: draft.takeProfit === null ? "" : String(draft.takeProfit),
        lotSize: draft.lotSize === null ? "" : String(draft.lotSize),
        pnl: draft.pnl === null ? "" : String(draft.pnl),
        currency: draft.currency,
        openedAt: toLocalInput(draft.openedAt, `${todayUtc()}T09:00`),
        closedAt: draft.closedAt ? toLocalInput(draft.closedAt, "") : "",
        strategyTag: draft.strategyTag ?? "",
      });
      setQuickLogText("");
      setTradeDialogOpen(true);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Could not parse this trade note.");
    } finally {
      setAiBusy(null);
    }
  };

  const requestCoaching = async () => {
    setAiBusy("coach");
    setAiError("");
    setCoaching(null);
    try {
      const response = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not generate coaching.");
      setCoaching(payload as CoachingResult);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Could not generate coaching.");
    } finally {
      setAiBusy(null);
    }
  };

  const toggleSpeechInput = () => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      return;
    }
    const speechWindow = window as Window & {
      SpeechRecognition?: BrowserRecognitionConstructor;
      webkitSpeechRecognition?: BrowserRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechMessage("Speech input is not supported by this browser. You can still type the trade.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ");
      setQuickLogText((current) => `${current}${current ? " " : ""}${transcript}`.trim());
      setSpeechMessage("Speech transcribed. Review the text before asking AI to parse it.");
    };
    recognition.onerror = (event) => setSpeechMessage(`Speech recognition failed: ${event.error}.`);
    recognition.onend = () => {
      speechRecognitionRef.current = null;
      setIsListening(false);
    };
    speechRecognitionRef.current = recognition;
    setSpeechMessage("Listening…");
    setIsListening(true);
    try {
      recognition.start();
    } catch (error) {
      speechRecognitionRef.current = null;
      setIsListening(false);
      setSpeechMessage(error instanceof Error ? `Could not start speech recognition: ${error.message}` : "Could not start speech recognition.");
    }
  };

  const deleteCalendarReflection = async () => {
    if (!selectedTrade?.journalId) return;
    try {
      const response = await fetch(`/api/journals/${selectedTrade.journalId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not delete reflection.");
      setSelectedTrade(null);
      setRequestVersion((version) => version + 1);
    } catch (error) {
      setApiErrorMessage(error instanceof Error ? error.message : "Could not delete reflection.");
    }
  };

  const saveJournal = async () => {
    const notes = quickNote.trim();
    if (!notes) return;
    setSavedNote("");
    const entryDate = todayUtc();
    try {
      const response = await fetch("/api/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryDate, notes, emotionScore: journalEmotion ? Number(journalEmotion) : null }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setApiErrorMessage(payload.error?.message ?? "Could not save the journal entry.");
        return;
      }
      setQuickNote("");
      setJournalEmotion("");
      setSavedNote(notes);
      setRequestVersion((version) => version + 1);
    } catch (error) {
      setApiErrorMessage(error instanceof Error ? error.message : "Could not save the journal entry.");
    }
  };

  const importCsv = async (file?: File) => {
    if (!file) return;
    setImportMessage("");
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await fetch("/api/import/csv", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) {
        setApiErrorMessage(payload.error?.message ?? "CSV import failed.");
        return;
      }
      setImportMessage(`Imported ${payload.imported} trades; skipped ${payload.duplicates} duplicates.`);
      setRequestVersion((version) => version + 1);
    } catch (error) {
      setApiErrorMessage(error instanceof Error ? error.message : "CSV import failed.");
    }
  };

  const logout = async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setApiErrorMessage(error instanceof Error ? error.message : "Could not sign out.");
    }
  };
  const pnlSamples = analytics.daily.slice(-12).map((item) => item.pnl);
  const pnlMinimum = Math.min(...pnlSamples, 0);
  const pnlMaximum = Math.max(...pnlSamples, 0);
  const pnlSpark = pnlSamples.length
    ? pnlSamples.map((value) => 8 + ((value - pnlMinimum) / Math.max(pnlMaximum - pnlMinimum, 1)) * 25)
    : [0, 0];
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  }).toUpperCase();

  return (
    <main className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><ChartNoAxesCombined size={20} /></div>
          <span>trade<span className="brand-light">journal</span></span>
          <button className="icon-button close-menu" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={19} /></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          <a className="nav-link active" href="#dashboard"><LayoutDashboard size={18} />Dashboard</a>
          <a className="nav-link" href="#calendar"><CalendarDays size={18} />Calendar</a>
          <a className="nav-link" href="#performance"><TrendingUp size={18} />Performance</a>
          <a className="nav-link" href="#journal"><Sparkles size={18} />Journal <span className="nav-pill">Soon</span></a>
        </nav>
        <div className="sidebar-bottom">
          <div className="plan-card">
            <div className="plan-icon"><Target size={17} /></div>
            <div><strong>Build your edge</strong><span>One trade at a time.</span></div>
          </div>
          <button className="profile-button" onClick={logout}>
            <span className="avatar">{(user.name || user.email).slice(0, 1).toUpperCase()}</span>
            <span className="profile-copy"><strong>{user.name || user.email}</strong><small>Sign out</small></span>
            <LogOut size={15} className="profile-chevron" />
          </button>
        </div>
      </aside>
      {menuOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

      <section className="main-content" id="dashboard">
        <header className="topbar">
          <div className="topbar-heading">
            <button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
            <div><div className="eyebrow">{todayLabel}</div><h1>Welcome back, {user.name?.split(" ")[0] || "trader"} <span>✦</span></h1></div>
          </div>
          <div className="topbar-actions">
            <button className="button button-quiet" onClick={() => { setShowSearch(!showSearch); setQuery(""); }}><Search size={16} /> Search</button>
            <input ref={uploadRef} type="file" accept=".csv,text/csv" hidden onChange={(event) => { void importCsv(event.target.files?.[0]); event.currentTarget.value = ""; }} />
            <button className="button button-quiet import-button" onClick={() => uploadRef.current?.click()}><Upload size={16} /> Import CSV</button>
            <button className="button button-primary" onClick={() => { setEditingTradeId(null); setTradeError(""); setTradeForm({ pair: "", side: "BUY", entryPrice: "", exitPrice: "", stopLoss: "", takeProfit: "", lotSize: "", pnl: "", currency, openedAt: `${todayUtc()}T09:00`, closedAt: `${todayUtc()}T10:00`, strategyTag: "" }); setTradeDialogOpen(true); }}><Plus size={17} /> Log a trade</button>
          </div>
        </header>

        <div className={`search-row ${showSearch ? "search-row-open" : ""}`}>
          <label className="search-input"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pairs or journal notes..." aria-label="Search pairs or journal notes" /><button onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button></label>
          <span className="search-hint">{query ? `${analytics.daily.length} matching days` : "Try “EURUSD” or a strategy"}</span>
        </div>

        <div className="filter-row">
          <div className="period-filters" role="tablist" aria-label="Date range">
            {filters.map((filter) => <button key={filter} role="tab" aria-selected={activeFilter === filter} className={`filter-button ${activeFilter === filter ? "selected" : ""}`} onClick={() => applyFilter(filter)}>{filter}</button>)}
          </div>
          <select className="date-select currency-select" aria-label="P&L currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF"].map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
          <button className="date-select" onClick={() => { const selected = new Date(Date.UTC(year, month, 1)); setFrom(monthStart(selected)); setTo(monthEnd(selected)); setActiveFilter(""); }}><CalendarDays size={15} /> {monthRange} <ChevronDown size={14} /></button>
        </div>
        {apiErrorMessage && <div className="dashboard-alert" role="alert">{apiErrorMessage}<button onClick={() => setApiErrorMessage("")} aria-label="Dismiss error"><X size={15} /></button></div>}
        {importMessage && <div className="dashboard-notice" role="status">{importMessage}<button onClick={() => setImportMessage("")} aria-label="Dismiss import status"><X size={15} /></button></div>}

        <section className="metrics-grid" id="performance" aria-label="Trading performance" aria-busy={loading}>
          <MetricCard title="Net P&L" value={money(analytics.netPnl, analytics.currency)} subtitle={<span className={analytics.netPnl >= 0 ? "text-profit" : "text-loss"}>{analytics.netPnl >= 0 ? "↗ Realized profit" : "↘ Realized loss"}</span>} icon={TrendingUp} color="#16c98d">
            <Sparkline values={pnlSpark} color="#16c98d" />
          </MetricCard>
          <article className="metric-card emotion-card">
            <div className="metric-copy"><div className="metric-title">Journal composure <Smile size={16} color="#f5a25d" /></div><div className="metric-value">{emotionScores.length ? emotionAverage : "—"}<span className="metric-unit">/ 100</span></div><div className="metric-subtitle">{emotionScores.length ? `${emotionScores.length} scored reflections` : "No composure scores yet"}</div></div>
            <div className="emotion-visual"><EmotionChart values={emotionScores} /><div className="chart-caption"><span>{from.slice(5)}</span><span>{to.slice(5)}</span></div></div>
          </article>
          <article className="metric-card">
            <div className="metric-copy"><div className="metric-title">Trade win rate <TrendingUp size={16} color="#a58bfa" /></div><div className="metric-value">{analytics.winRate}%</div><div className="metric-subtitle">{analytics.winningTrades} winners out of {analytics.tradeCount} trades</div></div>
            <div className="donut-wrap"><div className="donut" style={{ background: `conic-gradient(#ffc28e 0 ${analytics.winRate / 2}%,#a58bfa ${analytics.winRate / 2}% ${analytics.winRate}%,#32394a ${analytics.winRate}% 100%)` }}><span>{analytics.winRate}%</span></div></div>
          </article>
          <MetricCard title="Winning-day streak" value={`${analytics.currentWinningStreak}`} subtitle={`Best: ${analytics.longestWinningStreak} trading days`} icon={Flame} color="#fa914d">
            <div className="streak-ring"><Flame size={21} /></div>
          </MetricCard>
        </section>
        <div className="analytics-strip"><span>Planned R:R <strong>{analytics.rewardRiskRatio === null ? "—" : `${analytics.rewardRiskRatio}:1`}</strong></span><span>Max drawdown <strong className="text-loss">{money(analytics.maxDrawdown, analytics.currency)}</strong></span><span>Closed trades <strong>{analytics.tradeCount}</strong></span><span title="Pearson correlation on days with both a saved composure score and realized P&L; not evidence of causation.">Composure/P&amp;L correlation <strong>{analytics.emotionPnlCorrelation === null ? "Need 3+ scored days" : analytics.emotionPnlCorrelation.toFixed(2)}</strong></span><span>{loading ? "Refreshing…" : `${analytics.tradingDays} trading days`}</span></div>

        <section className="ai-tools panel" aria-labelledby="ai-tools-title">
          <div className="panel-header ai-tools-heading">
            <div><div className="eyebrow">AI ASSISTANT · OPTIONAL</div><h2 id="ai-tools-title">Reflect, review, and log</h2></div>
            <span className="beta-tag">BETA</span>
          </div>
          <p className="ai-privacy-note">AI actions send only the text or limited account history you choose to analyze to the configured OpenAI provider. Nothing is sent automatically. AI output is an unverified reflection aid, not financial advice.</p>
          <div className="ai-tool-grid">
            <div className="ai-tool-card">
              <h3>Quick trade log</h3>
              <p>Describe a trade in your own words. Review and edit the extracted draft before saving.</p>
              <textarea value={quickLogText} maxLength={500} onChange={(event) => setQuickLogText(event.target.value)} placeholder="BUY XAUUSD 0.5 lot at 2650, SL 2640, TP 2670" aria-label="Trade description for AI quick log" />
              <div className="ai-tool-actions">
                <button className="button button-quiet" type="button" onClick={toggleSpeechInput}><Mic size={15} /> {isListening ? "Stop listening" : "Use speech"}</button>
                <button className="button button-primary" type="button" onClick={() => void parseQuickLog()} disabled={!quickLogText.trim() || aiBusy !== null}><Sparkles size={15} /> {aiBusy === "quick-log" ? "Parsing…" : "Create draft"}</button>
              </div>
              {speechMessage && <p className="ai-status" role="status">{speechMessage} Speech recognition may be processed by your browser&apos;s speech provider.</p>}
            </div>
            <div className="ai-tool-card">
              <h3>History coaching</h3>
              <p>Find tentative patterns in up to 100 closed trades and 40 recent journal notes from the last year, in {currency}.</p>
              <button className="button button-primary" type="button" onClick={() => void requestCoaching()} disabled={aiBusy !== null}><Sparkles size={15} /> {aiBusy === "coach" ? "Reviewing history…" : "Review my history"}</button>
              {coaching && <div className="ai-result" aria-live="polite">
                <p>{coaching.coaching.summary}</p>
                {coaching.coaching.patterns.map((pattern, index) => <article className="ai-pattern" key={`${pattern.observation}-${index}`}>
                  <strong>{pattern.observation}</strong><span>Confidence: {pattern.confidence}</span>
                  <ul>{pattern.evidenceIds.map((id) => {
                    const item = coaching.evidence.find((entry) => entry.id === id);
                    if (!item) return null;
                    return <li key={id}>{item.type === "trade"
                      ? `${item.pair} ${item.side} · ${item.weekday} · ${money(item.pnl ?? 0, currency)}`
                      : `${item.date} journal · composure ${item.emotionScore ?? "not scored"}/100 · “${item.note ?? ""}”`}</li>;
                  })}</ul>
                </article>)}
                <p className="ai-reflection-question">{coaching.coaching.reflectionQuestion}</p>
                <small>Based on {coaching.tradeCount} closed trades and {coaching.journalCount} journal entries. Patterns are observational, not causal or predictive.</small>
              </div>}
            </div>
          </div>
          {aiError && <div className="auth-error ai-error" role="alert">{aiError}</div>}
        </section>

        <div className="dashboard-grid">
          <section className="calendar-panel panel" id="calendar">
            <div className="panel-header">
              <div><div className="eyebrow">YOUR ACTIVITY</div><h2>Trading calendar</h2></div>
              <div className="calendar-controls"><button className="icon-button" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ArrowLeft size={17} /></button><h3>{monthName}</h3><button className="icon-button" onClick={() => shiftMonth(1)} aria-label="Next month"><ArrowRight size={17} /></button></div>
            </div>
            {!loading && !analytics.daily.length && !analytics.journals.length && <p className="empty-state">No trades or journal entries in this date range. Log a trade or add a reflection to get started.</p>}
            {loading && <p className="loading-caption" role="status">Loading your account analytics…</p>}
            <div className="weekday-row">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid">
              {calendarDays.map((date, index) => {
                const monthKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
                const trade = date.currentMonth ? tradesByDay.get(monthKey) : undefined;
                return                 <DayCell key={`${index}-${date.day}`} day={date.day} currentMonth={date.currentMonth} trade={trade} currency={analytics.currency} onSelect={(selected) => { setSelectedTrade(selected); setReflectionDraft(selected.journalId ? selected.note : ""); setReflectionEmotion(selected.emotionScore === null ? "" : String(selected.emotionScore)); setEmotionAnalysis(null); setAiError(""); }} />;
              })}
            </div>
            <div className="calendar-footer"><span><i className="legend-dot green" /> Profit day</span><span><i className="legend-dot red" /> Loss day</span><span className="footer-note">Select a day to view your notes</span></div>
          </section>

          <aside className="right-column">
            <section className="weekly-panel panel">
              <div className="panel-header weekly-heading"><div><div className="eyebrow">PERIOD SUMMARY</div><h2>Weekly breakdown</h2></div><button className="icon-button" aria-label="More weekly options"><ChevronDown size={17} /></button></div>
              <div className="week-list">
                {weeklySummary.map((week) => <article className={`week-card ${week.pnl < 0 ? "week-loss" : ""}`} key={week.label}>
                  <div className="week-card-heading"><strong>{week.label}</strong><span>{week.range}</span></div>
                  <div className="week-data"><div><small><span className="tiny-icon purple">$</span> P&amp;L</small><strong className={week.pnl > 0 ? "text-profit" : week.pnl < 0 ? "text-loss" : "muted"}>{money(week.pnl, analytics.currency)}</strong><span className={`week-status ${week.pnl > 0 ? "text-profit" : week.pnl < 0 ? "text-loss" : "muted"}`}>{week.pnl > 0 ? <ArrowUpRight size={13} /> : week.pnl < 0 ? <ArrowDownRight size={13} /> : null}{week.pnl > 0 ? "Profit" : week.pnl < 0 ? "Loss" : "No trades"}</span></div>
                    <div><small><span className="tiny-icon orange">▥</span> Trades</small><strong>{week.trades}</strong><span className="week-status muted">{week.trades === 1 ? "trade" : "trades"} executed</span></div></div>
                </article>)}
              </div>
              {!weeklySummary.length && <p className="empty-state compact">No closed trades in this range.</p>}
              <button className="text-link">View all analytics <ArrowRight size={14} /></button>
            </section>
            <section className="insight-card">
              <div className="insight-heading"><div className="insight-icon"><Sparkles size={16} /></div><span>PERFORMANCE NOTE</span><span className="beta-tag">STATS</span></div>
              <p>Your average planned reward-to-risk on closed trades with a stop and target is <strong>{analytics.rewardRiskRatio === null ? "not available yet" : `${analytics.rewardRiskRatio}:1`}</strong>. Maximum realized drawdown in this range is <strong>{money(analytics.maxDrawdown, analytics.currency)}</strong>.</p>
              <button onClick={() => document.getElementById("quick-journal")?.focus()}>Add a reflection <ArrowRight size={14} /></button>
            </section>
          </aside>
        </div>

        <section className="recent-trades panel">
          <div className="panel-header"><div><div className="eyebrow">TRADE HISTORY</div><h2>Recent trades</h2></div><span className="trade-count-label">{tradeRecords.length} shown</span></div>
          {tradeRecords.length ? <div className="trade-table-wrap"><table className="trade-table">
            <thead><tr><th>Pair</th><th>Side</th><th>Entry → Exit</th><th>Closed</th><th>P&amp;L</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{tradeRecords.map((trade) => <tr key={trade.id}>
              <td><strong>{trade.pair}</strong>{trade.strategyTag && <small>{trade.strategyTag}</small>}</td>
              <td><span className={`side-pill ${trade.side === "BUY" ? "side-buy" : "side-sell"}`}>{trade.side}</span></td>
              <td>{trade.entryPrice} → {trade.exitPrice ?? "Open"}</td>
              <td>{trade.closedAt ? new Date(trade.closedAt).toLocaleString("en-US", { month: "short", day: "numeric" }) : "Open"}</td>
              <td className={trade.pnl === null ? "muted" : trade.pnl > 0 ? "text-profit" : trade.pnl < 0 ? "text-loss" : ""}>{trade.pnl === null ? "Open" : money(trade.pnl, trade.currency)}</td>
              <td><div className="row-actions"><button onClick={() => editTrade(trade)} aria-label={`Edit ${trade.pair} trade`}>Edit</button><button onClick={() => void deleteTrade(trade)} aria-label={`Delete ${trade.pair} trade`}>Delete</button></div></td>
            </tr>)}</tbody>
          </table></div> : <p className="empty-state">No trades found in this date range.</p>}
        </section>

        <section className={`quick-log panel ${savedNote ? "has-saved-note" : ""}`} id="journal">
          <div><div className="eyebrow">END-OF-DAY REFLECTION</div><h2>How did you trade today?</h2><p>Capture what went well, what you learned, and how you felt. Saved for {todayUtc()}.</p></div>
          <div className="quick-log-action"><input id="quick-journal" value={quickNote} onChange={(event) => setQuickNote(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveJournal(); }} placeholder="Write a quick note..." aria-label="Quick journal note" /><select aria-label="Emotion score" value={journalEmotion} onChange={(event) => setJournalEmotion(event.target.value)}><option value="">Score</option>{Array.from({ length: 11 }, (_, index) => <option key={index} value={index * 10}>{index * 10}</option>)}</select><button className="button button-primary" onClick={() => void saveJournal()}><Plus size={16} /> Save note</button></div>
          {savedNote && <div className="saved-note" role="status"><span><strong>Saved reflection</strong>{savedNote}</span><button onClick={() => setSavedNote("")} aria-label="Dismiss saved note"><X size={15} /></button></div>}
        </section>
        <footer className="page-footer"><span>Made for the long game.</span><span>{analytics.currency} · {from} to {to}</span></footer>
      </section>

      {selectedTrade && <div className="modal-backdrop" role="presentation" onClick={() => setSelectedTrade(null)}><section className="trade-modal panel" role="dialog" aria-modal="true" aria-labelledby="trade-modal-title" onClick={(event) => event.stopPropagation()}>
        <button className="icon-button modal-close" onClick={() => setSelectedTrade(null)} aria-label="Close trade details"><X size={18} /></button>
        <div className="eyebrow">{selectedTrade.date}</div><h2 id="trade-modal-title">Day reflection</h2>
        <div className={`modal-pnl ${selectedTrade.pnl > 0 ? "text-profit" : selectedTrade.pnl < 0 ? "text-loss" : ""}`}>{selectedTrade.pnl > 0 ? "+" : selectedTrade.pnl < 0 ? "-" : ""}{money(Math.abs(selectedTrade.pnl), analytics.currency)}<span> · {selectedTrade.trades} {selectedTrade.trades === 1 ? "trade" : "trades"}</span></div>
        <div className="pair-list">{selectedTrade.pairs.map((pair) => <span key={pair}>{pair}</span>)}</div>
        <label className="reflection-label">Journal reflection<textarea value={reflectionDraft} maxLength={10_000} onChange={(event) => { setReflectionDraft(event.target.value); setEmotionAnalysis(null); }} placeholder="What did you learn from this day?" /></label>
        <label className="reflection-label reflection-score">Composure score (0 = reactive, 100 = calm)<select value={reflectionEmotion} onChange={(event) => setReflectionEmotion(event.target.value)}><option value="">Not scored</option>{reflectionEmotion !== "" && Number(reflectionEmotion) % 10 !== 0 && <option value={reflectionEmotion}>{reflectionEmotion} · AI estimate</option>}{Array.from({ length: 11 }, (_, index) => <option key={index} value={index * 10}>{index * 10}</option>)}</select></label>
        {selectedTrade.journalId && <div className="ai-inline">
          <button className="button button-quiet" type="button" onClick={() => void analyzeEmotion()} disabled={aiBusy !== null || !reflectionDraft.trim() || reflectionDraft !== selectedTrade.note}><Sparkles size={14} /> {aiBusy === "emotion" ? "Analyzing…" : "Analyze saved reflection"}</button>
          <small>Submitting sends this saved note to the configured AI provider. The score is not saved until you save the reflection.</small>
          {emotionAnalysis && <div className="ai-result" aria-live="polite"><strong>{emotionAnalysis.sentiment} · composure {emotionAnalysis.composureScore}/100</strong><p>{emotionAnalysis.summary}</p>{emotionAnalysis.cues.length > 0 && <p>Signals: {emotionAnalysis.cues.join(" · ")}</p>}<p className="ai-reflection-question">{emotionAnalysis.reflectionQuestion}</p></div>}
          {aiError && <div className="auth-error" role="alert">{aiError}</div>}
        </div>}
        <div className="trade-form-actions"><button className="button button-primary" onClick={() => void saveCalendarReflection()} disabled={!reflectionDraft.trim()}><Plus size={15} /> Save reflection</button>{selectedTrade.journalId && <button className="button button-quiet" onClick={() => void deleteCalendarReflection()}>Delete reflection</button>}</div>
      </section></div>}
      {tradeDialogOpen && <div className="modal-backdrop" role="presentation" onClick={() => setTradeDialogOpen(false)}><section className="trade-modal panel trade-form-modal" role="dialog" aria-modal="true" aria-labelledby="trade-form-title" onClick={(event) => event.stopPropagation()}>
        <button className="icon-button modal-close" onClick={() => setTradeDialogOpen(false)} aria-label="Close trade form"><X size={18} /></button>
        <div className="eyebrow">TRADE JOURNAL</div><h2 id="trade-form-title">{editingTradeId ? "Edit trade" : "Log a trade"}</h2>
        <form className="trade-form" onSubmit={(event) => void saveTrade(event)}>
          <label>Pair<input required maxLength={32} placeholder="EURUSD" value={tradeForm.pair} onChange={(event) => setTradeForm({ ...tradeForm, pair: event.target.value.toUpperCase() })} /></label>
          <label>Side<select value={tradeForm.side} onChange={(event) => setTradeForm({ ...tradeForm, side: event.target.value as "BUY" | "SELL" })}><option>BUY</option><option>SELL</option></select></label>
          <label>Currency<select value={tradeForm.currency} onChange={(event) => setTradeForm({ ...tradeForm, currency: event.target.value })}>{["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF"].map((code) => <option key={code}>{code}</option>)}</select></label>
          <label>Entry price<input type="number" min="0.00000001" step="any" required value={tradeForm.entryPrice} onChange={(event) => setTradeForm({ ...tradeForm, entryPrice: event.target.value })} /></label>
          <label>Exit price (optional)<input type="number" min="0.00000001" step="any" value={tradeForm.exitPrice} onChange={(event) => setTradeForm({ ...tradeForm, exitPrice: event.target.value })} /></label>
          <label>Stop loss (optional)<input type="number" min="0.00000001" step="any" value={tradeForm.stopLoss} onChange={(event) => setTradeForm({ ...tradeForm, stopLoss: event.target.value })} /></label>
          <label>Take profit (optional)<input type="number" min="0.00000001" step="any" value={tradeForm.takeProfit} onChange={(event) => setTradeForm({ ...tradeForm, takeProfit: event.target.value })} /></label>
          <label>Lot size<input type="number" min="0.0001" step="any" required value={tradeForm.lotSize} onChange={(event) => setTradeForm({ ...tradeForm, lotSize: event.target.value })} /></label>
          <label>Realized P&amp;L ({tradeForm.currency}, optional)<input type="number" step="0.01" value={tradeForm.pnl} onChange={(event) => setTradeForm({ ...tradeForm, pnl: event.target.value })} /></label>
          <label>Opened at<input type="datetime-local" required value={tradeForm.openedAt} onChange={(event) => setTradeForm({ ...tradeForm, openedAt: event.target.value })} /></label>
          <label>Closed at (optional)<input type="datetime-local" value={tradeForm.closedAt} onChange={(event) => setTradeForm({ ...tradeForm, closedAt: event.target.value })} /></label>
          <label className="trade-form-wide">Strategy tag<input maxLength={80} value={tradeForm.strategyTag} onChange={(event) => setTradeForm({ ...tradeForm, strategyTag: event.target.value })} /></label>
          {tradeError && <div className="auth-error trade-form-wide" role="alert">{tradeError}</div>}
          <div className="trade-form-actions trade-form-wide"><button type="button" className="button button-quiet" onClick={() => setTradeDialogOpen(false)}>Cancel</button><button className="button button-primary"><Plus size={15} /> Save trade</button></div>
        </form>
      </section></div>}
    </main>
  );
}
