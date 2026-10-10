import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { apiError, hasSameOrigin } from "@/lib/api-response";
import { EightcapCsvError, parseEightcapOrderCsv } from "@/lib/eightcap-csv";
import { reconstructEightcapPositions } from "@/lib/eightcap-reconstruction";
import { getMaxCsvBytes } from "@/lib/csv-import";
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
  const accountId = formData.get("accountId");
  const timezone = formData.get("timezone");
  if (!(file instanceof File)) return apiError(400, "FILE_REQUIRED", "Choose a CSV file to preview.");
  if (typeof accountId !== "string" || !accountId.trim()) return apiError(400, "ACCOUNT_REQUIRED", "Choose a trading account.");
  if (file.size > getMaxCsvBytes()) return apiError(413, "FILE_TOO_LARGE", "CSV file must be 2 MB or smaller.");
  if (!file.name.toLowerCase().endsWith(".csv")) return apiError(415, "UNSUPPORTED_FILE", "Only .csv files are supported.");
  if (typeof timezone !== "string" || !timezone.trim()) return apiError(400, "TIMEZONE_REQUIRED", "Choose the source timezone.");
  const account = await prisma.tradingAccount.findFirst({ where: { id: accountId.trim(), userId: auth.user.id }, select: { id: true } });
  if (!account) return apiError(404, "ACCOUNT_NOT_FOUND", "Trading account was not found.");

  let parsed;
  try {
    parsed = parseEightcapOrderCsv(await file.text(), timezone);
  } catch (error) {
    if (error instanceof EightcapCsvError) return apiError(400, "INVALID_CSV", error.message);
    throw error;
  }
  if (parsed.errors.length) return apiError(400, "INVALID_CSV_ROWS", "CSV contains invalid rows.", parsed.errors);

  const reconstructed = reconstructEightcapPositions(parsed.rows);
  return NextResponse.json({
    filename: file.name,
    timezone,
    summary: parsed.summary,
    positions: reconstructed.positions.map((position) => ({
      positionId: position.positionId,
      symbol: position.symbol,
      direction: position.direction,
      entryQty: position.entryQty,
      entryPrice: position.entryPrice,
      exitQty: position.exitQty,
      exitPrice: position.exitPrice,
      netClosedPnl: position.netClosedPnl,
      status: position.status,
      issues: position.issues,
    })),
    exceptions: reconstructed.exceptions.map((exception) => ({
      rowNumber: exception.rowNumber,
      message: exception.message,
    })),
  });
}
