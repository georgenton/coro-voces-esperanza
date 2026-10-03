import { createHash } from "node:crypto";
import {
  ChargeStatus,
  ImportPromotionStatus,
  MovementStatus,
  MovementType,
  Prisma,
  ReviewStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { normalizeName } from "@/lib/names";
import { chargeDedupeKey } from "@/server/finance/rules";
import { storePrivateFile } from "@/server/files/private-storage";
import {
  dateAtGuayaquilMidnight,
  hashApprovedMapping,
  hashTransformation,
  importSourceKey,
  parseImportTransformation,
  transformationInScope,
  type ImportTransformation,
  type PromotionScope,
} from "@/server/imports/mapping";
import { previewWorkbook } from "@/server/imports/workbook";

type ImportDb = Pick<
  Prisma.TransactionClient,
  | "allocation"
  | "billingConcept"
  | "charge"
  | "financialAccount"
  | "importBatch"
  | "importPublication"
  | "member"
  | "paymentPart"
  | "sectionAssignment"
  | "voiceSection"
>;

export type PromotionPreview = {
  scope: PromotionScope;
  mappingVersion: number;
  mappingHash: string;
  rows: number;
  creates: {
    members: number;
    sectionAssignments: number;
    charges: number;
    legacyAllocations: number;
    movements: number;
    openingBalances: number;
  };
  links: { identities: number };
  duplicates: number;
  differences: string[];
  blockingIssues: string[];
};

type MappedRow = {
  id: string;
  sheetName: string;
  rowNumber: number;
  recordFingerprint: string;
  proposedType: string | null;
  transformed: Prisma.JsonValue | null;
  transformation: ImportTransformation;
};

function newPreview(scope: PromotionScope, mappingVersion: number, mappingHash: string): PromotionPreview {
  return {
    scope,
    mappingVersion,
    mappingHash,
    rows: 0,
    creates: { members: 0, sectionAssignments: 0, charges: 0, legacyAllocations: 0, movements: 0, openingBalances: 0 },
    links: { identities: 0 },
    duplicates: 0,
    differences: [],
    blockingIssues: [],
  };
}

function rowLabel(row: { sheetName: string; rowNumber: number }) {
  return `${row.sheetName}, fila ${row.rowNumber}`;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function createManyInChunks<T>(items: T[], write: (chunk: T[]) => Promise<unknown>, size = 500) {
  for (let index = 0; index < items.length; index += size) {
    await write(items.slice(index, index + size));
  }
}

function mappedRowsForBatch(batch: {
  rows: Array<{
    id: string;
    sheetName: string;
    rowNumber: number;
    recordFingerprint: string;
    proposedType: string | null;
    transformed: Prisma.JsonValue | null;
    status: ReviewStatus;
  }>;
}, scope: PromotionScope) {
  const rows: MappedRow[] = [];
  for (const row of batch.rows) {
    if (row.status !== ReviewStatus.APPROVED) continue;
    const transformation = parseImportTransformation(row.transformed);
    if (row.proposedType !== transformation.type) throw new Error(`${rowLabel(row)} tiene un tipo distinto del mapeo guardado.`);
    if (!transformationInScope(transformation, scope)) continue;
    rows.push({ ...row, transformation });
  }
  return rows;
}

async function buildPromotionPreview(client: ImportDb, batchId: string, scope: PromotionScope): Promise<PromotionPreview> {
  const batch = await client.importBatch.findUnique({
    where: { id: batchId },
    include: { rows: { orderBy: { id: "asc" } } },
  });
  if (!batch) throw new Error("Lote de importación no encontrado.");
  if (batch.status !== "APPROVED" || !batch.mappingHash || !batch.approvedAt || !batch.approvedById) {
    throw new Error("El mapeo debe estar completamente revisado y aprobado antes de preparar la promoción.");
  }
  const calculatedHash = hashApprovedMapping(batch.rows);
  if (calculatedHash !== batch.mappingHash) throw new Error("El mapeo cambió después de su aprobación; vuelve a revisarlo.");

  const rows = mappedRowsForBatch(batch, scope);
  const preview = newPreview(scope, batch.mappingVersion, batch.mappingHash);
  preview.rows = rows.length;
  if (!rows.length) preview.blockingIssues.push("El alcance elegido no contiene filas aprobadas para promover.");

  const [members, sections, concepts, accounts, charges, publications] = await Promise.all([
    client.member.findMany({ select: { id: true, normalizedName: true } }),
    client.voiceSection.findMany({ select: { id: true } }),
    client.billingConcept.findMany({ select: { id: true } }),
    client.financialAccount.findMany({ select: { id: true } }),
    client.charge.findMany({ include: { allocations: { select: { amountCents: true } }, adjustments: { select: { amountCents: true } } } }),
    client.importPublication.findMany({ where: { rowId: { in: rows.map(({ id }) => id) } }, select: { dedupeKey: true } }),
  ]);
  const memberIds = new Set(members.map(({ id }) => id));
  const normalizedNames = new Set(members.map(({ normalizedName }) => normalizedName));
  const sectionIds = new Set(sections.map(({ id }) => id));
  const conceptIds = new Set(concepts.map(({ id }) => id));
  const accountIds = new Set(accounts.map(({ id }) => id));
  const publishedKeys = new Set(publications.map(({ dedupeKey }) => dedupeKey));
  const proposedAmounts = new Map<string, number>();
  const seenChargeRows = new Set<string>();
  const countedNewCharges = new Set<string>();

  for (const row of rows) {
    const { transformation } = row;
    const sourceKey = importSourceKey(batch.sha256, row.id, transformation.type);
    if (publishedKeys.has(sourceKey)) {
      preview.duplicates += 1;
      continue;
    }
    if (transformation.type === "MEMBER_CREATE") {
      if (!sectionIds.has(transformation.sectionId)) preview.blockingIssues.push(`${rowLabel(row)}: la cuerda elegida ya no existe.`);
      const normalized = normalizeName(transformation.displayName);
      if (normalizedNames.has(normalized)) {
        preview.blockingIssues.push(`${rowLabel(row)}: el nombre coincide con un miembro existente; enlaza la identidad en vez de crearla.`);
      } else {
        normalizedNames.add(normalized);
        preview.creates.members += 1;
        preview.creates.sectionAssignments += 1;
      }
      continue;
    }
    if (transformation.type === "IDENTITY_LINK") {
      if (!memberIds.has(transformation.memberId)) preview.blockingIssues.push(`${rowLabel(row)}: el miembro enlazado ya no existe.`);
      else preview.links.identities += 1;
      continue;
    }
    if (transformation.type === "SECTION_ASSIGNMENT") {
      if (!memberIds.has(transformation.memberId)) preview.blockingIssues.push(`${rowLabel(row)}: el miembro ya no existe.`);
      if (!sectionIds.has(transformation.sectionId)) preview.blockingIssues.push(`${rowLabel(row)}: la cuerda ya no existe.`);
      preview.creates.sectionAssignments += 1;
      continue;
    }
    if (transformation.type === "MONEY_MOVEMENT" || transformation.type === "OPENING_BALANCE") {
      if (!accountIds.has(transformation.accountId)) preview.blockingIssues.push(`${rowLabel(row)}: la cuenta financiera ya no existe.`);
      if (transformation.type === "MONEY_MOVEMENT") {
        const expectedDirection = transformation.movementType === "EXPENSE" ? "OUT" : "IN";
        if (transformation.direction !== expectedDirection) preview.blockingIssues.push(`${rowLabel(row)}: ${transformation.movementType} debe usar dirección ${expectedDirection}.`);
        preview.creates.movements += 1;
      } else {
        preview.creates.openingBalances += 1;
      }
      continue;
    }

    if (!memberIds.has(transformation.memberId)) preview.blockingIssues.push(`${rowLabel(row)}: el miembro ya no existe.`);
    if (!conceptIds.has(transformation.conceptId)) preview.blockingIssues.push(`${rowLabel(row)}: el concepto ya no existe.`);
    const naturalKey = chargeDedupeKey({ memberId: transformation.memberId, conceptId: transformation.conceptId, period: transformation.period });
    const expectedCharge = transformation.type === "CHARGE" ? transformation.amountCents : transformation.chargeAmountCents;
    const existing = charges.find((charge) => charge.dedupeKey === naturalKey);
    if (transformation.type === "CHARGE" && seenChargeRows.has(naturalKey)) preview.blockingIssues.push(`${rowLabel(row)}: otra fila aprobada ya propone el mismo cargo.`);
    seenChargeRows.add(naturalKey);
    if (existing) {
      if (existing.amountCents !== expectedCharge) {
        preview.differences.push(`${rowLabel(row)}: el cargo existente es ${existing.amountCents} centavos y la fila propone ${expectedCharge}.`);
        preview.blockingIssues.push(`${rowLabel(row)}: diferencia de importe en un cargo existente.`);
      } else if (transformation.type === "CHARGE") preview.duplicates += 1;
    } else if (!countedNewCharges.has(naturalKey)) {
      preview.creates.charges += 1;
      countedNewCharges.add(naturalKey);
    }

    if (transformation.type === "LEGACY_ALLOCATION") {
      preview.creates.legacyAllocations += 1;
      proposedAmounts.set(naturalKey, (proposedAmounts.get(naturalKey) ?? 0) + transformation.appliedAmountCents);
    }
  }

  for (const [naturalKey, proposed] of proposedAmounts) {
    const charge = charges.find((item) => item.dedupeKey === naturalKey);
    if (!charge) continue;
    const adjusted = charge.amountCents + charge.adjustments.reduce((sum, item) => sum + item.amountCents, 0);
    const applied = charge.allocations.reduce((sum, item) => sum + item.amountCents, 0);
    if (applied + proposed > adjusted) preview.blockingIssues.push(`Las aplicaciones propuestas sobre ${naturalKey} exceden su saldo disponible.`);
  }
  return preview;
}

export async function stageWorkbook(file: File, actorId: string) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const preview = await previewWorkbook(bytes);
  const existing = await prisma.importBatch.findUnique({ where: { sha256: preview.sha256 } });
  if (existing) return { batch: existing, duplicate: true, preview: null };
  const stored = await storePrivateFile({ bytes, originalName: file.name, allowedTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] });
  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.importBatch.create({ data: {
      sha256: preview.sha256,
      originalName: stored.originalName,
      storageKey: stored.storageKey,
      sizeBytes: stored.sizeBytes,
      sheetCount: preview.sheetCount,
      importedById: actorId,
      status: "REVIEW_REQUIRED",
      declaredCutoff: dateAtGuayaquilMidnight(preview.sourceSummary.cutoff),
      cutoffTimezone: preview.sourceSummary.cutoffTimezone,
      sourceVersion: `${preview.sourceSummary.cutoff}:${preview.sha256.slice(0, 12)}`,
      summary: asJson({
        source: preview.sourceSummary,
        sheets: preview.sheets.map(({ name, physicalOrder, kind, nominalPeriod, coverageStatus, rowCount, columnCount, declaredRange, blockYears }) => ({
          name, physicalOrder, kind, nominalPeriod, coverageStatus, rowCount, columnCount, declaredRange, blockYears,
        })),
      }),
    } });
    await tx.importSheet.createMany({ data: preview.sheets.map((sheet) => ({
      batchId: created.id,
      name: sheet.name,
      physicalOrder: sheet.physicalOrder,
      kind: sheet.kind,
      nominalPeriod: sheet.nominalPeriod,
      coverageStatus: sheet.coverageStatus,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      declaredRange: sheet.declaredRange,
      blockYears: asJson(sheet.blockYears),
      summary: asJson({ sample: sheet.sample }),
    })) });
    await createManyInChunks(preview.rows, (chunk) => tx.importRow.createMany({ data: chunk.map((row) => ({
      batchId: created.id,
      sheetName: row.sheetName,
      rowNumber: row.rowNumber,
      rawText: row.rawText,
      recordFingerprint: row.fingerprint,
      contentFingerprint: row.contentFingerprint,
      semanticKey: row.semanticKey,
      sourceKind: row.sourceKind,
      nominalPeriod: row.nominalPeriod,
      sourceData: asJson(row.sourceData),
      firstCellReference: row.firstCellReference,
      lastCellReference: row.lastCellReference,
      isAggregate: row.isAggregate,
      status: "PENDING",
    })) }));
    await createManyInChunks(preview.cells, (chunk) => tx.importCell.createMany({ data: chunk.map((cell) => ({
      batchId: created.id,
      sheetName: cell.sheetName,
      cellReference: cell.cellReference,
      rowNumber: cell.rowNumber,
      columnNumber: cell.columnNumber,
      valueType: cell.valueType,
      literalValue: cell.literalValue,
      formula: cell.formula,
      cachedValue: cell.cachedValue,
      displayValue: cell.displayValue,
      annotation: cell.annotation,
      originalDate: cell.originalDate,
      numberFormat: cell.numberFormat,
      styleEvidence: cell.styleEvidence ? asJson(cell.styleEvidence) : undefined,
    })) }));
    if (preview.issues.length) await tx.importIssue.createMany({ data: preview.issues.map((issue) => ({ batchId: created.id, ...issue })) });
    await tx.auditLog.create({ data: {
      actorId,
      action: "IMPORT_STAGED",
      entityType: "ImportBatch",
      entityId: created.id,
      summary: "Libro cargado a staging; no se generaron cargos ni movimientos.",
      metadata: { sha256: preview.sha256, sheets: preview.sheetCount, rows: preview.rows.length, cells: preview.cells.length, issues: preview.issues.length },
    } });
    return created;
  });
  return { batch, duplicate: false, preview };
}

export async function saveImportRowMapping(rowId: string, transformation: ImportTransformation, actorId: string) {
  const parsed = parseImportTransformation(transformation);
  return prisma.$transaction(async (tx) => {
    const row = await tx.importRow.findUnique({ where: { id: rowId }, include: { publications: { select: { id: true } } } });
    if (!row) throw new Error("Fila de staging no encontrada.");
    if (row.publications.length) throw new Error("La fila ya fue promovida y no puede editarse; usa ajustes o reversos auditados.");
    await tx.importRow.update({ where: { id: row.id }, data: {
      proposedType: parsed.type,
      transformed: asJson(parsed),
      transformationHash: hashTransformation(parsed.type, parsed),
      status: ReviewStatus.PENDING,
      reviewedAt: null,
      reviewedById: null,
    } });
    const batch = await tx.importBatch.update({ where: { id: row.batchId }, data: {
      status: "REVIEW_REQUIRED",
      approvedAt: null,
      approvedById: null,
      mappingHash: null,
      mappingVersion: { increment: 1 },
    } });
    await tx.importPromotion.updateMany({ where: { batchId: row.batchId, status: { in: [ImportPromotionStatus.PREVIEWED, ImportPromotionStatus.PROMOTING] } }, data: { status: ImportPromotionStatus.SUPERSEDED } });
    await tx.auditLog.create({ data: {
      actorId,
      action: "IMPORT_MAPPING_CHANGED",
      entityType: "ImportRow",
      entityId: row.id,
      summary: "Mapeo de fila editado; se invalidó la aprobación anterior.",
      metadata: { batchId: row.batchId, mappingVersion: batch.mappingVersion, type: parsed.type },
    } });
    return row.batchId;
  });
}

export async function resolveImportItem(input: { kind: "row" | "issue"; id: string; status: "APPROVED" | "REJECTED" }, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const row = input.kind === "row" ? await tx.importRow.findUnique({ where: { id: input.id } }) : null;
    const issue = input.kind === "issue" ? await tx.importIssue.findUnique({ where: { id: input.id } }) : null;
    const item = row ?? issue;
    if (!item) throw new Error("Elemento de importación no encontrado.");
    if (row && input.status === ReviewStatus.APPROVED) parseImportTransformation(row.transformed);
    if (row) await tx.importRow.update({ where: { id: input.id }, data: { status: input.status, reviewedById: actorId, reviewedAt: new Date() } });
    else await tx.importIssue.update({ where: { id: input.id }, data: { status: input.status } });
    const batch = await tx.importBatch.update({ where: { id: item.batchId }, data: { status: "REVIEW_REQUIRED", approvedAt: null, approvedById: null, mappingHash: null, mappingVersion: { increment: 1 } } });
    await tx.importPromotion.updateMany({ where: { batchId: item.batchId, status: { in: [ImportPromotionStatus.PREVIEWED, ImportPromotionStatus.PROMOTING] } }, data: { status: ImportPromotionStatus.SUPERSEDED } });
    await tx.auditLog.create({ data: {
      actorId,
      action: "IMPORT_ITEM_RESOLVED",
      entityType: input.kind === "issue" ? "ImportIssue" : "ImportRow",
      entityId: input.id,
      summary: `Elemento de staging marcado como ${input.status}; la aprobación del lote quedó invalidada hasta nueva revisión.`,
      metadata: { batchId: item.batchId, mappingVersion: batch.mappingVersion },
    } });
    return item.batchId;
  });
}

export async function approveImportBatch(batchId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.findUnique({ where: { id: batchId }, include: { rows: { orderBy: { id: "asc" } }, issues: true } });
    if (!batch) throw new Error("Lote de importación no encontrado.");
    if (batch.issues.some(({ status }) => status === ReviewStatus.PENDING) || batch.rows.some(({ status }) => status === ReviewStatus.PENDING)) throw new Error("No se puede aprobar mientras existan filas o incidencias pendientes.");
    for (const row of batch.rows.filter(({ status }) => status === ReviewStatus.APPROVED)) {
      const transformation = parseImportTransformation(row.transformed);
      if (row.proposedType !== transformation.type) throw new Error(`${rowLabel(row)} tiene un tipo de mapeo inconsistente.`);
      if (row.transformationHash !== hashTransformation(row.proposedType, row.transformed)) throw new Error(`${rowLabel(row)} cambió después de su revisión.`);
    }
    const mappingHash = hashApprovedMapping(batch.rows);
    const updated = await tx.importBatch.update({ where: { id: batchId }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: actorId, mappingHash } });
    await tx.auditLog.create({ data: {
      actorId,
      action: "IMPORT_APPROVED",
      entityType: "ImportBatch",
      entityId: batchId,
      summary: "Mapeo de staging aprobado; todavía no se publicaron registros operativos.",
      metadata: { mappingHash, mappingVersion: batch.mappingVersion },
    } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createPromotionPreview(batchId: string, scope: PromotionScope, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const preview = await buildPromotionPreview(tx, batchId, scope);
    const idempotencyKey = createHash("sha256").update(`${batchId}:${scope}:${preview.mappingHash}`).digest("hex");
    const existing = await tx.importPromotion.findUnique({ where: { batchId_scope_mappingHash: { batchId, scope, mappingHash: preview.mappingHash } } });
    if (existing) {
      if (existing.status === ImportPromotionStatus.PROMOTED) return existing;
      return tx.importPromotion.update({ where: { id: existing.id }, data: { preview: asJson(preview), mappingVersion: preview.mappingVersion, status: ImportPromotionStatus.PREVIEWED, createdById: actorId } });
    }
    return tx.importPromotion.create({ data: { batchId, scope, mappingVersion: preview.mappingVersion, mappingHash: preview.mappingHash, preview: asJson(preview), idempotencyKey, createdById: actorId } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function createPublication(tx: Prisma.TransactionClient, input: { promotionId: string; rowId: string; targetType: string; targetId: string; dedupeKey: string }) {
  await tx.importPublication.create({ data: input });
}

async function promoteRow(tx: Prisma.TransactionClient, input: { batchSha256: string; promotionId: string; actorId: string; row: MappedRow }) {
  const { batchSha256, promotionId, actorId, row } = input;
  const transformation = row.transformation;
  const sourceKey = importSourceKey(batchSha256, row.id, transformation.type);
  const published = await tx.importPublication.findUnique({ where: { dedupeKey: sourceKey } });
  if (published) return published.targetId;

  let targetType = transformation.type;
  let targetId: string;
  if (transformation.type === "MEMBER_CREATE") {
    const member = await tx.member.create({ data: {
      displayName: transformation.displayName,
      originalName: transformation.originalName ?? transformation.displayName,
      normalizedName: normalizeName(transformation.displayName),
      status: transformation.status,
      currentSectionId: transformation.sectionId,
      joinedOn: dateAtGuayaquilMidnight(transformation.startsOn),
      sourceReference: sourceKey,
    } });
    const assignmentKey = importSourceKey(batchSha256, row.id, "MEMBER_SECTION");
    const assignment = await tx.sectionAssignment.create({ data: {
      memberId: member.id,
      sectionId: transformation.sectionId,
      startsOn: dateAtGuayaquilMidnight(transformation.startsOn)!,
      source: "IMPORT",
      sourceReference: assignmentKey,
    } });
    await createPublication(tx, { promotionId, rowId: row.id, targetType: "SECTION_ASSIGNMENT", targetId: assignment.id, dedupeKey: assignmentKey });
    targetId = member.id;
  } else if (transformation.type === "IDENTITY_LINK") {
    await tx.member.findUniqueOrThrow({ where: { id: transformation.memberId } });
    targetId = transformation.memberId;
  } else if (transformation.type === "SECTION_ASSIGNMENT") {
    const assignment = await tx.sectionAssignment.create({ data: {
      memberId: transformation.memberId,
      sectionId: transformation.sectionId,
      startsOn: dateAtGuayaquilMidnight(transformation.startsOn)!,
      endsOn: dateAtGuayaquilMidnight(transformation.endsOn),
      source: "IMPORT",
      sourceReference: sourceKey,
    } });
    const latest = await tx.sectionAssignment.findFirst({ where: { memberId: transformation.memberId }, orderBy: { startsOn: "desc" }, select: { id: true } });
    if (latest?.id === assignment.id) await tx.member.update({ where: { id: transformation.memberId }, data: { currentSectionId: transformation.sectionId } });
    targetId = assignment.id;
  } else if (transformation.type === "CHARGE" || transformation.type === "LEGACY_ALLOCATION") {
    const naturalKey = chargeDedupeKey({ memberId: transformation.memberId, conceptId: transformation.conceptId, period: transformation.period });
    const chargeAmountCents = transformation.type === "CHARGE" ? transformation.amountCents : transformation.chargeAmountCents;
    let charge = await tx.charge.findUnique({ where: { dedupeKey: naturalKey }, include: { allocations: true, adjustments: true } });
    if (!charge) charge = await tx.charge.create({ data: {
      dedupeKey: naturalKey,
      memberId: transformation.memberId,
      conceptId: transformation.conceptId,
      period: transformation.period,
      dueOn: dateAtGuayaquilMidnight(transformation.dueOn),
      amountCents: chargeAmountCents,
      source: "IMPORT",
      sourceReference: sourceKey,
      publishedAt: new Date(),
    }, include: { allocations: true, adjustments: true } });
    if (charge.amountCents !== chargeAmountCents) throw new Error(`${rowLabel(row)} difiere del cargo operativo existente.`);
    if (transformation.type === "CHARGE") {
      targetId = charge.id;
      targetType = "CHARGE";
    } else {
      const partKey = importSourceKey(batchSha256, row.id, "LEGACY_PAYMENT_PART");
      const part = await tx.paymentPart.create({ data: {
        movementId: null,
        memberId: transformation.memberId,
        amountCents: transformation.appliedAmountCents,
        note: "Aplicación histórica aprobada sin movimiento bancario confirmado.",
        isLegacy: true,
        cashEffect: false,
        receivedAt: null,
        source: "LEGACY_IMPORT",
        sourceReference: partKey,
      } });
      const allocation = await tx.allocation.create({ data: {
        paymentPartId: part.id,
        chargeId: charge.id,
        amountCents: transformation.appliedAmountCents,
        isLegacy: true,
        cashEffect: false,
        appliedAt: dateAtGuayaquilMidnight(transformation.appliedOn),
      } });
      const refreshed = await tx.charge.findUniqueOrThrow({ where: { id: charge.id }, include: { allocations: true, adjustments: true } });
      const adjusted = refreshed.amountCents + refreshed.adjustments.reduce((sum, item) => sum + item.amountCents, 0);
      const applied = refreshed.allocations.reduce((sum, item) => sum + item.amountCents, 0);
      if (applied > adjusted) throw new Error(`${rowLabel(row)} sobreaplica el cargo.`);
      await tx.charge.update({ where: { id: charge.id }, data: { status: applied >= adjusted ? ChargeStatus.PAID : ChargeStatus.PARTIAL } });
      await createPublication(tx, { promotionId, rowId: row.id, targetType: "PAYMENT_PART", targetId: part.id, dedupeKey: partKey });
      targetId = allocation.id;
      targetType = "LEGACY_ALLOCATION";
    }
  } else {
    const movement = await tx.moneyMovement.create({ data: {
      dedupeKey: sourceKey,
      accountId: transformation.accountId,
      type: transformation.type === "OPENING_BALANCE" ? MovementType.OPENING_BALANCE : transformation.movementType,
      direction: transformation.direction,
      status: MovementStatus.CONFIRMED,
      amountCents: transformation.amountCents,
      occurredAt: dateAtGuayaquilMidnight(transformation.type === "OPENING_BALANCE" ? transformation.cutoffOn : transformation.occurredOn),
      description: transformation.description ?? (transformation.type === "OPENING_BALANCE" ? "Saldo de apertura aprobado" : null),
      externalReference: transformation.type === "MONEY_MOVEMENT" ? transformation.externalReference ?? null : null,
      cashEffect: true,
      source: "IMPORT",
      confirmedAt: new Date(),
      confirmedById: actorId,
    } });
    targetId = movement.id;
    targetType = transformation.type === "OPENING_BALANCE" ? "OPENING_BALANCE" : "MONEY_MOVEMENT";
  }
  await createPublication(tx, { promotionId, rowId: row.id, targetType, targetId, dedupeKey: sourceKey });
  return targetId;
}

async function promoteOnce(planId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.importPromotion.findUnique({ where: { id: planId }, include: { batch: { include: { rows: { orderBy: { id: "asc" } } } } } });
    if (!plan) throw new Error("Vista previa de promoción no encontrada.");
    if (plan.status === ImportPromotionStatus.PROMOTED) return plan;
    if (plan.status !== ImportPromotionStatus.PREVIEWED) throw new Error("La vista previa ya no está vigente.");
    const claim = await tx.importPromotion.updateMany({ where: { id: plan.id, status: ImportPromotionStatus.PREVIEWED }, data: { status: ImportPromotionStatus.PROMOTING } });
    if (claim.count !== 1) {
      const current = await tx.importPromotion.findUniqueOrThrow({ where: { id: plan.id } });
      if (current.status === ImportPromotionStatus.PROMOTED) return current;
      throw new Error("La promoción está siendo procesada por otra solicitud.");
    }
    if (plan.batch.status !== "APPROVED" || plan.batch.mappingHash !== plan.mappingHash || plan.batch.mappingVersion !== plan.mappingVersion) throw new Error("El mapeo cambió; genera una vista previa nueva.");
    if (hashApprovedMapping(plan.batch.rows) !== plan.mappingHash) throw new Error("El contenido aprobado no coincide con la vista previa.");
    const scope = plan.scope as PromotionScope;
    const preview = await buildPromotionPreview(tx, plan.batchId, scope);
    if (preview.blockingIssues.length) throw new Error(`Promoción bloqueada: ${preview.blockingIssues[0]}`);
    const rows = mappedRowsForBatch(plan.batch, scope);
    for (const row of rows) await promoteRow(tx, { batchSha256: plan.batch.sha256, promotionId: plan.id, actorId, row });
    const updated = await tx.importPromotion.update({ where: { id: plan.id }, data: { status: ImportPromotionStatus.PROMOTED, approvedById: actorId, promotedAt: new Date(), preview: asJson(preview) } });
    await tx.auditLog.create({ data: {
      actorId,
      action: "IMPORT_PROMOTED",
      entityType: "ImportPromotion",
      entityId: plan.id,
      summary: `Promoción atómica e idempotente del alcance ${scope}.`,
      metadata: { batchId: plan.batchId, mappingHash: plan.mappingHash, mappingVersion: plan.mappingVersion, rows: rows.length },
    } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function promoteImportPlan(planId: string, actorId: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await promoteOnce(planId, actorId);
    } catch (error) {
      lastError = error;
      const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
      const message = error instanceof Error ? error.message : "";
      if (code !== "P2034" && code !== "40001" && !message.toLowerCase().includes("serialization")) throw error;
    }
  }
  throw lastError;
}
