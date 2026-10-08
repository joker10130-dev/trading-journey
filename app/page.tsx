"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
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
  Menu,
  Plus,
  Search,
  Smile,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { demoMonth, emotionValues, tradesByDay, type TradeDay } from "@/lib/mock-data";

const filters = ["This Month", "Last Month", "Last Quarter", "Last Year", "Eternal"];
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const money = (value: number) =>
  `${value < 0 ? "-$" : "$"}${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${34 - value * 0.38}`).join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmotionChart() {
  const points = emotionValues.map((value, index) => `${(index / (emotionValues.length - 1)) * 300},${68 - value * 0.85}`).join(" ");
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

function DayCell({ day, currentMonth, trade, onSelect }: {
  day: number; currentMonth: boolean; trade?: TradeDay; onSelect: (trade: TradeDay) => void;
}) {
  return (
    <button
      type="button"
      className={`day-cell ${!currentMonth ? "outside-month" : ""} ${trade ? trade.pnl > 0 ? "positive" : "negative" : ""}`}
      onClick={() => trade && onSelect(trade)}
      disabled={!trade}
      aria-label={trade ? `${day}, ${money(trade.pnl)}, ${trade.trades} trades` : `${day}`}
    >
      <span className="day-number">{day}</span>
      {trade && (
        <span className="day-trade">
          <strong>{trade.pnl > 0 ? "+" : "-"}${Math.abs(trade.pnl).toLocaleString("en-US")}</strong>
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

export default function DashboardPage() {
  const [month, setMonth] = useState(demoMonth.month);
  const [year, setYear] = useState(demoMonth.year);
  const [activeFilter, setActiveFilter] = useState("This Month");
  const [query, setQuery] = useState("");
  const [selectedTrade, setSelectedTrade] = useState<TradeDay | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickNote, setQuickNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);
  const monthName = new Date(year, month).toLocaleString("en-US", { month: "long", year: "numeric" });
  const periodTrades = month === demoMonth.month && year === demoMonth.year ? Object.values(tradesByDay) : [];
  const filteredTrades = periodTrades.filter((trade) => {
    const normalizedQuery = query.trim().toLowerCase();
    return !normalizedQuery || trade.pairs.some((pair) => pair.toLowerCase().includes(normalizedQuery)) || trade.note.toLowerCase().includes(normalizedQuery);
  });
  const visibleTradeDays = new Set(filteredTrades.map((trade) => trade.day));
  const netPnl = filteredTrades.reduce((total, trade) => total + trade.pnl, 0);
  const tradeCount = filteredTrades.reduce((total, trade) => total + trade.trades, 0);
  const winningTrades = filteredTrades.reduce((total, trade) => total + trade.winningTrades, 0);
  const winRate = tradeCount ? Math.round((winningTrades / tradeCount) * 1000) / 10 : 0;
  const weekCount = Math.ceil(new Date(year, month + 1, 0).getDate() / 7);
  const weeklySummary = Array.from({ length: weekCount }, (_, index) => {
    const startDay = index * 7 + 1;
    const endDay = Math.min(startDay + 6, new Date(year, month + 1, 0).getDate());
    const weekTrades = filteredTrades.filter((trade) => trade.day >= startDay && trade.day <= endDay);
    const pnl = weekTrades.reduce((total, trade) => total + trade.pnl, 0);
    const range = `${new Date(year, month, startDay).toLocaleString("en-US", { month: "short", day: "numeric" })} – ${new Date(year, month, endDay).toLocaleString("en-US", { month: "short", day: "numeric" })}`;
    return { label: `Week ${index + 1}`, range, pnl, trades: weekTrades.reduce((total, trade) => total + trade.trades, 0) };
  });
  const monthRange = `${new Date(year, month, 1).toLocaleString("en-US", { month: "short", day: "numeric" })} – ${new Date(year, month + 1, 0).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const shiftMonth = (amount: number) => {
    const next = new Date(year, month + amount, 1);
    setMonth(next.getMonth());
    setYear(next.getFullYear());
  };

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
          <button className="profile-button">
            <span className="avatar">A</span>
            <span className="profile-copy"><strong>Alex Morgan</strong><small>Free plan</small></span>
            <ChevronDown size={16} className="profile-chevron" />
          </button>
        </div>
      </aside>
      {menuOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

      <section className="main-content" id="dashboard">
        <header className="topbar">
          <div className="topbar-heading">
            <button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
            <div><div className="eyebrow">MONDAY, MARCH 31, 2025</div><h1>Good morning, Alex <span>✦</span></h1></div>
          </div>
          <div className="topbar-actions">
            <button className="button button-quiet" onClick={() => { setShowSearch(!showSearch); setQuery(""); }}><Search size={16} /> Search</button>
            <button className="button button-primary" onClick={() => document.getElementById("quick-journal")?.focus()}><Plus size={17} /> Log a trade</button>
          </div>
        </header>

        <div className={`search-row ${showSearch ? "search-row-open" : ""}`}>
          <label className="search-input"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pairs or journal notes..." aria-label="Search pairs or journal notes" /><button onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button></label>
          <span className="search-hint">{query ? `${filteredTrades.length} matching days` : "Try “EURUSD” or “patient”"}</span>
        </div>

        <div className="filter-row">
          <div className="period-filters" role="tablist" aria-label="Date range">
            {filters.map((filter) => <button key={filter} role="tab" aria-selected={activeFilter === filter} className={`filter-button ${activeFilter === filter ? "selected" : ""}`} onClick={() => setActiveFilter(filter)}>{filter}</button>)}
          </div>
          <button className="date-select" onClick={() => { setMonth(demoMonth.month); setYear(demoMonth.year); }}><CalendarDays size={15} /> {monthRange} <ChevronDown size={14} /></button>
        </div>

        <section className="metrics-grid" id="performance" aria-label="Trading performance">
          <MetricCard title="Net P&L" value={money(netPnl)} subtitle={<span className={netPnl >= 0 ? "text-profit" : "text-loss"}>{netPnl >= 0 ? "↗ Profit this month" : "↘ Loss this month"}</span>} icon={TrendingUp} color="#16c98d">
            <Sparkline values={[8, 15, 12, 23, 20, 32, 28, 30, 25, 33, 31, 34, 29]} color="#16c98d" />
          </MetricCard>
          <article className="metric-card emotion-card">
            <div className="metric-copy"><div className="metric-title">Emotion meter <Smile size={16} color="#f5a25d" /></div><div className="metric-value">74<span className="metric-unit">/ 100</span></div><div className="metric-subtitle">Mostly in control</div></div>
            <div className="emotion-visual"><EmotionChart /><div className="chart-caption"><span>Mar 1</span><span>Mar 31</span></div></div>
          </article>
          <article className="metric-card">
            <div className="metric-copy"><div className="metric-title">Trade win rate <TrendingUp size={16} color="#a58bfa" /></div><div className="metric-value">{winRate}%</div><div className="metric-subtitle">{winningTrades} winners out of {tradeCount} trades</div></div>
            <div className="donut-wrap"><div className="donut"><span>{winRate}%</span></div></div>
          </article>
          <MetricCard title="Trading days" value={`${filteredTrades.length}`} subtitle={`Across ${tradeCount} trades`} icon={Flame} color="#fa914d">
            <div className="streak-ring"><Flame size={21} /></div>
          </MetricCard>
        </section>

        <div className="dashboard-grid">
          <section className="calendar-panel panel" id="calendar">
            <div className="panel-header">
              <div><div className="eyebrow">YOUR ACTIVITY</div><h2>Trading calendar</h2></div>
              <div className="calendar-controls"><button className="icon-button" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ArrowLeft size={17} /></button><h3>{monthName}</h3><button className="icon-button" onClick={() => shiftMonth(1)} aria-label="Next month"><ArrowRight size={17} /></button></div>
            </div>
            <div className="weekday-row">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid">
              {calendarDays.map((date, index) => {
                const trade = date.currentMonth && month === demoMonth.month && year === demoMonth.year && visibleTradeDays.has(date.day) ? tradesByDay[date.day] : undefined;
                return <DayCell key={`${index}-${date.day}`} day={date.day} currentMonth={date.currentMonth} trade={trade} onSelect={setSelectedTrade} />;
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
                  <div className="week-data"><div><small><span className="tiny-icon purple">$</span> P&amp;L</small><strong className={week.pnl > 0 ? "text-profit" : week.pnl < 0 ? "text-loss" : "muted"}>{money(week.pnl)}</strong><span className={`week-status ${week.pnl > 0 ? "text-profit" : week.pnl < 0 ? "text-loss" : "muted"}`}>{week.pnl > 0 ? <ArrowUpRight size={13} /> : week.pnl < 0 ? <ArrowDownRight size={13} /> : null}{week.pnl > 0 ? "Profit" : week.pnl < 0 ? "Loss" : "No trades"}</span></div>
                    <div><small><span className="tiny-icon orange">▥</span> Trades</small><strong>{week.trades}</strong><span className="week-status muted">{week.trades === 1 ? "trade" : "trades"} executed</span></div></div>
                </article>)}
              </div>
              <button className="text-link">View all analytics <ArrowRight size={14} /></button>
            </section>
            <section className="insight-card">
              <div className="insight-heading"><div className="insight-icon"><Sparkles size={16} /></div><span>JOURNAL INSIGHT</span><span className="beta-tag">BETA</span></div>
              <p>You followed your plan on <strong>8 of 11 trading days</strong>. Your best days came after waiting for confirmation.</p>
              <button onClick={() => document.getElementById("quick-journal")?.focus()}>Add a reflection <ArrowRight size={14} /></button>
            </section>
          </aside>
        </div>

        <section className={`quick-log panel ${savedNote ? "has-saved-note" : ""}`} id="journal">
          <div><div className="eyebrow">END-OF-DAY REFLECTION</div><h2>How did you trade today?</h2><p>Capture what went well, what you learned, and how you felt.</p></div>
          <div className="quick-log-action"><input id="quick-journal" value={quickNote} onChange={(event) => setQuickNote(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && quickNote.trim()) { setSavedNote(quickNote.trim()); setQuickNote(""); } }} placeholder="Write a quick note..." aria-label="Quick journal note" /><button className="button button-primary" onClick={() => { if (quickNote.trim()) { setSavedNote(quickNote.trim()); setQuickNote(""); } else document.getElementById("quick-journal")?.focus(); }}><Plus size={16} /> Add note</button></div>
          {savedNote && <div className="saved-note" role="status"><span><strong>Saved reflection</strong>{savedNote}</span><button onClick={() => setSavedNote("")} aria-label="Dismiss saved note"><X size={15} /></button></div>}
        </section>
        <footer className="page-footer"><span>Made for the long game.</span><span>Demo data · March 2025</span></footer>
      </section>

      {selectedTrade && <div className="modal-backdrop" role="presentation" onClick={() => setSelectedTrade(null)}><section className="trade-modal panel" role="dialog" aria-modal="true" aria-labelledby="trade-modal-title" onClick={(event) => event.stopPropagation()}>
        <button className="icon-button modal-close" onClick={() => setSelectedTrade(null)} aria-label="Close trade details"><X size={18} /></button>
        <div className="eyebrow">MARCH {selectedTrade.day}, 2025</div><h2 id="trade-modal-title">Day reflection</h2>
        <div className={`modal-pnl ${selectedTrade.pnl > 0 ? "text-profit" : "text-loss"}`}>{selectedTrade.pnl > 0 ? "+" : "-"}${Math.abs(selectedTrade.pnl).toLocaleString()}<span> · {selectedTrade.trades} {selectedTrade.trades === 1 ? "trade" : "trades"}</span></div>
        <div className="pair-list">{selectedTrade.pairs.map((pair) => <span key={pair}>{pair}</span>)}</div><p className="trade-note">{selectedTrade.note}</p>
      </section></div>}
    </main>
  );
}
