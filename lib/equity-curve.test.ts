import { describe, expect, it } from "vitest";
import { buildEquityCurve } from "@/lib/equity-curve";

describe("buildEquityCurve", () => {
  it("anchors a losing curve and its fill to the zero line", () => {
    const curve = buildEquityCurve([{ pnl: -3 }, { pnl: -4 }]);

    expect(curve).toEqual({
      points: "0,10 250,70 500,150",
      areaPoints: "0,10 0,10 250,70 500,150 500,10",
      zeroY: 10,
      minEquity: -7,
      maxEquity: 0,
      endingEquity: -7,
      isNegative: true,
    });
  });

  it("maps gains and losses around the same zero baseline", () => {
    const curve = buildEquityCurve([{ pnl: 4 }, { pnl: -8 }]);

    expect(curve).toEqual({
      points: "0,80 250,10 500,150",
      areaPoints: "0,80 0,80 250,10 500,150 500,80",
      zeroY: 80,
      minEquity: -4,
      maxEquity: 4,
      endingEquity: -4,
      isNegative: true,
    });
  });

  it("includes an initial zero point so a single-day curve remains visible", () => {
    const curve = buildEquityCurve([{ pnl: 5 }]);

    expect(curve?.points).toBe("0,150 500,10");
    expect(curve?.zeroY).toBe(150);
    expect(curve?.minEquity).toBe(0);
    expect(curve?.maxEquity).toBe(5);
    expect(curve?.endingEquity).toBe(5);
  });

  it("returns no geometry when there is no daily P&L", () => {
    expect(buildEquityCurve([])).toBeNull();
  });
});
