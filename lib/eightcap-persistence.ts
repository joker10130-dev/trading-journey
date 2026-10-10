import type { EightcapOrder } from "@/lib/eightcap-csv";
import { prisma } from "@/lib/prisma";

type PersistEightcapImportInput = {
  userId: string;
  accountId: string;
  filename: string;
  timezone: string;
  orders: EightcapOrder[];
};

export async function persistEightcapImport(input: PersistEightcapImportInput) {
  const result = await prisma.$transaction(async (transaction) => {
    const account = await transaction.tradingAccount.findFirst({
      where: { id: input.accountId, userId: input.userId },
      select: { id: true },
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
    return { importId: brokerImport.id, inserted: inserted.count };
  });

  return result;
}
