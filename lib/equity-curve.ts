type DailyPnl = { pnl: number };

const chartWidth = 500;
const chartTop = 10;
const chartBaseline = 150;
const chartHeight = chartBaseline - chartTop;

export function buildEquityCurve(dailyData: DailyPnl[]) {
  if (dailyData.length === 0) return null;

  const equityValues = [0];
  for (const day of dailyData) {
    equityValues.push(equityValues[equityValues.length - 1] + day.pnl);
  }

  const minEquity = Math.min(...equityValues);
  const maxEquity = Math.max(...equityValues);
  const range = Math.max(maxEquity - minEquity, 1);
  const yFor = (equity: number) =>
    chartBaseline - ((equity - minEquity) / range) * chartHeight;
  const points = equityValues.map((equity, index) => {
    const x = (index / dailyData.length) * chartWidth;
    return `${x},${yFor(equity)}`;
  }).join(" ");
  const zeroY = yFor(0);

  return {
    points,
    areaPoints: `0,${zeroY} ${points} ${chartWidth},${zeroY}`,
    zeroY,
    isNegative: equityValues[equityValues.length - 1] < 0,
  };
}
