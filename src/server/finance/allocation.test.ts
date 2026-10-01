import { describe, expect, it } from "vitest";
import { validateAllocationPlan } from "@/server/finance/allocation";

const charges = [
  { id: "q-a", memberId: "a", outstandingCents: 500 },
  { id: "q-b", memberId: "b", outstandingCents: 500 },
  { id: "p-b", memberId: "b", outstandingCents: 200 },
  { id: "q2-a", memberId: "a", outstandingCents: 500 },
  { id: "q3-a", memberId: "a", outstandingCents: 500 },
  { id: "p-a", memberId: "a", outstandingCents: 600 },
];

describe("distribución de pagos", () => {
  it("C12 distribuye 12 como 5+5+2 entre dos miembros", () => {
    const result = validateAllocationPlan({ totalCents: 1200, charges, parts: [
      { memberId: "a", amountCents: 500, allocations: [{ chargeId: "q-a", amountCents: 500 }] },
      { memberId: "b", amountCents: 700, allocations: [{ chargeId: "q-b", amountCents: 500 }, { chargeId: "p-b", amountCents: 200 }] },
    ] });
    expect(result).toMatchObject({ identifiedCents: 1200, appliedCents: 1200, unidentifiedCents: 0 });
  });

  it("C13 distribuye 21 entre tres cuotas y parqueadero", () => {
    const result = validateAllocationPlan({ totalCents: 2100, charges, parts: [{ memberId: "a", amountCents: 2100, allocations: [
      { chargeId: "q-a", amountCents: 500 }, { chargeId: "q2-a", amountCents: 500 }, { chargeId: "q3-a", amountCents: 500 }, { chargeId: "p-a", amountCents: 600 },
    ] }] });
    expect(result.appliedCents).toBe(2100);
  });

  it("C14 admite un pago parcial", () => {
    expect(validateAllocationPlan({ totalCents: 300, charges, parts: [{ memberId: "a", amountCents: 300, allocations: [{ chargeId: "q-a", amountCents: 300 }] }] }).appliedCents).toBe(300);
  });

  it("C15 deja 5 de crédito cuando se asignan 20 y se aplican 15", () => {
    const result = validateAllocationPlan({ totalCents: 2000, charges, parts: [{ memberId: "a", amountCents: 2000, allocations: [{ chargeId: "q-a", amountCents: 500 }, { chargeId: "q2-a", amountCents: 500 }, { chargeId: "q3-a", amountCents: 500 }] }] });
    expect(result.memberCredits[0].amountCents).toBe(500);
  });

  it("C16 rechaza repartir 13 desde un depósito de 12", () => {
    expect(() => validateAllocationPlan({ totalCents: 1200, charges, parts: [{ memberId: "a", amountCents: 1300, allocations: [] }] })).toThrow(/exceden/);
  });

  it("rechaza aplicar a un cargo de otro miembro o sobreaplicarlo", () => {
    expect(() => validateAllocationPlan({ totalCents: 500, charges, parts: [{ memberId: "a", amountCents: 500, allocations: [{ chargeId: "q-b", amountCents: 500 }] }] })).toThrow(/pertenece/);
    expect(() => validateAllocationPlan({ totalCents: 600, charges, parts: [{ memberId: "a", amountCents: 600, allocations: [{ chargeId: "q-a", amountCents: 600 }] }] })).toThrow(/saldo/);
  });
});
