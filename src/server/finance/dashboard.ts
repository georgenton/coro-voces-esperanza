import { AppRole, MovementDirection, MovementStatus, MovementType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isFinanceRole, isGlobalReadRole, type AccessContext } from "@/lib/access";
import { summarizeCharges, summarizeMovements } from "@/server/reports/definitions";

function periodBounds(period: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error("Período inválido.");
  const [year, month] = period.split("-").map(Number);
  const start = new Date(`${period}-01T00:00:00-05:00`);
  const endYear = month === 12 ? year + 1 : year;
  const endMonth = month === 12 ? 1 : month + 1;
  const end = new Date(`${endYear}-${String(endMonth).padStart(2, "0")}-01T00:00:00-05:00`);
  const trendPeriods = Array.from({ length: 6 }, (_, offset) => {
    const date = new Date(Date.UTC(year, month - 1 - (5 - offset), 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  return { start, end, trendPeriods };
}

function movementPeriod(date: Date | null) {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "America/Guayaquil",
  }).format(date).slice(0, 7);
}

function scopedMemberWhere(access: AccessContext) {
  if (isGlobalReadRole(access)) return {};
  if (access.roles.includes(AppRole.JEFE_DE_CUERDA)) return { currentSectionId: { in: access.sectionIds } };
  return access.memberId ? { id: access.memberId } : { id: { in: [] } };
}

export async function getDashboard(access: AccessContext, cutoffPeriod: string) {
  const finance = isFinanceRole(access);
  const { start, end, trendPeriods } = periodBounds(cutoffPeriod);
  const members = await prisma.member.findMany({
    where: scopedMemberWhere(access),
    select: { id: true, currentSection: { select: { id: true, name: true } } },
  });
  const memberIds = members.map(({ id }) => id);
  const [charges, parts, movements, accounts, pendingImports, pendingCandidates] = await Promise.all([
    prisma.charge.findMany({
      where: { memberId: { in: memberIds }, period: { lte: cutoffPeriod }, status: { not: "VOIDED" } },
      include: {
        allocations: { select: { amountCents: true } },
        adjustments: { select: { amountCents: true } },
        member: { select: { currentSection: { select: { id: true, name: true } } } },
      },
    }),
    prisma.paymentPart.findMany({
      where: {
        memberId: { in: memberIds },
        OR: [{ movement: { status: MovementStatus.CONFIRMED } }, { isLegacy: true, cashEffect: false }],
      },
      include: {
        movement: { select: { occurredAt: true } },
        allocations: { select: { amountCents: true, charge: { select: { period: true } } } },
      },
    }),
    finance ? prisma.moneyMovement.findMany({ where: { status: MovementStatus.CONFIRMED, occurredAt: { lt: end } } }) : Promise.resolve([]),
    finance ? prisma.financialAccount.findMany({ where: { isActive: true } }) : Promise.resolve([]),
    finance ? prisma.importBatch.count({ where: { status: { in: ["STAGING", "REVIEW_REQUIRED"] } } }) : Promise.resolve(0),
    finance ? prisma.reconciliationCandidate.count({ where: { status: { in: ["RECEIVED", "EXTRACTION_PENDING", "REVIEW_REQUIRED", "POSSIBLE_DUPLICATE"] } } }) : Promise.resolve(0),
  ]);

  const chargeSummary = summarizeCharges(charges);
  const memberCreditCents = parts.reduce((sum, part) => {
    const applied = part.allocations.reduce((value, allocation) => value + allocation.amountCents, 0);
    return sum + Math.max(0, part.amountCents - applied);
  }, 0);
  const advanceCents = parts.reduce(
    (sum, part) =>
      sum + part.allocations
        .filter(({ charge }) => charge.period > cutoffPeriod)
        .reduce((value, allocation) => value + allocation.amountCents, 0),
    0,
  );
  const periodMovements = movements.filter((movement) => movement.occurredAt && movement.occurredAt >= start && movement.occurredAt < end);
  const identifiedCents = periodMovements.reduce(
    (sum, movement) =>
      sum +
      (movement.cashEffect && movement.type === MovementType.PAYMENT && movement.direction === MovementDirection.IN
        ? movement.amountCents
        : 0),
    0,
  );
  const assignedCents = parts
    .filter((part) => part.cashEffect && part.movement?.occurredAt && part.movement.occurredAt >= start && part.movement.occurredAt < end)
    .reduce((sum, part) => sum + part.amountCents, 0);
  const unidentifiedCents = Math.max(0, identifiedCents - assignedCents);

  const movementSummary = summarizeMovements(periodMovements);
  const balanceSummary = summarizeMovements(movements);
  const accountBalances = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    cents: balanceSummary.accountBalances.get(account.id) ?? 0,
  }));
  const monthlyTrend = trendPeriods.map((period) => {
    const summary = summarizeMovements(movements.filter((movement) => movementPeriod(movement.occurredAt) === period));
    return { period, incomeCents: summary.externalIncomeCents, expenseCents: summary.externalExpenseCents };
  });
  const sectionMap = new Map<string, { id: string | null; name: string; memberIds: Set<string>; dueCents: number; appliedCents: number; pendingCents: number }>();
  for (const member of members) {
    const key = member.currentSection?.id ?? "unassigned";
    sectionMap.set(key, sectionMap.get(key) ?? {
      id: member.currentSection?.id ?? null,
      name: member.currentSection?.name ?? "Sin cuerda asignada",
      memberIds: new Set(),
      dueCents: 0,
      appliedCents: 0,
      pendingCents: 0,
    });
    sectionMap.get(key)!.memberIds.add(member.id);
  }
  for (const charge of charges) {
    const key = charge.member.currentSection?.id ?? "unassigned";
    const section = sectionMap.get(key);
    if (!section) continue;
    const summary = summarizeCharges([charge]);
    section.dueCents += summary.grossDueCents;
    section.appliedCents += summary.appliedCents;
    section.pendingCents += summary.pendingCents;
  }
  const sectionSummary = [...sectionMap.values()]
    .map(({ memberIds: ids, ...section }) => ({ ...section, memberCount: ids.size }))
    .sort((left, right) => right.pendingCents - left.pendingCents || left.name.localeCompare(right.name, "es"));

  return {
    memberCount: memberIds.length,
    ...chargeSummary,
    memberCreditCents,
    advanceCents,
    unidentifiedCents,
    externalIncomeCents: movementSummary.externalIncomeCents,
    externalExpenseCents: movementSummary.externalExpenseCents,
    accountBalances,
    monthlyTrend,
    sectionSummary,
    pendingImports,
    pendingCandidates,
  };
}
