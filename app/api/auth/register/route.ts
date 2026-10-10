import { hash } from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { AccountEmailError, getAccountEmailConfig, sendVerificationEmail } from "@/lib/account-email";
import { authLimitKey, checkAuthRateLimits } from "@/lib/auth-rate-limit";
import { apiError, hasSameOrigin, parseJson } from "@/lib/api-response";
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

  try {
    getAccountEmailConfig();
  } catch (error) {
    if (error instanceof AccountEmailError) return apiError(error.status, "EMAIL_NOT_CONFIGURED", error.message);
    throw error;
  }

  const passwordHash = await hash(parsed.data.password, 12);
  try {
    const user = await prisma.user.create({
      data: { email: parsed.data.email, name: parsed.data.name, passwordHash },
      select: { id: true, email: true, name: true },
    });
    await sendVerificationEmail(user);
    return NextResponse.json({
      verificationRequired: true,
      message: "Account created. Check your email for a verification link before signing in.",
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError(409, "EMAIL_IN_USE", "An account with this email already exists.");
    }
    if (error instanceof AccountEmailError) {
      return apiError(error.status, "VERIFICATION_EMAIL_FAILED", "Your account was created, but the verification email could not be sent. Request a new verification email and try again.");
    }
    throw error;
  }
}
