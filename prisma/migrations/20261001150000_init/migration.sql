-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('SUPERADMIN', 'ADMIN', 'TESORERIA', 'DIRECTORA', 'JEFE_DE_CUERDA', 'MIEMBRO');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'PAUSED', 'RETIRED', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('JOIN', 'PAUSE', 'REENTRY', 'RETIREMENT', 'SECTION_CHANGE', 'PARKING_START', 'PARKING_END', 'EXEMPTION', 'CORRECTION', 'OPERATIONAL_NOTE');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'VOIDED', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('PAYMENT', 'EXPENSE', 'INTEREST', 'INTERNAL_TRANSFER', 'OPENING_BALANCE', 'REVERSAL');

-- CreateEnum
CREATE TYPE "MovementDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "MovementStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REVERSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('RECEIVED', 'EXTRACTION_PENDING', 'REVIEW_REQUIRED', 'READY', 'CONFIRMED', 'POSSIBLE_DUPLICATE', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('STAGING', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED', 'CANCELLED', 'NOT_SUMMONED');

-- CreateEnum
CREATE TYPE "RehearsalStatus" AS ENUM ('SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AppRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSectionScope" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSectionScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceSection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "originalName" TEXT,
    "normalizedName" TEXT NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "currentSectionId" TEXT,
    "authUserId" TEXT,
    "joinedOn" DATE,
    "leftOn" DATE,
    "parkingReviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionAssignment" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipIncident" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "effectiveOn" DATE,
    "economicPeriod" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "publicNote" TEXT,
    "privateReason" TEXT,
    "proposedChange" JSONB,
    "simulation" JSONB,
    "authorId" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingConcept" (
    "id" TEXT NOT NULL,
    "systemKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultAmountCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "restrictedCredit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeRule" (
    "id" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "startsPeriod" TEXT NOT NULL,
    "endsPeriod" TEXT,
    "amountCents" INTEGER NOT NULL,
    "excludeJanuary" BOOLEAN NOT NULL DEFAULT false,
    "eligibility" TEXT NOT NULL DEFAULT 'ACTIVE_MEMBER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChargeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeException" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "memberId" TEXT,
    "period" TEXT NOT NULL,
    "chargeable" BOOLEAN NOT NULL,
    "amountCents" INTEGER,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChargeException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "ruleId" TEXT,
    "activityId" TEXT,
    "period" TEXT NOT NULL,
    "dueOn" DATE,
    "amountCents" INTEGER NOT NULL,
    "status" "ChargeStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceReference" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeAdjustment" (
    "id" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChargeAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyMovement" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "accountId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "direction" "MovementDirection" NOT NULL,
    "status" "MovementStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "occurredAt" TIMESTAMP(3),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "externalReference" TEXT,
    "bankReferenceKey" TEXT,
    "transferGroupId" TEXT,
    "cashEffect" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "reversalOfId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,

    CONSTRAINT "MoneyMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPart" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "paymentPartId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "isLegacy" BOOLEAN NOT NULL DEFAULT false,
    "cashEffect" BOOLEAN NOT NULL DEFAULT true,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "movementId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationBatch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "ReconciliationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationCandidate" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'RECEIVED',
    "direction" "MovementDirection",
    "amountCents" INTEGER,
    "currency" TEXT,
    "occurredAt" TIMESTAMP(3),
    "externalReference" TEXT,
    "payerName" TEXT,
    "destinationMasked" TEXT,
    "extraction" JSONB,
    "reviewNote" TEXT,
    "movementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateAttachment" (
    "candidateId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,

    CONSTRAINT "CandidateAttachment_pkey" PRIMARY KEY ("candidateId","attachmentId")
);

-- CreateTable
CREATE TABLE "PayerAlias" (
    "id" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "originalValue" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayerAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startsOn" DATE,
    "endsOn" DATE,
    "participantAmountCents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityParticipant" (
    "activityId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "ActivityParticipant_pkey" PRIMARY KEY ("activityId","memberId")
);

-- CreateTable
CREATE TABLE "ActivityExpense" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,

    CONSTRAINT "ActivityExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rehearsal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "checkInOpensAt" TIMESTAMP(3) NOT NULL,
    "checkInClosesAt" TIMESTAMP(3) NOT NULL,
    "lateAfterMinutes" INTEGER NOT NULL DEFAULT 15,
    "tokenTtlSeconds" INTEGER NOT NULL DEFAULT 60,
    "status" "RehearsalStatus" NOT NULL DEFAULT 'SCHEDULED',
    "recurrenceKey" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rehearsal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RehearsalInvitee" (
    "rehearsalId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RehearsalInvitee_pkey" PRIMARY KEY ("rehearsalId","memberId")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "rehearsalId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'STAGING',
    "sheetCount" INTEGER NOT NULL,
    "importedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "summary" JSONB,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "cellReference" TEXT,
    "rawText" TEXT,
    "recordFingerprint" TEXT NOT NULL,
    "proposedType" TEXT,
    "transformed" JSONB,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportIssue" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sheetName" TEXT,
    "cellReference" TEXT,
    "message" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "memberId" TEXT,
    "role" "AppRole" NOT NULL DEFAULT 'MIEMBRO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "resultId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE INDEX "UserRole_role_idx" ON "UserRole"("role");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "UserSectionScope_userId_sectionId_key" ON "UserSectionScope"("userId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceSection_name_key" ON "VoiceSection"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Member_authUserId_key" ON "Member"("authUserId");

-- CreateIndex
CREATE INDEX "Member_normalizedName_idx" ON "Member"("normalizedName");

-- CreateIndex
CREATE INDEX "Member_currentSectionId_status_idx" ON "Member"("currentSectionId", "status");

-- CreateIndex
CREATE INDEX "SectionAssignment_memberId_startsOn_idx" ON "SectionAssignment"("memberId", "startsOn");

-- CreateIndex
CREATE INDEX "MembershipIncident_memberId_status_idx" ON "MembershipIncident"("memberId", "status");

-- CreateIndex
CREATE INDEX "MembershipIncident_economicPeriod_idx" ON "MembershipIncident"("economicPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "BillingConcept_systemKey_key" ON "BillingConcept"("systemKey");

-- CreateIndex
CREATE INDEX "ChargeRule_conceptId_startsPeriod_idx" ON "ChargeRule"("conceptId", "startsPeriod");

-- CreateIndex
CREATE INDEX "ChargeException_period_idx" ON "ChargeException"("period");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeException_ruleId_memberId_period_key" ON "ChargeException"("ruleId", "memberId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Charge_dedupeKey_key" ON "Charge"("dedupeKey");

-- CreateIndex
CREATE INDEX "Charge_memberId_period_idx" ON "Charge"("memberId", "period");

-- CreateIndex
CREATE INDEX "Charge_status_dueOn_idx" ON "Charge"("status", "dueOn");

-- CreateIndex
CREATE INDEX "ChargeAdjustment_chargeId_idx" ON "ChargeAdjustment"("chargeId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAccount_name_key" ON "FinancialAccount"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyMovement_dedupeKey_key" ON "MoneyMovement"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyMovement_bankReferenceKey_key" ON "MoneyMovement"("bankReferenceKey");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyMovement_reversalOfId_key" ON "MoneyMovement"("reversalOfId");

-- CreateIndex
CREATE INDEX "MoneyMovement_accountId_occurredAt_idx" ON "MoneyMovement"("accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "MoneyMovement_status_type_idx" ON "MoneyMovement"("status", "type");

-- CreateIndex
CREATE INDEX "MoneyMovement_transferGroupId_idx" ON "MoneyMovement"("transferGroupId");

-- CreateIndex
CREATE INDEX "PaymentPart_movementId_idx" ON "PaymentPart"("movementId");

-- CreateIndex
CREATE INDEX "PaymentPart_memberId_idx" ON "PaymentPart"("memberId");

-- CreateIndex
CREATE INDEX "Allocation_chargeId_idx" ON "Allocation"("chargeId");

-- CreateIndex
CREATE UNIQUE INDEX "Allocation_paymentPartId_chargeId_key" ON "Allocation"("paymentPartId", "chargeId");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");

-- CreateIndex
CREATE INDEX "Attachment_sha256_idx" ON "Attachment"("sha256");

-- CreateIndex
CREATE INDEX "Attachment_uploadedById_createdAt_idx" ON "Attachment"("uploadedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationCandidate_movementId_key" ON "ReconciliationCandidate"("movementId");

-- CreateIndex
CREATE INDEX "ReconciliationCandidate_batchId_status_idx" ON "ReconciliationCandidate"("batchId", "status");

-- CreateIndex
CREATE INDEX "ReconciliationCandidate_occurredAt_amountCents_idx" ON "ReconciliationCandidate"("occurredAt", "amountCents");

-- CreateIndex
CREATE INDEX "PayerAlias_normalizedValue_idx" ON "PayerAlias"("normalizedValue");

-- CreateIndex
CREATE UNIQUE INDEX "PayerAlias_normalizedValue_memberId_key" ON "PayerAlias"("normalizedValue", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityExpense_activityId_movementId_key" ON "ActivityExpense"("activityId", "movementId");

-- CreateIndex
CREATE UNIQUE INDEX "Rehearsal_recurrenceKey_key" ON "Rehearsal"("recurrenceKey");

-- CreateIndex
CREATE INDEX "Rehearsal_startsAt_status_idx" ON "Rehearsal"("startsAt", "status");

-- CreateIndex
CREATE INDEX "RehearsalInvitee_memberId_idx" ON "RehearsalInvitee"("memberId");

-- CreateIndex
CREATE INDEX "Attendance_memberId_status_idx" ON "Attendance"("memberId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_rehearsalId_memberId_key" ON "Attendance"("rehearsalId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_sha256_key" ON "ImportBatch"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_storageKey_key" ON "ImportBatch"("storageKey");

-- CreateIndex
CREATE INDEX "ImportRow_batchId_status_idx" ON "ImportRow"("batchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRow_batchId_sheetName_rowNumber_recordFingerprint_key" ON "ImportRow"("batchId", "sheetName", "rowNumber", "recordFingerprint");

-- CreateIndex
CREATE INDEX "ImportIssue_batchId_status_idx" ON "ImportIssue"("batchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_email_expiresAt_idx" ON "Invitation"("email", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_scope_key_key" ON "IdempotencyKey"("scope", "key");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSectionScope" ADD CONSTRAINT "UserSectionScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSectionScope" ADD CONSTRAINT "UserSectionScope_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "VoiceSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_currentSectionId_fkey" FOREIGN KEY ("currentSectionId") REFERENCES "VoiceSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_authUserId_fkey" FOREIGN KEY ("authUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionAssignment" ADD CONSTRAINT "SectionAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionAssignment" ADD CONSTRAINT "SectionAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "VoiceSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipIncident" ADD CONSTRAINT "MembershipIncident_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipIncident" ADD CONSTRAINT "MembershipIncident_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipIncident" ADD CONSTRAINT "MembershipIncident_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeRule" ADD CONSTRAINT "ChargeRule_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "BillingConcept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeException" ADD CONSTRAINT "ChargeException_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ChargeRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "BillingConcept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ChargeRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeAdjustment" ADD CONSTRAINT "ChargeAdjustment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "MoneyMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPart" ADD CONSTRAINT "PaymentPart_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "MoneyMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPart" ADD CONSTRAINT "PaymentPart_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_paymentPartId_fkey" FOREIGN KEY ("paymentPartId") REFERENCES "PaymentPart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "MoneyMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationCandidate" ADD CONSTRAINT "ReconciliationCandidate_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ReconciliationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationCandidate" ADD CONSTRAINT "ReconciliationCandidate_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "MoneyMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateAttachment" ADD CONSTRAINT "CandidateAttachment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "ReconciliationCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateAttachment" ADD CONSTRAINT "CandidateAttachment_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayerAlias" ADD CONSTRAINT "PayerAlias_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityExpense" ADD CONSTRAINT "ActivityExpense_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityExpense" ADD CONSTRAINT "ActivityExpense_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "MoneyMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RehearsalInvitee" ADD CONSTRAINT "RehearsalInvitee_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RehearsalInvitee" ADD CONSTRAINT "RehearsalInvitee_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportIssue" ADD CONSTRAINT "ImportIssue_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Invariantes monetarias que deben sobrevivir a cualquier cliente o endpoint.
ALTER TABLE "BillingConcept" ADD CONSTRAINT "BillingConcept_defaultAmountCents_nonnegative" CHECK ("defaultAmountCents" >= 0);
ALTER TABLE "ChargeRule" ADD CONSTRAINT "ChargeRule_amountCents_nonnegative" CHECK ("amountCents" >= 0);
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_amountCents_nonnegative" CHECK ("amountCents" >= 0);
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_amountCents_positive" CHECK ("amountCents" > 0);
ALTER TABLE "PaymentPart" ADD CONSTRAINT "PaymentPart_amountCents_positive" CHECK ("amountCents" > 0);
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_amountCents_positive" CHECK ("amountCents" > 0);
ALTER TABLE "ActivityExpense" ADD CONSTRAINT "ActivityExpense_amountCents_positive" CHECK ("amountCents" > 0);
ALTER TABLE "Rehearsal" ADD CONSTRAINT "Rehearsal_window_valid" CHECK ("startsAt" < "endsAt" AND "checkInOpensAt" < "checkInClosesAt");

CREATE OR REPLACE FUNCTION validate_payment_part_total() RETURNS trigger AS $$
DECLARE
  movement_id text;
  movement_amount integer;
  parts_total bigint;
BEGIN
  movement_id := COALESCE(NEW."movementId", OLD."movementId");
  SELECT "amountCents" INTO movement_amount FROM "MoneyMovement" WHERE id = movement_id FOR UPDATE;
  IF movement_amount IS NULL THEN
    RAISE EXCEPTION 'Movimiento inexistente para la parte de pago';
  END IF;
  SELECT COALESCE(SUM("amountCents"), 0) INTO parts_total
    FROM "PaymentPart"
    WHERE "movementId" = movement_id
      AND (TG_OP = 'DELETE' OR id <> COALESCE(NEW.id, ''));
  IF TG_OP <> 'DELETE' THEN parts_total := parts_total + NEW."amountCents"; END IF;
  IF parts_total > movement_amount THEN
    RAISE EXCEPTION 'Las partes identificadas exceden el importe del movimiento';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER payment_part_total_guard
AFTER INSERT OR UPDATE OR DELETE ON "PaymentPart"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION validate_payment_part_total();

CREATE OR REPLACE FUNCTION validate_allocation_totals() RETURNS trigger AS $$
DECLARE
  part_member text;
  charge_member text;
  part_amount integer;
  charge_amount bigint;
  part_total bigint;
  charge_total bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  SELECT "memberId", "amountCents" INTO part_member, part_amount
    FROM "PaymentPart" WHERE id = NEW."paymentPartId" FOR UPDATE;
  SELECT "memberId", "amountCents" + COALESCE((SELECT SUM("amountCents") FROM "ChargeAdjustment" WHERE "chargeId" = NEW."chargeId"), 0)
    INTO charge_member, charge_amount FROM "Charge" WHERE id = NEW."chargeId" FOR UPDATE;
  IF part_member IS NULL OR charge_member IS NULL OR part_member <> charge_member THEN
    RAISE EXCEPTION 'La aplicación y el cargo deben pertenecer al mismo miembro';
  END IF;
  SELECT COALESCE(SUM("amountCents"), 0) INTO part_total FROM "Allocation"
    WHERE "paymentPartId" = NEW."paymentPartId" AND id <> NEW.id;
  IF part_total + NEW."amountCents" > part_amount THEN
    RAISE EXCEPTION 'Las aplicaciones exceden la parte asignada al miembro';
  END IF;
  SELECT COALESCE(SUM("amountCents"), 0) INTO charge_total FROM "Allocation"
    WHERE "chargeId" = NEW."chargeId" AND id <> NEW.id;
  IF charge_total + NEW."amountCents" > charge_amount THEN
    RAISE EXCEPTION 'La aplicación excede el saldo autorizado del cargo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER allocation_totals_guard
AFTER INSERT OR UPDATE ON "Allocation"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION validate_allocation_totals();
