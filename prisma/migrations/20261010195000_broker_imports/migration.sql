CREATE TABLE "TradingAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "baseCurrency" CHAR(3) NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TradingAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrokerImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "source" VARCHAR(80) NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "timezone" VARCHAR(80) NOT NULL,
    "summaryJson" JSONB,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BrokerImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportedOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "externalOrderId" VARCHAR(160) NOT NULL,
    "positionId" VARCHAR(160),
    "symbol" VARCHAR(32) NOT NULL,
    "side" VARCHAR(16) NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "qty" DECIMAL(12,4) NOT NULL,
    "filledQty" DECIMAL(12,4) NOT NULL,
    "limitPrice" DECIMAL(18,8),
    "stopPrice" DECIMAL(18,8),
    "avgFillPrice" DECIMAL(18,8),
    "commission" DECIMAL(18,2),
    "closedPnl" DECIMAL(18,2),
    "netClosedPnl" DECIMAL(18,2),
    "updateTimeUtc" TIMESTAMP(3) NOT NULL,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportedOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TradingAccount_userId_name_key" ON "TradingAccount"("userId", "name");
CREATE INDEX "TradingAccount_userId_idx" ON "TradingAccount"("userId");
CREATE INDEX "BrokerImport_userId_importedAt_idx" ON "BrokerImport"("userId", "importedAt");
CREATE INDEX "BrokerImport_accountId_importedAt_idx" ON "BrokerImport"("accountId", "importedAt");
CREATE UNIQUE INDEX "ImportedOrder_accountId_externalOrderId_key" ON "ImportedOrder"("accountId", "externalOrderId");
CREATE INDEX "ImportedOrder_userId_updateTimeUtc_idx" ON "ImportedOrder"("userId", "updateTimeUtc");
CREATE INDEX "ImportedOrder_accountId_positionId_idx" ON "ImportedOrder"("accountId", "positionId");
CREATE INDEX "ImportedOrder_importId_idx" ON "ImportedOrder"("importId");

ALTER TABLE "TradingAccount"
ADD CONSTRAINT "TradingAccount_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrokerImport"
ADD CONSTRAINT "BrokerImport_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrokerImport"
ADD CONSTRAINT "BrokerImport_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportedOrder"
ADD CONSTRAINT "ImportedOrder_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportedOrder"
ADD CONSTRAINT "ImportedOrder_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportedOrder"
ADD CONSTRAINT "ImportedOrder_importId_fkey"
FOREIGN KEY ("importId") REFERENCES "BrokerImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
