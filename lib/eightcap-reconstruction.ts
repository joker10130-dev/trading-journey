import type { EightcapOrder } from "@/lib/eightcap-csv";

const decimalScale = BigInt("1000000000000");

export type PositionDirection = "LONG" | "SHORT";
export type ReconstructedPositionStatus = "open" | "closed" | "needs_review";

export type ReconstructionIssue = {
  message: string;
  rowNumbers: number[];
};

export type ReconstructedPosition = {
  positionId: string;
  symbol: string;
  direction: PositionDirection | null;
  entryQty: string;
  entryPrice: string | null;
  exitQty: string;
  exitPrice: string | null;
  stopLossPrice: string | null;
  takeProfitPrice: string | null;
  netClosedPnl: string | null;
  commission: string;
  openedAt: string | null;
  closedAt: string | null;
  status: ReconstructedPositionStatus;
  issues: ReconstructionIssue[];
  orders: EightcapOrder[];
};

export type ReconstructionException = {
  rowNumber: number;
  message: string;
  order: EightcapOrder;
};

export type ReconstructionResult = {
  positions: ReconstructedPosition[];
  exceptions: ReconstructionException[];
};

function toScaled(value: string) {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  if (fraction.length > 12) throw new Error(`Decimal value has more than 12 fractional digits: ${value}`);
  const scaled = BigInt(whole) * decimalScale + BigInt(fraction.padEnd(12, "0"));
  return negative ? -scaled : scaled;
}

function fromScaled(value: bigint) {
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  const whole = absolute / decimalScale;
  const fraction = (absolute % decimalScale).toString().padStart(12, "0").replace(/0+$/, "");
  const result = fraction ? `${whole}.${fraction}` : whole.toString();
  return negative ? `-${result}` : result;
}

function add(left: string, right: string) {
  return fromScaled(toScaled(left) + toScaled(right));
}

function compare(left: string, right: string) {
  const leftScaled = toScaled(left);
  const rightScaled = toScaled(right);
  return leftScaled < rightScaled ? -1 : leftScaled > rightScaled ? 1 : 0;
}

function weightedAverage(items: Array<{ value: string | null; quantity: string }>) {
  const valid = items.filter((item): item is { value: string; quantity: string } => item.value !== null);
  if (!valid.length) return null;
  const weightedTotal = valid.reduce(
    (total, item) => total + (toScaled(item.value) * toScaled(item.quantity)) / decimalScale,
    BigInt(0),
  );
  const quantityTotal = valid.reduce((total, item) => total + toScaled(item.quantity), BigInt(0));
  return quantityTotal === BigInt(0) ? null : fromScaled((weightedTotal * decimalScale) / quantityTotal);
}

function sum(items: Array<string | null>) {
  const valid = items.filter((item): item is string => item !== null);
  return valid.length ? valid.reduce((total, item) => add(total, item), "0") : null;
}

function createIssue(message: string, orders: EightcapOrder[]): ReconstructionIssue {
  return { message, rowNumbers: orders.map((order) => order.rowNumber) };
}

function reconstructGroup(positionId: string, orders: EightcapOrder[]): ReconstructedPosition {
  const activeOrders = orders.filter((order) => order.status === "Filled" && compare(order.filledQty, "0") > 0);
  const entryOrders = activeOrders.filter((order) => order.type === "Market" || order.type === "Limit");
  const exitOrders = activeOrders.filter((order) => order.type === "Stop Loss" || order.type === "Take Profit");
  const issues: ReconstructionIssue[] = [];

  if (!entryOrders.length) issues.push(createIssue("No filled Market or Limit entry order was found.", orders));
  const symbols = new Set(orders.map((order) => order.symbol));
  if (symbols.size > 1) issues.push(createIssue("A position contains multiple symbols.", orders));

  const entrySides = new Set(entryOrders.map((order) => order.side));
  const direction = entrySides.size === 1
    ? (entryOrders[0].side === "Buy" ? "LONG" : "SHORT")
    : null;
  if (entrySides.size > 1) issues.push(createIssue("Entry orders contain both Buy and Sell sides.", entryOrders));

  const expectedExitSide = direction === "LONG" ? "Sell" : direction === "SHORT" ? "Buy" : null;
  const invalidExits = expectedExitSide ? exitOrders.filter((order) => order.side !== expectedExitSide) : [];
  if (invalidExits.length) issues.push(createIssue("Exit order side does not match the position direction.", invalidExits));

  const entryQty = sum(entryOrders.map((order) => order.filledQty)) ?? "0";
  const exitQty = sum(exitOrders.map((order) => order.filledQty)) ?? "0";
  if (compare(exitQty, entryQty) > 0) issues.push(createIssue("Exit quantity is greater than entry quantity.", exitOrders));

  const openedAt = entryOrders.length
    ? entryOrders.reduce((earliest, order) => order.updateTimeUtc < earliest ? order.updateTimeUtc : earliest, entryOrders[0].updateTimeUtc)
    : null;
  const closedAt = exitOrders.length
    ? exitOrders.reduce((latest, order) => order.updateTimeUtc > latest ? order.updateTimeUtc : latest, exitOrders[0].updateTimeUtc)
    : null;
  const netClosedPnl = sum(exitOrders.map((order) => order.netClosedPnl ?? order.closedPnl));
  const commission = sum(orders.map((order) => order.commission)) ?? "0";
  const stopLossOrders = orders.filter((order) => order.type === "Stop Loss");
  const takeProfitOrders = orders.filter((order) => order.type === "Take Profit");
  const status: ReconstructedPositionStatus = issues.length
    ? "needs_review"
    : compare(exitQty, entryQty) === 0
      ? "closed"
      : "open";

  return {
    positionId,
    symbol: [...symbols][0] ?? "",
    direction,
    entryQty,
    entryPrice: weightedAverage(entryOrders.map((order) => ({ value: order.avgFillPrice, quantity: order.filledQty }))),
    exitQty,
    exitPrice: weightedAverage(exitOrders.map((order) => ({ value: order.avgFillPrice, quantity: order.filledQty }))),
    stopLossPrice: stopLossOrders.find((order) => order.stopPrice)?.stopPrice ?? null,
    takeProfitPrice: takeProfitOrders.find((order) => order.limitPrice)?.limitPrice ?? null,
    netClosedPnl,
    commission,
    openedAt,
    closedAt,
    status,
    issues,
    orders,
  };
}

export function reconstructEightcapPositions(orders: EightcapOrder[]): ReconstructionResult {
  const groups = new Map<string, EightcapOrder[]>();
  const exceptions: ReconstructionException[] = [];
  for (const order of orders) {
    if (!order.positionId) {
      exceptions.push({ rowNumber: order.rowNumber, message: "Order has no Position ID.", order });
      continue;
    }
    const group = groups.get(order.positionId) ?? [];
    group.push(order);
    groups.set(order.positionId, group);
  }

  return {
    positions: [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([positionId, positionOrders]) => reconstructGroup(positionId, positionOrders)),
    exceptions,
  };
}
