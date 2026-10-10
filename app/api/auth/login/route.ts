import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { apiError, hasSameOrigin, parseJson } from "@/lib/api-response";
import { authLimitKey, checkAuthRateLimits } from "@/lib/auth-rate-limit";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return apiError(403, "INVALID_ORIGIN", "Request origin is not allowed.");
  const ipLimit = await checkAuthRateLimits(request, [
    { key: authLimitKey("login-ip", "{ip}"), limit: 30, windowMs: 15 * 60_000 },
  ]);
  if (ipLimit) return ipLimit;
  const parsed = await parseJson(request, loginSchema);
  if ("response" in parsed) return parsed.response;
  const accountLimit = await checkAuthRateLimits(request, [
    { key: authLimitKey("login-account", parsed.data.email), limit: 10, windowMs: 15 * 60_000 },
  ]);
  if (accountLimit) return accountLimit;

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
  if (!user || !(await compare(parsed.data.password, user.passwordHash))) {
    return apiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const session = await createSession(user.id);
  const response = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  });
  response.cookies.set("tj_session", session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: session.expiresAt,
  });
  return response;
}
