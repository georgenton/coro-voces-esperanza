import { MemberStatus } from "@/generated/prisma/client";
import { describe, expect, it } from "vitest";
import { annualDuesCellStatus } from "@/server/reports/annual-dues";

const base = { cutoffPeriod: "2026-10", memberStatus: MemberStatus.ACTIVE, chargeCount: 0, dueCents: 0, appliedCents: 0, pendingCents: 0 };

describe("estados de la matriz anual", () => {
  it("distingue enero no exigible, futuro, ausencia de importación y revisión", () => {
    expect(annualDuesCellStatus({ ...base, period: "2026-01" })).toBe("NOT_DUE");
    expect(annualDuesCellStatus({ ...base, period: "2026-11" })).toBe("FUTURE");
    expect(annualDuesCellStatus({ ...base, period: "2026-09" })).toBe("NOT_IMPORTED");
    expect(annualDuesCellStatus({ ...base, period: "2026-09", memberStatus: MemberStatus.REVIEW_REQUIRED })).toBe("REVIEW");
  });

  it("muestra adelanto futuro sin convertirlo en cobro bancario del mes", () => {
    expect(annualDuesCellStatus({ ...base, period: "2026-12", chargeCount: 1, dueCents: 500, appliedCents: 500 })).toBe("ADVANCE");
  });

  it("separa pagado, parcial y pendiente", () => {
    expect(annualDuesCellStatus({ ...base, period: "2026-09", chargeCount: 1, dueCents: 500, appliedCents: 500 })).toBe("PAID");
    expect(annualDuesCellStatus({ ...base, period: "2026-09", chargeCount: 1, dueCents: 500, appliedCents: 300, pendingCents: 200 })).toBe("PARTIAL");
    expect(annualDuesCellStatus({ ...base, period: "2026-09", chargeCount: 1, dueCents: 500, pendingCents: 500 })).toBe("PENDING");
  });
});
