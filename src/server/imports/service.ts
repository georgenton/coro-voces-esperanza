import { prisma } from "@/lib/db";
import { previewWorkbook } from "@/server/imports/workbook";
import { storePrivateFile } from "@/server/files/private-storage";

export async function stageWorkbook(file: File, actorId: string) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const preview = await previewWorkbook(bytes);
  const existing = await prisma.importBatch.findUnique({ where: { sha256: preview.sha256 } });
  if (existing) return { batch: existing, duplicate: true, preview: null };
  const stored = await storePrivateFile({
    bytes,
    originalName: file.name,
    allowedTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  });
  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.importBatch.create({
      data: {
        sha256: preview.sha256,
        originalName: stored.originalName,
        storageKey: stored.storageKey,
        sizeBytes: stored.sizeBytes,
        sheetCount: preview.sheetCount,
        importedById: actorId,
        status: "REVIEW_REQUIRED",
        summary: { sheets: preview.sheets.map(({ name, rowCount, columnCount }) => ({ name, rowCount, columnCount })) },
      },
    });
    const keptRows = preview.rows.slice(0, 5_000);
    if (keptRows.length) {
      await tx.importRow.createMany({
        data: keptRows.map((row) => ({
          batchId: created.id,
          sheetName: row.sheetName,
          rowNumber: row.rowNumber,
          rawText: row.rawText,
          recordFingerprint: row.fingerprint,
          status: "PENDING",
        })),
      });
    }
    if (preview.issues.length) {
      await tx.importIssue.createMany({
        data: preview.issues.map((issue) => ({ batchId: created.id, ...issue })),
      });
    }
    await tx.auditLog.create({
      data: {
        actorId,
        action: "IMPORT_STAGED",
        entityType: "ImportBatch",
        entityId: created.id,
        summary: "Libro cargado a staging; no se generaron cargos ni movimientos.",
        metadata: { sha256: preview.sha256, sheets: preview.sheetCount, rows: keptRows.length, issues: preview.issues.length },
      },
    });
    return created;
  });
  return { batch, duplicate: false, preview };
}

export async function approveImportBatch(batchId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.findUnique({
      where: { id: batchId },
      include: { _count: { select: { issues: { where: { status: "PENDING" } }, rows: { where: { status: "PENDING" } } } } },
    });
    if (!batch) throw new Error("Lote de importación no encontrado.");
    if (batch._count.issues || batch._count.rows) {
      throw new Error("No se puede aprobar mientras existan filas o incidencias pendientes.");
    }
    const updated = await tx.importBatch.update({
      where: { id: batchId },
      data: { status: "APPROVED", approvedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "IMPORT_APPROVED",
        entityType: "ImportBatch",
        entityId: batchId,
        summary: "Staging aprobado después de resolver todas las revisiones.",
      },
    });
    return updated;
  });
}
