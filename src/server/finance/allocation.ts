import { assertCents, safeCentsSum } from "@/lib/money";

export type AllocationInput = { chargeId: string; amountCents: number };
export type PaymentPartInput = {
  memberId: string;
  amountCents: number;
  note?: string;
  allocations: AllocationInput[];
};

export type ChargeBalance = { id: string; memberId: string; outstandingCents: number };

export function validateAllocationPlan(input: {
  totalCents: number;
  parts: PaymentPartInput[];
  charges: ChargeBalance[];
}) {
  assertCents(input.totalCents, "Total del depósito", false);
  const chargeById = new Map(input.charges.map((charge) => [charge.id, charge]));
  const usedByCharge = new Map<string, number>();
  let identifiedCents = 0;
  let appliedCents = 0;
  const memberCredits: Array<{ memberId: string; amountCents: number }> = [];

  for (const part of input.parts) {
    if (!part.memberId) throw new Error("Cada parte necesita un miembro.");
    assertCents(part.amountCents, "Parte identificada", false);
    identifiedCents = safeCentsSum([identifiedCents, part.amountCents]);
    let partApplied = 0;
    const seenCharges = new Set<string>();
    for (const allocation of part.allocations) {
      if (seenCharges.has(allocation.chargeId)) throw new Error("Un cargo está repetido dentro de la misma parte.");
      seenCharges.add(allocation.chargeId);
      assertCents(allocation.amountCents, "Aplicación", false);
      const charge = chargeById.get(allocation.chargeId);
      if (!charge || charge.memberId !== part.memberId) {
        throw new Error("La aplicación no pertenece al miembro seleccionado.");
      }
      const totalForCharge = safeCentsSum([
        usedByCharge.get(charge.id) ?? 0,
        allocation.amountCents,
      ]);
      if (totalForCharge > charge.outstandingCents) {
        throw new Error("La distribución excede el saldo de un cargo.");
      }
      usedByCharge.set(charge.id, totalForCharge);
      partApplied = safeCentsSum([partApplied, allocation.amountCents]);
    }
    if (partApplied > part.amountCents) {
      throw new Error("Las aplicaciones exceden la parte asignada al miembro.");
    }
    appliedCents = safeCentsSum([appliedCents, partApplied]);
    memberCredits.push({ memberId: part.memberId, amountCents: part.amountCents - partApplied });
  }
  if (identifiedCents > input.totalCents) {
    throw new Error("Las partes identificadas exceden el importe del depósito.");
  }
  return {
    identifiedCents,
    appliedCents,
    unidentifiedCents: input.totalCents - identifiedCents,
    memberCredits,
  };
}
