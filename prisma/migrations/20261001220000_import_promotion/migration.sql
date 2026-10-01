-- CreateEnum
CREATE TYPE "ImportPromotionStatus" AS ENUM ('PREVIEWED', 'PROMOTING', 'PROMOTED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "Member" ADD COLUMN "sourceReference" TEXT;

-- AlterTable
ALTER TABLE "SectionAssignment" ADD COLUMN "sourceReference" TEXT;

-- AlterTable
ALTER TABLE "PaymentPart"
  ALTER COLUMN "movementId" DROP NOT NULL,
  ADD COLUMN "isLegacy" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cashEffect" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "receivedAt" TIMESTAMP(3),
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "sourceReference" TEXT;

-- AlterTable
ALTER TABLE "Allocation"
  ALTER COLUMN "appliedAt" DROP NOT NULL,
  ALTER COLUMN "appliedAt" DROP DEFAULT,
  ADD COLUMN "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ImportBatch"
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "mappingVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "mappingHash" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ImportRow"
  ADD COLUMN "transformationHash" TEXT,
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "ImportPromotion" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "mappingVersion" INTEGER NOT NULL,
    "mappingHash" TEXT NOT NULL,
    "status" "ImportPromotionStatus" NOT NULL DEFAULT 'PREVIEWED',
    "preview" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promotedAt" TIMESTAMP(3),

    CONSTRAINT "ImportPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportPublication" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_sourceReference_key" ON "Member"("sourceReference");
CREATE UNIQUE INDEX "SectionAssignment_sourceReference_key" ON "SectionAssignment"("sourceReference");
CREATE UNIQUE INDEX "PaymentPart_sourceReference_key" ON "PaymentPart"("sourceReference");
CREATE UNIQUE INDEX "ImportPromotion_idempotencyKey_key" ON "ImportPromotion"("idempotencyKey");
CREATE UNIQUE INDEX "ImportPromotion_batchId_scope_mappingHash_key" ON "ImportPromotion"("batchId", "scope", "mappingHash");
CREATE INDEX "ImportPromotion_batchId_status_idx" ON "ImportPromotion"("batchId", "status");
CREATE UNIQUE INDEX "ImportPublication_dedupeKey_key" ON "ImportPublication"("dedupeKey");
CREATE UNIQUE INDEX "ImportPublication_rowId_targetType_targetId_key" ON "ImportPublication"("rowId", "targetType", "targetId");
CREATE INDEX "ImportPublication_promotionId_idx" ON "ImportPublication"("promotionId");

-- AddForeignKey
ALTER TABLE "ImportPromotion" ADD CONSTRAINT "ImportPromotion_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportPublication" ADD CONSTRAINT "ImportPublication_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "ImportPromotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportPublication" ADD CONSTRAINT "ImportPublication_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "ImportRow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
