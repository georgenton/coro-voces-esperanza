import { EvidenceStatus, MovementStatus, MovementType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { assertPeriod } from "@/lib/dates";
import { signedMovement, summarizeAccountPeriod } from "@/server/reports/definitions";

const PAGE_SIZE = 30;

function periodBounds(period: string) {
  assertPeriod(period);
  const [year, month] = period.split("-").map(Number);
  const start = new Date(`${period}-01T00:00:00-05:00`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00-05:00`);
  return { start, end };
}

export async function getMonthlyAccountReport(input: {
  period: string;
  accountId?: string;
  movementType?: string;
  query?: string;
  page?: number;
  paginate?: boolean;
}) {
  const { start, end } = periodBounds(input.period);
  const page = Number.isSafeInteger(input.page) && input.page && input.page > 0 ? Math.min(input.page, 10_000) : 1;
  const query = input.query?.trim().slice(0, 100) || undefined;
  const paginate = input.paginate !== false;
  const accounts = await prisma.financialAccount.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const accountId = input.accountId && accounts.some(({ id }) => id === input.accountId) ? input.accountId : undefined;
  const movementType = Object.values(MovementType).includes(input.movementType as MovementType)
    ? input.movementType as MovementType
    : undefined;
  const baseWhere: Prisma.MoneyMovementWhereInput = {
    status: MovementStatus.CONFIRMED,
    occurredAt: { gte: start, lt: end },
    ...(accountId ? { accountId } : {}),
  };
  const filteredWhere: Prisma.MoneyMovementWhereInput = {
    ...baseWhere,
    ...(movementType ? { type: movementType } : {}),
    ...(query ? { OR: [
      { description: { contains: query, mode: "insensitive" } },
      { externalReference: { contains: query, mode: "insensitive" } },
      { account: { name: { contains: query, mode: "insensitive" } } },
    ] } : {}),
  };
  const openingWhere: Prisma.MoneyMovementWhereInput = {
    status: MovementStatus.CONFIRMED,
    occurredAt: { lt: start },
    ...(accountId ? { accountId } : {}),
  };

  const [openingMovements, fullPeriod, filteredMovements, totalFiltered, movements, sourceSheet] = await Promise.all([
    prisma.moneyMovement.findMany({ where: openingWhere, select: { amountCents: true, direction: true, cashEffect: true } }),
    prisma.moneyMovement.findMany({
      where: baseWhere,
      include: { account: true, reconciliationCandidate: true },
      orderBy: [{ occurredAt: "asc" }, { recordedAt: "asc" }, { id: "asc" }],
    }),
    prisma.moneyMovement.findMany({ where: filteredWhere, select: { accountId: true, amountCents: true, direction: true, type: true, cashEffect: true } }),
    prisma.moneyMovement.count({ where: filteredWhere }),
    prisma.moneyMovement.findMany({
      where: filteredWhere,
      include: {
        account: true,
        reconciliationCandidate: true,
        paymentParts: {
          include: {
            member: { select: { id: true, displayName: true } },
            allocations: {
              include: {
                charge: { select: { id: true, period: true, concept: { select: { name: true } } } },
              },
              orderBy: { recordedAt: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ occurredAt: "asc" }, { recordedAt: "asc" }, { id: "asc" }],
      ...(paginate ? { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE } : {}),
    }),
    prisma.importSheet.findFirst({
      where: { nominalPeriod: input.period },
      orderBy: { batch: { createdAt: "desc" } },
      select: { coverageStatus: true, batch: { select: { status: true, sha256: true } } },
    }),
  ]);

  const openingCents = openingMovements.reduce((sum, movement) => sum + signedMovement(movement), 0);
  const periodTotals = summarizeAccountPeriod(openingCents, fullPeriod);
  const filteredTotals = summarizeAccountPeriod(0, filteredMovements);
  const allExplicitlyReconciled = fullPeriod.length > 0 && fullPeriod.every(({ reconciliationCandidate }) => reconciliationCandidate?.status === EvidenceStatus.CONFIRMED);
  const coverageState = sourceSheet?.coverageStatus === "PARTIAL"
    ? "PARTIAL"
    : fullPeriod.length === 0 && sourceSheet
      ? "NOT_IMPORTED"
      : fullPeriod.length === 0
        ? "EMPTY"
        : allExplicitlyReconciled
          ? "RECONCILED"
          : "WITH_MOVEMENTS";
  const latestReconciledAt = fullPeriod
    .filter(({ reconciliationCandidate }) => reconciliationCandidate?.status === EvidenceStatus.CONFIRMED)
    .flatMap(({ occurredAt }) => occurredAt ? [occurredAt] : [])
    .toSorted((left, right) => right.getTime() - left.getTime())[0] ?? null;

  return {
    period: input.period,
    accounts,
    accountId,
    movementType,
    query,
    movements,
    periodTotals,
    filteredTotals,
    coverageState,
    latestReconciledAt,
    sourceCoverage: sourceSheet ? { status: sourceSheet.coverageStatus, sha256: sourceSheet.batch.sha256, batchStatus: sourceSheet.batch.status } : null,
    pagination: { page, pageSize: paginate ? PAGE_SIZE : totalFiltered || 1, totalRows: totalFiltered, totalPages: paginate ? Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE)) : 1 },
  };
}
