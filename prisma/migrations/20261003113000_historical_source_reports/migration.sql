-- Preserve the workbook as an immutable, traceable historical source without
-- turning its cells into operational charges or cash movements.
ALTER TABLE "ImportBatch"
  ADD COLUMN "declaredCutoff" DATE,
  ADD COLUMN "cutoffTimezone" TEXT,
  ADD COLUMN "sourceVersion" TEXT;

ALTER TABLE "ImportRow"
  ADD COLUMN "contentFingerprint" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "semanticKey" TEXT,
  ADD COLUMN "sourceKind" TEXT NOT NULL DEFAULT 'SOURCE_CONTEXT',
  ADD COLUMN "nominalPeriod" TEXT,
  ADD COLUMN "sourceData" JSONB,
  ADD COLUMN "firstCellReference" TEXT,
  ADD COLUMN "lastCellReference" TEXT,
  ADD COLUMN "isAggregate" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ImportRow"
SET "contentFingerprint" = "recordFingerprint"
WHERE "contentFingerprint" = '';

ALTER TABLE "ImportIssue"
  ADD COLUMN "evidence" TEXT,
  ADD COLUMN "proposal" TEXT,
  ADD COLUMN "decisionNeeded" TEXT;

CREATE TABLE "ImportSheet" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "physicalOrder" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "nominalPeriod" TEXT,
  "coverageStatus" TEXT NOT NULL DEFAULT 'DOCUMENTED',
  "rowCount" INTEGER NOT NULL,
  "columnCount" INTEGER NOT NULL,
  "declaredRange" TEXT,
  "blockYears" JSONB,
  "summary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ImportSheet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportCell" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "sheetName" TEXT NOT NULL,
  "cellReference" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "columnNumber" INTEGER NOT NULL,
  "valueType" TEXT NOT NULL,
  "literalValue" TEXT,
  "formula" TEXT,
  "cachedValue" TEXT,
  "displayValue" TEXT,
  "annotation" TEXT,
  "originalDate" TEXT,
  "numberFormat" TEXT,
  "styleEvidence" JSONB,
  "mappingVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ImportCell_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImportSheet_batchId_name_key" ON "ImportSheet"("batchId", "name");
CREATE INDEX "ImportSheet_batchId_physicalOrder_idx" ON "ImportSheet"("batchId", "physicalOrder");
CREATE INDEX "ImportSheet_batchId_nominalPeriod_idx" ON "ImportSheet"("batchId", "nominalPeriod");
CREATE UNIQUE INDEX "ImportCell_batchId_sheetName_cellReference_key" ON "ImportCell"("batchId", "sheetName", "cellReference");
CREATE INDEX "ImportCell_batchId_sheetName_rowNumber_idx" ON "ImportCell"("batchId", "sheetName", "rowNumber");
CREATE INDEX "ImportRow_batchId_contentFingerprint_idx" ON "ImportRow"("batchId", "contentFingerprint");
CREATE INDEX "ImportRow_batchId_semanticKey_idx" ON "ImportRow"("batchId", "semanticKey");

ALTER TABLE "ImportSheet"
  ADD CONSTRAINT "ImportSheet_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportCell"
  ADD CONSTRAINT "ImportCell_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
