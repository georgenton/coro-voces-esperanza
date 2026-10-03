import { AppRole, MovementDirection, MovementStatus, MovementType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isFinanceRole, isGlobalReadRole, type AccessContext } from "@/lib/access";
import { summarizeCharges, summarizeMovements } from "@/server/reports/definitions";

function scopedMemberWhere(access: AccessContext) {
  if (isGlobalReadRole(access)) return {};
  if (access.roles.includes(AppRole.JEFE_DE_CUERDA)) return { currentSectionId: { in: access.sectionIds } };
  return access.memberId ? { id: access.memberId } : { id: { in: [] } };
}

export async function getDashboard(access: AccessContext, cutoffPeriod: string) {
  const finance = isFinanceRole(access);
  const members = await prisma.member.findMany({
    where: scopedMemberWhere(access),
    select: { id: true },
  });
  const memberIds = members.map(({ id }) => id);
  const [charges, parts, movements, accounts, pendingImports, pendingCandidates] = await Promise.all([
    prisma.charge.findMany({
      where: { memberId: { in: memberIds }, period: { lte: cutoffPeriod }, status: { not: "VOIDED" } },
      include: { allocations: { select: { amountCents: true } }, adjustments: { select: { amountCents: true } } },
    }),
    prisma.paymentPart.findMany({
      where: {
        memberId: { in: memberIds },
        OR: [{ movement: { status: MovementStatus.CONFIRMED } }, { isLegacy: true, cashEffect: false }],
      },
      include: { allocations: { select: { amountCents: true, charge: { select: { period: true } } } } },
    }),
    finance ? prisma.moneyMovement.findMany({ where: { status: MovementStatus.CONFIRMED } }) : Promise.resolve([]),
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
  const identifiedCents = movements.reduce(
    (sum, movement) =>
      sum +
      (movement.cashEffect && movement.type === MovementType.PAYMENT && movement.direction === MovementDirection.IN
        ? movement.amountCents
        : 0),
    0,
  );
  const assignedCents = parts.reduce((sum, part) => sum + part.amountCents, 0);
  const unidentifiedCents = Math.max(0, identifiedCents - assignedCents);

  const movementSummary = summarizeMovements(movements);
  const accountBalances = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    cents: movementSummary.accountBalances.get(account.id) ?? 0,
  }));

  return {
    memberCount: memberIds.length,
    ...chargeSummary,
    memberCreditCents,
    advanceCents,
    unidentifiedCents,
    externalIncomeCents: movementSummary.externalIncomeCents,
    externalExpenseCents: movementSummary.externalExpenseCents,
    accountBalances,
    pendingImports,
    pendingCandidates,
  };
}
