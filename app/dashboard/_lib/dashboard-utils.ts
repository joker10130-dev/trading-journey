export const todayUtc = () => new Date().toISOString().slice(0, 10);
export const monthStart = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
export const monthEnd = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);

export const money = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

export function getCalendarDays(year: number, month: number) {
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
