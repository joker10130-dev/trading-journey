import { NextResponse } from "next/server";
import { AccountEmailError, getAccountEmailConfig, sendVerificationEmail } from "@/lib/account-email";
import { authLimitKey, checkAuthRateLimits } from "@/lib/auth-rate-limit";
import { apiError, hasSameOrigin, parseJson } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { emailRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return apiError(403, "INVALID_ORIGIN", "Request origin is not allowed.");
  const ipLimit = await checkAuthRateLimits(request, [
    { key: authLimitKey("verification-ip", "{ip}"), limit: 10, windowMs: 60 * 60_000 },
  ]);
  if (ipLimit) return ipLimit;
  const parsed = await parseJson(request, emailRequestSchema);
  if ("response" in parsed) return parsed.response;
  const accountLimit = await checkAuthRateLimits(request, [
    { key: authLimitKey("verification-account", parsed.data.email), limit: 3, windowMs: 60 * 60_000 },
  ]);
  if (accountLimit) return accountLimit;

  try {
    getAccountEmailConfig();
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (user && !user.emailVerifiedAt) await sendVerificationEmail(user);
    return NextResponse.json({ message: "If the account needs verification, a link will be sent to its email address." });
  } catch (error) {
    if (error instanceof AccountEmailError) return apiError(error.status, "EMAIL_DELIVERY_ERROR", error.message);
    throw error;
  }
}
