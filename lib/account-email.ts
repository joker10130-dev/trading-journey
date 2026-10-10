import { createHash, randomBytes } from "node:crypto";
import type { AccountTokenPurpose } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export class AccountEmailError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "AccountEmailError";
  }
}

export function getAccountEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  let baseUrl = process.env.APP_BASE_URL;
  if (!apiKey || !from) {
    throw new AccountEmailError("Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.", 503);
  }
  if (!baseUrl && process.env.NODE_ENV !== "production") baseUrl = "http://localhost:3000";
  if (!baseUrl) throw new AccountEmailError("Set APP_BASE_URL to the public HTTPS address of the application.", 503);

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new AccountEmailError("APP_BASE_URL must be a valid public URL.", 503);
  }
  if (parsedUrl.protocol !== "https:" && (process.env.NODE_ENV === "production" || parsedUrl.hostname !== "localhost")) {
    throw new AccountEmailError("APP_BASE_URL must use HTTPS outside local development.", 503);
  }
  return { apiKey, from, baseUrl: parsedUrl.origin };
}

export async function sendAccountEmail(to: string, subject: string, text: string) {
  const config = getAccountEmailConfig();
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: config.from, to: [to], subject, text }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new AccountEmailError("Email delivery timed out. Please try again.", 504);
    }
    if (error instanceof TypeError) throw new AccountEmailError("Email delivery is temporarily unavailable.", 502);
    throw error;
  }
  if (!response.ok) {
    throw new AccountEmailError("Email delivery is temporarily unavailable. Please try again.", 502);
  }
  return config.baseUrl;
}

export async function createAccountToken(userId: string, purpose: AccountTokenPurpose, ttlMs: number) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + ttlMs);
  await prisma.$transaction([
    prisma.accountToken.deleteMany({ where: { userId, purpose } }),
    prisma.accountToken.create({ data: { userId, tokenHash, purpose, expiresAt } }),
  ]);
  return { token, expiresAt, tokenHash };
}

export function hashAccountToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function sendVerificationEmail(user: { id: string; email: string }) {
  const config = getAccountEmailConfig();
  const { token } = await createAccountToken(user.id, "EMAIL_VERIFICATION", 24 * 60 * 60_000);
  await sendAccountEmail(
    user.email,
    "Verify your Trading Journal email",
    `Verify your account within 24 hours:\n\n${config.baseUrl}/verify-email?token=${encodeURIComponent(token)}\n\nIf you did not create this account, you can ignore this email.`,
  );
}

export async function sendPasswordResetEmail(user: { id: string; email: string }) {
  const config = getAccountEmailConfig();
  const { token } = await createAccountToken(user.id, "PASSWORD_RESET", 30 * 60_000);
  await sendAccountEmail(
    user.email,
    "Reset your Trading Journal password",
    `Reset your password within 30 minutes:\n\n${config.baseUrl}/reset-password?token=${encodeURIComponent(token)}\n\nIf you did not request a reset, you can ignore this email.`,
  );
}
