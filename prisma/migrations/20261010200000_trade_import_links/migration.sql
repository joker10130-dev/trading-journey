ALTER TABLE "Trade"
ADD COLUMN "brokerImportId" TEXT,
ADD COLUMN "sourcePositionId" VARCHAR(160),
ADD COLUMN "sourceOrderIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "brokerClosedPnl" DECIMAL(18,2),
ADD COLUMN "brokerNetPnl" DECIMAL(18,2),
ADD COLUMN "commission" DECIMAL(18,2),
ADD COLUMN "reconciliationDifference" DECIMAL(18,2);

CREATE UNIQUE INDEX "Trade_brokerImportId_sourcePositionId_key"
ON "Trade"("brokerImportId", "sourcePositionId");
CREATE INDEX "Trade_brokerImportId_idx" ON "Trade"("brokerImportId");

ALTER TABLE "Trade"
ADD CONSTRAINT "Trade_brokerImportId_fkey"
FOREIGN KEY ("brokerImportId") REFERENCES "BrokerImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
