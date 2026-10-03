import { MovementDirection, MovementType } from "@/generated/prisma/client";

export type ReportCharge = {
  amountCents: number;
  dueOn: Date | null;
  allocations: Array<{ amountCents: number }>;
  adjustments: Array<{ amountCents: number }>;
};

export type ReportMovement = {
  accountId: string;
  amountCents: number;
  direction: MovementDirection;
  type: MovementType;
  cashEffect: boolean;
};

export function chargeAmounts(charge: ReportCharge) {
  const dueCents = charge.amountCents + charge.adjustments.reduce((sum, item) => sum + item.amountCents, 0);
  const appliedCents = charge.allocations.reduce((sum, item) => sum + item.amountCents, 0);
  return { dueCents, appliedCents, pendingCents: Math.max(0, dueCents - appliedCents) };
}

export function summarizeCharges(charges: ReportCharge[], now = new Date()) {
  return charges.reduce((summary, charge) => {
    const amounts = chargeAmounts(charge);
    summary.grossDueCents += amounts.dueCents;
    summary.appliedCents += amounts.appliedCents;
    summary.pendingCents += amounts.pendingCents;
    if (charge.dueOn && charge.dueOn < now) summary.overdueCents += amounts.pendingCents;
    return summary;
  }, { grossDueCents: 0, appliedCents: 0, pendingCents: 0, overdueCents: 0 });
}

export function signedMovement(movement: Pick<ReportMovement, "amountCents" | "direction" | "cashEffect">) {
  if (!movement.cashEffect) return 0;
  return movement.direction === MovementDirection.IN ? movement.amountCents : -movement.amountCents;
}

export function summarizeMovements(movements: ReportMovement[]) {
  const accountBalances = new Map<string, number>();
  let externalIncomeCents = 0;
  let externalExpenseCents = 0;
  for (const movement of movements) {
    accountBalances.set(movement.accountId, (accountBalances.get(movement.accountId) ?? 0) + signedMovement(movement));
    if (!movement.cashEffect || movement.type === MovementType.INTERNAL_TRANSFER || movement.type === MovementType.OPENING_BALANCE) continue;
    if (movement.direction === MovementDirection.IN) externalIncomeCents += movement.amountCents;
    else externalExpenseCents += movement.amountCents;
  }
  return { externalIncomeCents, externalExpenseCents, accountBalances };
}

export function summarizeAccountPeriod(openingCents: number, movements: ReportMovement[]) {
  const entriesCents = movements
    .filter((movement) => movement.cashEffect && movement.direction === MovementDirection.IN)
    .reduce((sum, movement) => sum + movement.amountCents, 0);
  const exitsCents = movements
    .filter((movement) => movement.cashEffect && movement.direction === MovementDirection.OUT)
    .reduce((sum, movement) => sum + movement.amountCents, 0);
  return { openingCents, entriesCents, exitsCents, closingCents: openingCents + entriesCents - exitsCents };
}
