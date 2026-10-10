import { hash } from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { authLimitKey, checkAuthRateLimits } from "@/lib/auth-rate-limit";
import { apiError, hasSameOrigin, parseJson } from "@/lib/api-response";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return apiError(403, "INVALID_ORIGIN", "Request origin is not allowed.");
  const ipLimit = await checkAuthRateLimits(request, [
    { key: authLimitKey("register-ip", "{ip}"), limit: 5, windowMs: 60 * 60_000 },
  ]);
  if (ipLimit) return ipLimit;
  const parsed = await parseJson(request, registerSchema);
  if ("response" in parsed) return parsed.response;
  const accountLimit = await checkAuthRateLimits(request, [
    { key: authLimitKey("register-account", parsed.data.email), limit: 3, windowMs: 60 * 60_000 },
  ]);
  if (accountLimit) return accountLimit;

  const passwordHash = await hash(parsed.data.password, 12);
  try {
    const user = await prisma.user.create({
      data: { email: parsed.data.email, name: parsed.data.name, passwordHash },
      select: { id: true, email: true, name: true },
    });
    const session = await createSession(user.id);
    const response = NextResponse.json({ user }, { status: 201 });
    response.cookies.set("tj_session", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: session.expiresAt,
    });
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError(409, "EMAIL_IN_USE", "An account with this email already exists.");
    }
    throw error;
  }
}
