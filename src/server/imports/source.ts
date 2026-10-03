import { prisma } from "@/lib/db";
import { compareSourceRows, type SourceDiffStatus } from "@/server/imports/comparison";

const PAGE_SIZE = 40;

function safePage(value: number | undefined) {
  return Number.isSafeInteger(value) && value && value > 0 ? Math.min(value, 10_000) : 1;
}

export async function getHistoricalSourceView(input: {
  batchId: string;
  sheetName?: string;
  query?: string;
  page?: number;
}) {
  const batch = await prisma.importBatch.findUnique({
    where: { id: input.batchId },
    include: {
      sourceSheets: true,
      issues: { orderBy: [{ status: "asc" }, { createdAt: "asc" }] },
      _count: { select: { rows: true, sourceCells: true } },
    },
  });
  if (!batch) throw new Error("Lote histórico no encontrado.");

  const sheetNames = new Set(batch.sourceSheets.map(({ name }) => name));
  const sheetName = input.sheetName && sheetNames.has(input.sheetName) ? input.sheetName : undefined;
  const query = input.query?.trim().slice(0, 100) || undefined;
  const page = safePage(input.page);
  const where = {
    batchId: batch.id,
    ...(sheetName ? { sheetName } : {}),
    ...(query ? { rawText: { contains: query, mode: "insensitive" as const } } : {}),
  };

  const [totalRows, rows, currentRows, previousBatch] = await Promise.all([
    prisma.importRow.count({ where }),
    prisma.importRow.findMany({
      where,
      orderBy: [{ nominalPeriod: "asc" }, { sheetName: "asc" }, { rowNumber: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { publications: true } } },
    }),
    prisma.importRow.findMany({
      where: { batchId: batch.id },
      select: { id: true, sheetName: true, rowNumber: true, contentFingerprint: true, semanticKey: true, _count: { select: { publications: true } } },
    }),
    prisma.importBatch.findFirst({
      where: { id: { not: batch.id }, originalName: batch.originalName, createdAt: { lt: batch.createdAt } },
      orderBy: { createdAt: "desc" },
      select: { id: true, originalName: true, sha256: true, createdAt: true },
    }),
  ]);

  const previousRows = previousBatch ? await prisma.importRow.findMany({
    where: { batchId: previousBatch.id },
    select: { id: true, sheetName: true, rowNumber: true, contentFingerprint: true, semanticKey: true, _count: { select: { publications: true } } },
  }) : [];
  const comparison = compareSourceRows(
    currentRows.map((row) => ({ ...row, publicationCount: row._count.publications })),
    previousRows.map((row) => ({ ...row, publicationCount: row._count.publications })),
  );
  const statusByCurrentId = new Map<string, SourceDiffStatus>();
  for (const difference of comparison.differences) {
    if (difference.currentRowId) statusByCurrentId.set(difference.currentRowId, difference.status);
  }

  const sheets = batch.sourceSheets.toSorted((left, right) => {
    if (left.kind === "MONTHLY_MOVEMENTS" && right.kind === "MONTHLY_MOVEMENTS") return (left.nominalPeriod ?? "").localeCompare(right.nominalPeriod ?? "");
    if (left.kind === "MONTHLY_MOVEMENTS") return 1;
    if (right.kind === "MONTHLY_MOVEMENTS") return -1;
    return left.physicalOrder - right.physicalOrder;
  });

  return {
    batch,
    sheets,
    rows: rows.map((row) => ({ ...row, comparisonStatus: statusByCurrentId.get(row.id) ?? "NEW" as SourceDiffStatus })),
    pagination: { page, pageSize: PAGE_SIZE, totalRows, totalPages: Math.max(1, Math.ceil(totalRows / PAGE_SIZE)) },
    comparison: { ...comparison, previousBatch },
  };
}
