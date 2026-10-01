import { describe, expect, it } from "vitest";
import {
  hashApprovedMapping,
  hashTransformation,
  importTransformationSchema,
  suggestIdentityMatches,
} from "@/server/imports/mapping";

describe("contrato de mapeo de importación", () => {
  it("produce hashes estables aunque cambie el orden de propiedades", () => {
    const left = { type: "IDENTITY_LINK", memberId: "m1", sourceName: "Persona Ejemplo" };
    const right = { sourceName: "Persona Ejemplo", memberId: "m1", type: "IDENTITY_LINK" };
    expect(hashTransformation("IDENTITY_LINK", left)).toBe(hashTransformation("IDENTITY_LINK", right));
    const rows = [{ id: "r1", recordFingerprint: "f1", status: "APPROVED", proposedType: "IDENTITY_LINK", transformed: left }];
    expect(hashApprovedMapping(rows)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("no admite movimiento confirmado sin fecha real aprobada", () => {
    const parsed = importTransformationSchema.safeParse({
      type: "MONEY_MOVEMENT",
      accountId: "a1",
      movementType: "PAYMENT",
      direction: "IN",
      amountCents: 500,
    });
    expect(parsed.success).toBe(false);
  });

  it("representa una aplicación LEGACY sin inventar movimiento ni fecha", () => {
    const parsed = importTransformationSchema.parse({
      type: "LEGACY_ALLOCATION",
      memberId: "m1",
      conceptId: "c1",
      period: "2026-02",
      chargeAmountCents: 500,
      appliedAmountCents: 500,
      appliedOn: null,
    });
    expect(parsed.type).toBe("LEGACY_ALLOCATION");
    if (parsed.type !== "LEGACY_ALLOCATION") throw new Error("Tipo inesperado");
    expect("movementId" in parsed).toBe(false);
    expect(parsed.appliedOn).toBeNull();
  });

  it("una coincidencia aproximada solo se presenta como posible", () => {
    const suggestions = suggestIdentityMatches("Ana Ejemplo | 5", [
      { id: "m1", displayName: "Ana María Ejemplo", normalizedName: "ana maria ejemplo" },
      { id: "m2", displayName: "Otra Persona", normalizedName: "otra persona" },
    ]);
    expect(suggestions).toEqual([{ memberId: "m1", displayName: "Ana María Ejemplo", kind: "POSSIBLE", score: 2 / 3 }]);
  });
});
