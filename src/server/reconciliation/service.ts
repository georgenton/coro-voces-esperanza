import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { prisma } from "@/lib/db";
import { normalizeName } from "@/lib/names";
import { readPrivateFile, storePrivateFile } from "@/server/files/private-storage";
import { extractReceiptWithVision } from "@/server/reconciliation/vision";
import { registerAndAllocatePayment } from "@/server/finance/payments";

export async function createReconciliationBatch(name: string, actorId: string) {
  if (name.trim().length < 3) throw new Error("Asigna un nombre descriptivo al lote.");
  return prisma.reconciliationBatch.create({ data: { name: name.trim(), createdById: actorId } });
}

export async function addEvidenceToBatch(batchId: string, file: File, actorId: string) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  const duplicate = await prisma.attachment.findFirst({ where: { sha256: digest } });
  const attachment = duplicate ?? await (async () => {
    const stored = await storePrivateFile({
      bytes,
      originalName: file.name,
      allowedTypes: ["image/png", "image/jpeg", "image/webp", "text/csv"],
    });
    return prisma.attachment.create({
      data: { ...stored, uploadedById: actorId, status: "RECEIVED" },
    });
  })();
  const candidate = await prisma.reconciliationCandidate.create({
    data: {
      batchId,
      status: duplicate ? "POSSIBLE_DUPLICATE" : "REVIEW_REQUIRED",
      reviewNote: duplicate ? "La misma evidencia ya había sido cargada; revisar si respalda el mismo movimiento." : null,
      attachments: { create: { attachmentId: attachment.id } },
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "EVIDENCE_UPLOADED",
      entityType: "ReconciliationCandidate",
      entityId: candidate.id,
      summary: duplicate ? "Evidencia repetida enlazada para revisión." : "Evidencia privada añadida al lote.",
      metadata: { duplicate: Boolean(duplicate), contentType: attachment.contentType, sizeBytes: attachment.sizeBytes },
    },
  });
  return candidate;
}

export async function importBankCsv(batchId: string, file: File, actorId: string) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const stored = await storePrivateFile({ bytes, originalName: file.name, allowedTypes: ["text/csv"] });
  const records = parse(bytes.toString("utf8"), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: false,
    max_record_size: 20_000,
  }) as Record<string, string>[];
  if (records.length > 5_000) throw new Error("El CSV excede 5.000 movimientos.");
  const attachment = await prisma.attachment.create({
    data: { ...stored, uploadedById: actorId, status: "RECEIVED" },
  });
  const candidates = [];
  for (const record of records) {
    candidates.push(
      await prisma.reconciliationCandidate.create({
        data: {
          batchId,
          status: "REVIEW_REQUIRED",
          extraction: record,
          reviewNote: "Fila CSV pendiente de mapeo de columnas y confirmación humana.",
          attachments: { create: { attachmentId: attachment.id } },
        },
      }),
    );
  }
  return candidates.length;
}

export async function runVisionExtraction(candidateId: string, actorId: string) {
  const candidate = await prisma.reconciliationCandidate.findUnique({
    where: { id: candidateId },
    include: { attachments: { include: { attachment: true } } },
  });
  if (!candidate) throw new Error("Candidato no encontrado.");
  const image = candidate.attachments.map(({ attachment }) => attachment)
    .find(({ contentType }) => contentType.startsWith("image/"));
  if (!image) throw new Error("El candidato no contiene una imagen compatible.");
  await prisma.reconciliationCandidate.update({ where: { id: candidateId }, data: { status: "EXTRACTION_PENDING" } });
  try {
    const extraction = await extractReceiptWithVision({
      bytes: await readPrivateFile(image.storageKey),
      contentType: image.contentType,
    });
    const first = extraction.movements[0];
    const updated = await prisma.reconciliationCandidate.update({
      where: { id: candidateId },
      data: {
        status: "REVIEW_REQUIRED",
        amountCents: first?.amountCents ?? null,
        currency: first?.currency ?? null,
        occurredAt: first?.occurredAt ? new Date(first.occurredAt) : null,
        direction: first?.direction ?? null,
        externalReference: first?.externalReference ?? null,
        payerName: first?.payerName ?? null,
        destinationMasked: first?.destinationMasked ?? null,
        extraction,
        reviewNote: extraction.movements.length > 1
          ? `La imagen contiene ${extraction.movements.length} operaciones propuestas; sepáralas antes de confirmar.`
          : "Extracción propuesta; requiere confirmación humana.",
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "VISION_EXTRACTION_COMPLETED",
        entityType: "ReconciliationCandidate",
        entityId: candidateId,
        summary: "Lectura automática guardada como propuesta no confirmada.",
        metadata: { movementCount: extraction.movements.length },
      },
    });
    return updated;
  } catch (error) {
    await prisma.reconciliationCandidate.update({
      where: { id: candidateId },
      data: { status: "REVIEW_REQUIRED", reviewNote: "No se pudo leer automáticamente; completa los datos manualmente." },
    });
    throw error;
  }
}

export async function suggestMembersForPayer(payerName: string) {
  const normalized = normalizeName(payerName);
  if (!normalized) return [];
  const [members, aliases] = await Promise.all([
    prisma.member.findMany({ where: { normalizedName: normalized }, select: { id: true, displayName: true } }),
    prisma.payerAlias.findMany({ where: { normalizedValue: normalized }, include: { member: { select: { id: true, displayName: true } } } }),
  ]);
  const unique = new Map(members.map((member) => [member.id, member]));
  for (const alias of aliases) unique.set(alias.member.id, alias.member);
  return [...unique.values()];
}

export async function updateCandidateManually(candidateId: string, input: {
  amountCents: number | null;
  occurredAt: Date | null;
  externalReference: string | null;
  payerName: string | null;
  direction: "IN" | "OUT" | null;
  reviewNote: string | null;
}, actorId: string) {
  const candidate = await prisma.reconciliationCandidate.update({
    where: { id: candidateId },
    data: {
      ...input,
      currency: input.amountCents ? "USD" : undefined,
      status: input.amountCents && input.direction ? "READY" : "REVIEW_REQUIRED",
    },
  });
  await prisma.auditLog.create({ data: {
    actorId,
    action: "RECONCILIATION_CANDIDATE_REVIEWED",
    entityType: "ReconciliationCandidate",
    entityId: candidate.id,
    summary: "Datos del candidato revisados manualmente.",
  } });
  return candidate;
}

export async function confirmUnidentifiedCandidate(candidateId: string, accountId: string, actorId: string) {
  const candidate = await prisma.reconciliationCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate || candidate.status !== "READY" || !candidate.amountCents) {
    throw new Error("El candidato no está listo para confirmar.");
  }
  if (candidate.direction !== "IN") throw new Error("Este flujo confirma únicamente entradas; registra salidas como gastos.");
  if (candidate.currency && candidate.currency !== "USD") throw new Error("La moneda requiere revisión antes de confirmar.");
  const movement = await registerAndAllocatePayment({
    accountId,
    amountCents: candidate.amountCents,
    occurredAt: candidate.occurredAt,
    description: candidate.payerName ? `Depósito de ${candidate.payerName}` : "Depósito pendiente de identificar",
    externalReference: candidate.externalReference ?? undefined,
    parts: [],
    idempotencyKey: `candidate:${candidate.id}`,
    source: "RECONCILIATION",
  }, actorId);
  await prisma.reconciliationCandidate.update({
    where: { id: candidate.id },
    data: { movementId: movement.id, status: "CONFIRMED" },
  });
  return movement;
}
