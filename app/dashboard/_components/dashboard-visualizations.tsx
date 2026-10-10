import type { ReactNode } from "react";
import { TrendingUp } from "lucide-react";
import { buildEquityCurve } from "@/lib/equity-curve";
import type { TradeDay } from "@/app/dashboard/_lib/dashboard-types";
import { money } from "@/app/dashboard/_lib/dashboard-utils";

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${34 - value * 0.38}`).join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EmotionChart({ values }: { values: number[] }) {
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

export function EquityCurve({ dailyData }: { dailyData: { date: string; pnl: number }[] }) {
  const curve = buildEquityCurve(dailyData);
  if (!curve) {
    return <div className="equity-empty-state" role="img" aria-label="Equity curve">No trades yet</div>;
  }
  const curveColor = curve.isNegative ? "#ff5c66" : "#16c98d";

  return (
    <svg className="equity-chart" viewBox="0 0 500 200" preserveAspectRatio="none" role="img" aria-label="Equity curve over time">
      <defs>
        <linearGradient id="equity-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={curveColor} stopOpacity=".2" />
          <stop offset="100%" stopColor={curveColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={curve.zeroY} x2="500" y2={curve.zeroY} stroke="#666" strokeWidth="1" strokeDasharray="4,4" />
      <polygon points={curve.areaPoints} fill="url(#equity-fill)" />
      <polyline points={curve.points} fill="none" stroke={curveColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MetricCard({
  title, value, subtitle, icon: Icon, color, children,
}: {
  title: string;
  value: string;
  subtitle: ReactNode;
  icon: typeof TrendingUp;
  color: string;
  children: ReactNode;
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

export function DayCell({ day, currentMonth, trade, currency, onSelect }: {
  day: number;
  currentMonth: boolean;
  trade?: TradeDay;
  currency: string;
  onSelect: (trade: TradeDay) => void;
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
