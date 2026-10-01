import { MovementDirection, MovementStatus, MovementType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isFinanceRole, isGlobalReadRole, type AccessContext } from "@/lib/access";

function scopedMemberWhere(access: AccessContext) {
  if (isGlobalReadRole(access)) return {};
  if (access.memberId) return { id: access.memberId };
  return { currentSectionId: { in: access.sectionIds } };
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
      where: { memberId: { in: memberIds }, movement: { status: MovementStatus.CONFIRMED } },
      include: { allocations: { select: { amountCents: true, charge: { select: { period: true } } } } },
    }),
    finance ? prisma.moneyMovement.findMany({ where: { status: MovementStatus.CONFIRMED } }) : Promise.resolve([]),
    finance ? prisma.financialAccount.findMany({ where: { isActive: true } }) : Promise.resolve([]),
    finance ? prisma.importBatch.count({ where: { status: { in: ["STAGING", "REVIEW_REQUIRED"] } } }) : Promise.resolve(0),
    finance ? prisma.reconciliationCandidate.count({ where: { status: { in: ["RECEIVED", "EXTRACTION_PENDING", "REVIEW_REQUIRED", "POSSIBLE_DUPLICATE"] } } }) : Promise.resolve(0),
  ]);

  let grossDueCents = 0;
  let appliedCents = 0;
  let overdueCents = 0;
  const now = new Date();
  for (const charge of charges) {
    const due = charge.amountCents + charge.adjustments.reduce((sum, item) => sum + item.amountCents, 0);
    const applied = charge.allocations.reduce((sum, item) => sum + item.amountCents, 0);
    grossDueCents += due;
    appliedCents += applied;
    if (charge.dueOn && charge.dueOn < now) overdueCents += Math.max(0, due - applied);
  }
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

  const accountBalances = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    cents: movements
      .filter((movement) => movement.cashEffect && movement.accountId === account.id)
      .reduce(
        (sum, movement) =>
          sum + (movement.direction === MovementDirection.IN ? movement.amountCents : -movement.amountCents),
        0,
      ),
  }));
  const externalIncomeCents = movements
    .filter((movement) =>
      movement.cashEffect &&
      movement.direction === MovementDirection.IN &&
      movement.type !== MovementType.INTERNAL_TRANSFER &&
      movement.type !== MovementType.OPENING_BALANCE,
    )
    .reduce((sum, movement) => sum + movement.amountCents, 0);
  const externalExpenseCents = movements
    .filter((movement) =>
      movement.cashEffect && movement.direction === MovementDirection.OUT && movement.type !== MovementType.INTERNAL_TRANSFER,
    )
    .reduce((sum, movement) => sum + movement.amountCents, 0);

  return {
    memberCount: memberIds.length,
    grossDueCents,
    appliedCents,
    pendingCents: Math.max(0, grossDueCents - appliedCents),
    overdueCents,
    memberCreditCents,
    advanceCents,
    unidentifiedCents,
    externalIncomeCents,
    externalExpenseCents,
    accountBalances,
    pendingImports,
    pendingCandidates,
  };
}
