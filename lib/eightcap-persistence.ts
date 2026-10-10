import type { EightcapOrder } from "@/lib/eightcap-csv";
import { prisma } from "@/lib/prisma";
import { reconstructEightcapPositions } from "@/lib/eightcap-reconstruction";

type PersistEightcapImportInput = {
  userId: string;
  accountId: string;
  filename: string;
  timezone: string;
  orders: EightcapOrder[];
};

function addMoney(left: string, right: string) {
  const toCents = (value: string) => {
    const negative = value.startsWith("-");
    const unsigned = negative ? value.slice(1) : value;
    const [whole, fraction = ""] = unsigned.split(".");
    const cents = BigInt(whole) * BigInt(100) + BigInt((fraction + "00").slice(0, 2));
    return negative ? -cents : cents;
  };
  const fromCents = (value: bigint) => {
    const negative = value < BigInt(0);
    const absolute = negative ? -value : value;
    const result = `${absolute / BigInt(100)}.${(absolute % BigInt(100)).toString().padStart(2, "0")}`;
    return negative ? `-${result}` : result;
  };
  return fromCents(toCents(left) + toCents(right));
}

function sumMoney(values: Array<string | null>): string {
  let total = "0.00";
  for (const value of values) {
    if (typeof value === "string") total = addMoney(total, value);
  }
  return total;
}

export async function persistEightcapImport(input: PersistEightcapImportInput) {
  const reconstructed = reconstructEightcapPositions(input.orders);
  const result = await prisma.$transaction(async (transaction) => {
    const account = await transaction.tradingAccount.findFirst({
      where: { id: input.accountId, userId: input.userId },
      select: { id: true, baseCurrency: true },
    });
    if (!account) return null;

    const brokerImport = await transaction.brokerImport.create({
      data: {
        userId: input.userId,
        accountId: input.accountId,
        source: "tradingview-eightcap",
        filename: input.filename,
        timezone: input.timezone,
        summaryJson: {
          totalRows: input.orders.length,
          filledRows: input.orders.filter((order) => order.status === "Filled").length,
          cancelledRows: input.orders.filter((order) => order.status === "Cancelled").length,
          rejectedRows: input.orders.filter((order) => order.status === "Rejected").length,
          positionCount: reconstructed.positions.length,
          reviewCount: reconstructed.positions.filter((position) => position.status === "needs_review").length,
          brokerNetPnl: sumMoney(reconstructed.positions.map((position) => position.status === "closed" ? position.netClosedPnl : null)),
          commissionTotal: sumMoney(reconstructed.positions.map((position) => position.commission)),
        },
      },
      select: { id: true },
    });
    const inserted = await transaction.importedOrder.createMany({
      data: input.orders.map((order) => ({
        userId: input.userId,
        accountId: input.accountId,
        importId: brokerImport.id,
        externalOrderId: order.orderId,
        positionId: order.positionId,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        status: order.status,
        qty: order.qty,
        filledQty: order.filledQty,
        limitPrice: order.limitPrice,
        stopPrice: order.stopPrice,
        avgFillPrice: order.avgFillPrice,
        commission: order.commission,
        closedPnl: order.closedPnl,
        netClosedPnl: order.netClosedPnl,
        updateTimeUtc: new Date(order.updateTimeUtc),
        rawJson: order.raw,
      })),
      skipDuplicates: true,
    });
    const eligiblePositions = reconstructed.positions.filter((position) =>
      position.direction && position.entryPrice && position.openedAt && position.entryQty !== "0");
    for (const position of eligiblePositions) {
      const entryPrice = position.entryPrice;
      const openedAt = position.openedAt;
      if (!entryPrice || !openedAt) continue;
      const brokerNetPnl = position.status === "closed" ? position.netClosedPnl : null;
      const importedNetPnl = position.status === "closed" ? brokerNetPnl : null;
      const brokerClosedPnl = position.orders.reduce((total, order) => addMoney(total, order.closedPnl ?? "0"), "0.00");
      await transaction.trade.upsert({
        where: {
          userId_externalId: {
            userId: input.userId,
            externalId: `eightcap:${input.accountId}:${position.positionId}`,
          },
        },
        create: {
          userId: input.userId,
          pair: position.symbol,
          side: position.direction === "LONG" ? "BUY" : "SELL",
          entryPrice,
          exitPrice: position.status === "closed" ? position.exitPrice : null,
          stopLoss: position.stopLossPrice,
          takeProfit: position.takeProfitPrice,
          lotSize: position.entryQty,
          pnl: importedNetPnl,
          currency: account.baseCurrency,
          strategyTag: "Eightcap import",
          externalId: `eightcap:${input.accountId}:${position.positionId}`,
          brokerImportId: brokerImport.id,
          sourcePositionId: position.positionId,
          sourceOrderIds: [...new Set(position.orders.map((order) => order.orderId))],
          brokerClosedPnl,
          brokerNetPnl,
          commission: position.commission,
          reconciliationDifference: "0.00",
          openedAt: new Date(openedAt),
          closedAt: position.status === "closed" && position.closedAt ? new Date(position.closedAt) : null,
        },
        update: {
          pair: position.symbol,
          side: position.direction === "LONG" ? "BUY" : "SELL",
          entryPrice,
          exitPrice: position.status === "closed" ? position.exitPrice : null,
          stopLoss: position.stopLossPrice,
          takeProfit: position.takeProfitPrice,
          lotSize: position.entryQty,
          pnl: importedNetPnl,
          currency: account.baseCurrency,
          brokerImportId: brokerImport.id,
          sourcePositionId: position.positionId,
          sourceOrderIds: [...new Set(position.orders.map((order) => order.orderId))],
          brokerClosedPnl,
          brokerNetPnl,
          commission: position.commission,
          reconciliationDifference: "0.00",
          openedAt: new Date(openedAt),
          closedAt: position.status === "closed" && position.closedAt ? new Date(position.closedAt) : null,
        },
      });
    }
    const brokerNetPnl = sumMoney(reconstructed.positions.map((position) => position.status === "closed" ? position.netClosedPnl : null));
    const importedNetPnl = sumMoney(reconstructed.positions.map((position) => position.status === "closed" && !position.issues.length ? position.netClosedPnl : null));
    return {
      importId: brokerImport.id,
      inserted: inserted.count,
      tradesLinked: eligiblePositions.length,
      brokerNetPnl,
      importedNetPnl,
      commissionTotal: sumMoney(reconstructed.positions.map((position) => position.commission)),
      reconciliationDifference: addMoney(importedNetPnl, `-${brokerNetPnl}`),
    };
  });

  return result;
}
