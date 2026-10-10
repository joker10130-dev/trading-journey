import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DayCell, EquityCurve } from "@/app/dashboard/_components/dashboard-visualizations";
import type { TradeDay } from "@/app/dashboard/_lib/dashboard-types";

describe("Dashboard visualizations", () => {
  it("renders a trade day with its P&L and trade count", () => {
    const trade: TradeDay = {
      date: "2025-01-15",
      day: 15,
      pnl: 12.5,
      trades: 1,
      winningTrades: 1,
      pairs: ["EURUSD"],
      note: "",
      emotionScore: null,
    };
    const markup = renderToStaticMarkup(createElement(DayCell, {
      day: 15,
      currentMonth: true,
      trade,
      currency: "USD",
      onSelect: vi.fn(),
    }));

    expect(markup).toMatch(/class="day-cell\s+positive"/);
    expect(markup).toContain('aria-label="15, $12.50, 1 trades"');
    expect(markup).toContain("+$12.50");
    expect(markup).toContain("1 trade</small>");
  });

  it("disables calendar days without a trade", () => {
    const markup = renderToStaticMarkup(createElement(DayCell, {
      day: 8,
      currentMonth: false,
      currency: "USD",
      onSelect: vi.fn(),
    }));

    expect(markup).toMatch(/class="day-cell outside-month\s*"/);
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-label="8"');
  });

  it("shows an empty-state label when there is no equity data", () => {
    const markup = renderToStaticMarkup(createElement(EquityCurve, { dailyData: [] }));

    expect(markup).toContain('aria-label="Equity curve"');
    expect(markup).toContain("No trades yet");
  });
});
