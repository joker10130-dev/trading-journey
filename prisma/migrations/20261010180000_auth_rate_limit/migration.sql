CREATE TABLE "AuthRateLimit" (
    "keyHash" CHAR(64) NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthRateLimit_pkey" PRIMARY KEY ("keyHash", "windowStart")
);

CREATE INDEX "AuthRateLimit_expiresAt_idx" ON "AuthRateLimit"("expiresAt");
