import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { apiError, hasSameOrigin } from "@/lib/api-response";
import { parseEightcapOrderCsv, EightcapCsvError } from "@/lib/eightcap-csv";
import { persistEightcapImport } from "@/lib/eightcap-persistence";
import { getMaxCsvBytes } from "@/lib/csv-import";

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
  if (!(file instanceof File)) return apiError(400, "FILE_REQUIRED", "Choose a CSV file to import.");
  if (file.size > getMaxCsvBytes()) return apiError(413, "FILE_TOO_LARGE", "CSV file must be 2 MB or smaller.");
  if (!file.name.toLowerCase().endsWith(".csv")) return apiError(415, "UNSUPPORTED_FILE", "Only .csv files are supported.");
  if (typeof accountId !== "string" || !accountId.trim()) return apiError(400, "ACCOUNT_REQUIRED", "Choose a trading account.");
  if (typeof timezone !== "string" || !timezone.trim()) return apiError(400, "TIMEZONE_REQUIRED", "Choose the source timezone.");

  let parsed;
  try {
    parsed = parseEightcapOrderCsv(await file.text(), timezone);
  } catch (error) {
    if (error instanceof EightcapCsvError) return apiError(400, "INVALID_CSV", error.message);
    throw error;
  }
  if (parsed.errors.length) {
    return apiError(400, "INVALID_CSV_ROWS", "CSV contains invalid rows.", parsed.errors);
  }

  const result = await persistEightcapImport({
    userId: auth.user.id,
    accountId: accountId.trim(),
    filename: file.name,
    timezone,
    orders: parsed.rows,
  });
  if (!result) return apiError(404, "ACCOUNT_NOT_FOUND", "Trading account was not found.");

  return NextResponse.json({
    importId: result.importId,
    importedOrders: result.inserted,
    linkedTrades: result.tradesLinked,
    duplicates: parsed.rows.length - result.inserted,
    summary: parsed.summary,
    reconciliation: {
      brokerNetPnl: result.brokerNetPnl,
      importedNetPnl: result.importedNetPnl,
      commissionTotal: result.commissionTotal,
      difference: result.reconciliationDifference,
    },
  }, { status: 201 });
}
