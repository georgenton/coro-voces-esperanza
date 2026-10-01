import { describe, expect, it } from "vitest";
import { chargeDedupeKey, decideCharge } from "@/server/finance/rules";

describe("reglas de cargos", () => {
  it("C01 genera 500 centavos para febrero", () => {
    expect(decideCharge({ period: "2026-02", amountCents: 500, eligible: true })).toEqual({ status: "CHARGEABLE", amountCents: 500, reason: null });
  });

  it("C03 excluye enero sin impedir otros períodos", () => {
    expect(decideCharge({ period: "2027-01", amountCents: 500, excludeJanuary: true }).amountCents).toBe(0);
    expect(decideCharge({ period: "2027-02", amountCents: 500, excludeJanuary: true }).amountCents).toBe(500);
  });

  it("C04 aplica la excepción solo a junio 2026", () => {
    expect(decideCharge({ period: "2026-06", amountCents: 500, exemptPeriods: ["2026-06"] }).amountCents).toBe(0);
    expect(decideCharge({ period: "2027-06", amountCents: 500, exemptPeriods: ["2026-06"] }).amountCents).toBe(500);
  });

  it("C06 deja vigencia desconocida en revisión", () => {
    expect(decideCharge({ period: "2026-05", amountCents: 500, eligibilityConfirmed: false }).status).toBe("REVIEW_REQUIRED");
  });

  it("C10 no cobra a quien no es elegible", () => {
    expect(decideCharge({ period: "2026-05", amountCents: 200, eligible: false }).amountCents).toBe(0);
  });

  it("C02 produce una clave estable por miembro, concepto, actividad y período", () => {
    const value = chargeDedupeKey({ memberId: "m1", conceptId: "c1", period: "2026-02" });
    expect(value).toBe(chargeDedupeKey({ memberId: "m1", conceptId: "c1", period: "2026-02" }));
    expect(value).not.toBe(chargeDedupeKey({ memberId: "m1", conceptId: "c1", activityId: "a1", period: "2026-02" }));
  });
});
