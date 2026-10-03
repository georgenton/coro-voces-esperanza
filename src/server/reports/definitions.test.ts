import { MovementDirection, MovementType } from "@/generated/prisma/client";
import { describe, expect, it } from "vitest";
import { summarizeAccountPeriod, summarizeCharges, summarizeMovements } from "@/server/reports/definitions";

describe("definiciones únicas de reportes", () => {
  it("mantiene iguales cargo, aplicado y pendiente para dashboard, tabla y exportación", () => {
    const charges = [
      { amountCents: 500, dueOn: new Date("2026-02-28T05:00:00Z"), adjustments: [], allocations: [{ amountCents: 300 }] },
      { amountCents: 500, dueOn: new Date("2026-03-31T05:00:00Z"), adjustments: [{ amountCents: -100 }], allocations: [{ amountCents: 400 }] },
    ];
    expect(summarizeCharges(charges, new Date("2026-10-01T05:00:00Z"))).toEqual({ grossDueCents: 900, appliedCents: 700, pendingCents: 200, overdueCents: 200 });
  });

  it("una transferencia afecta cuentas pero queda neutra en el consolidado", () => {
    const movements = [
      { accountId: "operativa", amountCents: 10_000, direction: MovementDirection.OUT, type: MovementType.INTERNAL_TRANSFER, cashEffect: true },
      { accountId: "ahorro", amountCents: 10_000, direction: MovementDirection.IN, type: MovementType.INTERNAL_TRANSFER, cashEffect: true },
      { accountId: "ahorro", amountCents: 100, direction: MovementDirection.IN, type: MovementType.INTEREST, cashEffect: true },
    ];
    const summary = summarizeMovements(movements);
    expect(summary.externalIncomeCents).toBe(100);
    expect(summary.externalExpenseCents).toBe(0);
    expect([...summary.accountBalances.values()].reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it("el subtotal filtrado no altera el saldo final del período completo", () => {
    const movements = [
      { accountId: "a", amountCents: 2_800, direction: MovementDirection.IN, type: MovementType.PAYMENT, cashEffect: true },
      { accountId: "a", amountCents: 10_000, direction: MovementDirection.OUT, type: MovementType.EXPENSE, cashEffect: true },
    ];
    expect(summarizeAccountPeriod(4_621, movements)).toEqual({ openingCents: 4_621, entriesCents: 2_800, exitsCents: 10_000, closingCents: -2_579 });
    expect(summarizeAccountPeriod(4_621, movements.slice(0, 1)).closingCents).not.toBe(-2_579);
  });
});
