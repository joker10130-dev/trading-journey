import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type AuthRateLimit = {
  key: string;
  limit: number;
  windowMs: number;
};

let lastCleanupAt = 0;

function hashKey(value: string) {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET?.trim() || process.env.DATABASE_URL;
  if (!secret) throw new Error("Set AUTH_RATE_LIMIT_SECRET or DATABASE_URL to enable authentication rate limiting.");
  return createHmac("sha256", secret).update(value).digest("hex");
}

function getClientIp(request: Request) {
  const header = process.env.AUTH_CLIENT_IP_HEADER || "x-forwarded-for";
  if (!/^[a-z0-9-]+$/i.test(header)) throw new Error("AUTH_CLIENT_IP_HEADER must be a valid HTTP header name.");
  const forwarded = request.headers.get(header);
  const candidate = forwarded?.split(",")[0]?.trim();
  if (!candidate) return "unknown";
  return isIP(candidate) ? candidate : "unknown";
}

async function consumeLimit(key: string, limit: number, windowMs: number, now: Date) {
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs * 2);
  const keyHash = hashKey(key);
  const result = await prisma.authRateLimit.upsert({
    where: { keyHash_windowStart: { keyHash, windowStart } },
    create: { keyHash, windowStart, expiresAt, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return {
    exceeded: result.count > limit,
    retryAfterSeconds: Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000)),
  };
}

export async function checkAuthRateLimits(request: Request, limits: AuthRateLimit[]) {
  const now = new Date();
  if (now.getTime() - lastCleanupAt > 10 * 60_000) {
    await prisma.authRateLimit.deleteMany({ where: { expiresAt: { lte: now } } });
    await prisma.accountToken.deleteMany({ where: { expiresAt: { lte: now } } });
    lastCleanupAt = now.getTime();
  }

  const ip = getClientIp(request);
  const results = await Promise.all(limits.map((item) => consumeLimit(item.key.replace("{ip}", ip), item.limit, item.windowMs, now)));
  const exceeded = results.filter((result) => result.exceeded);
  if (!exceeded.length) return null;

  const retryAfter = Math.max(...exceeded.map((result) => result.retryAfterSeconds));
  return NextResponse.json(
    { error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export function authLimitKey(scope: string, value: string) {
  return `${scope}:${value}`;
}
