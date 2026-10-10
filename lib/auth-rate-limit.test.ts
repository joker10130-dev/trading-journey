import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  upsert: vi.fn<(args: { create: { keyHash: string } }) => Promise<{ count: number }>>(),
  cleanup: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    authRateLimit: { upsert: prismaMocks.upsert, deleteMany: prismaMocks.cleanup },
    accountToken: { deleteMany: prismaMocks.cleanup },
  },
}));

import { checkAuthRateLimits } from "@/lib/auth-rate-limit";

describe("authentication rate limiting", () => {
  const originalEnvironment = {
    authRateLimitSecret: process.env.AUTH_RATE_LIMIT_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    clientIpHeader: process.env.AUTH_CLIENT_IP_HEADER,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_RATE_LIMIT_SECRET = "";
    process.env.DATABASE_URL = "postgresql://test-secret@localhost/test";
    process.env.AUTH_CLIENT_IP_HEADER = "x-forwarded-for";
    prismaMocks.upsert.mockResolvedValue({ count: 1 });
    prismaMocks.cleanup.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    if (originalEnvironment.authRateLimitSecret === undefined) delete process.env.AUTH_RATE_LIMIT_SECRET;
    else process.env.AUTH_RATE_LIMIT_SECRET = originalEnvironment.authRateLimitSecret;
    if (originalEnvironment.databaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalEnvironment.databaseUrl;
    if (originalEnvironment.clientIpHeader === undefined) delete process.env.AUTH_CLIENT_IP_HEADER;
    else process.env.AUTH_CLIENT_IP_HEADER = originalEnvironment.clientIpHeader;
  });

  it("uses the database URL when the optional dedicated HMAC secret is empty", async () => {
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "192.0.2.1, 10.0.0.1" },
    });

    expect(await checkAuthRateLimits(request, [
      { key: "login-ip:{ip}", limit: 10, windowMs: 15 * 60_000 },
    ])).toBeNull();

    const args = prismaMocks.upsert.mock.calls[0][0];
    const expectedHash = createHmac("sha256", process.env.DATABASE_URL ?? "")
      .update("login-ip:192.0.2.1")
      .digest("hex");
    expect(args.create.keyHash).toBe(expectedHash);
    expect(args.create.keyHash).not.toContain("192.0.2.1");
  });

  it("returns 429 and a retry delay when a window counter exceeds its limit", async () => {
    prismaMocks.upsert.mockResolvedValue({ count: 3 });
    const request = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "192.0.2.1" },
    });

    const response = await checkAuthRateLimits(request, [
      { key: "login-ip:{ip}", limit: 2, windowMs: 60_000 },
    ]);

    expect(response?.status).toBe(429);
    expect(Number(response?.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
