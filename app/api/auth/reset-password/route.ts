import { hash } from "bcryptjs";
import { AccountTokenPurpose } from "@/generated/prisma/client";
import { hashAccountToken } from "@/lib/account-email";
import { authLimitKey, checkAuthRateLimits } from "@/lib/auth-rate-limit";
import { apiError, hasSameOrigin, parseJson } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { passwordResetSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return apiError(403, "INVALID_ORIGIN", "Request origin is not allowed.");
  const ipLimit = await checkAuthRateLimits(request, [
    { key: authLimitKey("reset-password-ip", "{ip}"), limit: 20, windowMs: 60 * 60_000 },
  ]);
  if (ipLimit) return ipLimit;
  const parsed = await parseJson(request, passwordResetSchema);
  if ("response" in parsed) return parsed.response;
  const tokenHash = hashAccountToken(parsed.data.token);
  const tokenLimit = await checkAuthRateLimits(request, [
    { key: authLimitKey("reset-password-token", tokenHash), limit: 5, windowMs: 60 * 60_000 },
  ]);
  if (tokenLimit) return tokenLimit;

  const token = await prisma.accountToken.findFirst({
    where: { tokenHash, purpose: AccountTokenPurpose.PASSWORD_RESET, expiresAt: { gt: new Date() } },
    select: { id: true, userId: true },
  });
  if (!token) return apiError(400, "INVALID_OR_EXPIRED_TOKEN", "This password-reset link is invalid or has expired.");

  const passwordHash = await hash(parsed.data.password, 12);
  const updated = await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.accountToken.deleteMany({
      where: { id: token.id, expiresAt: { gt: new Date() } },
    });
    if (consumed.count !== 1) return false;
    await transaction.user.update({ where: { id: token.userId }, data: { passwordHash } });
    await transaction.session.deleteMany({ where: { userId: token.userId } });
    await transaction.accountToken.deleteMany({ where: { userId: token.userId } });
    return true;
  });
  if (!updated) return apiError(400, "INVALID_OR_EXPIRED_TOKEN", "This password-reset link is invalid or has expired.");
  return Response.json({ passwordReset: true, message: "Password updated. Sign in with your new password." });
}
