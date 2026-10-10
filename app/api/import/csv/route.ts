import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { apiError, hasSameOrigin } from "@/lib/api-response";
import { CsvImportError, getMaxCsvBytes, isEightcapOrderHistoryCsv, parseTradeCsv } from "@/lib/csv-import";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return apiError(403, "INVALID_ORIGIN", "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    if (error instanceof TypeError || error instanceof SyntaxError) {
      return apiError(400, "INVALID_FORM_DATA", "Request must contain a valid CSV file upload.");
    }
    throw error;
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return apiError(400, "FILE_REQUIRED", "Choose a CSV file to import.");
  if (file.size > getMaxCsvBytes()) return apiError(413, "FILE_TOO_LARGE", "CSV file must be 2 MB or smaller.");
  if (!file.name.toLowerCase().endsWith(".csv")) return apiError(415, "UNSUPPORTED_FILE", "Only .csv files are supported.");

  const csvText = await file.text();
  if (isEightcapOrderHistoryCsv(csvText)) {
    return apiError(
      422,
      "EIGHTCAP_IMPORT_REQUIRES_PREVIEW",
      "This is a TradingView/Eightcap order-history export. The generic trade CSV importer does not support order reconstruction yet.",
    );
  }

  let rows;
  try {
    rows = parseTradeCsv(csvText);
  } catch (error) {
    if (error instanceof CsvImportError) {
      return apiError(400, "INVALID_CSV", error.message, error.row ? { row: error.row } : undefined);
    }
    throw error;
  }

  const userId = auth.user.id;
  const result = await prisma.trade.createMany({
    data: rows.map((trade) => ({
        userId,
        pair: trade.pair,
        side: trade.side,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice ?? null,
        stopLoss: trade.stopLoss ?? null,
        takeProfit: trade.takeProfit ?? null,
        lotSize: trade.lotSize,
        pnl: trade.pnl ?? null,
        currency: trade.currency,
        strategyTag: trade.strategyTag ?? null,
        externalId: trade.externalId,
        openedAt: new Date(trade.openedAt),
        closedAt: trade.closedAt ? new Date(trade.closedAt) : null,
      })),
    skipDuplicates: true,
  });
  return NextResponse.json({
    imported: result.count,
    duplicates: rows.length - result.count,
    totalRows: rows.length,
  }, { status: 201 });
}
