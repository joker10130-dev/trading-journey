import { NextResponse } from "next/server";
import { apiError, hasSameOrigin } from "@/lib/api-response";
import { clearSessionCookie, revokeCurrentSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return apiError(403, "INVALID_ORIGIN", "Request origin is not allowed.");
  await revokeCurrentSession();
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
