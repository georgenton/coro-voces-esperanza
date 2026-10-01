import { assertCents } from "@/lib/money";
import { assertPeriod, periodMonth } from "@/lib/dates";

export type ChargeDecision =
  | { status: "CHARGEABLE"; amountCents: number; reason: null }
  | { status: "NOT_CHARGEABLE"; amountCents: 0; reason: string }
  | { status: "REVIEW_REQUIRED"; amountCents: null; reason: string };

export function decideCharge(input: {
  period: string;
  amountCents: number;
  excludeJanuary?: boolean;
  eligibilityConfirmed?: boolean;
  eligible?: boolean;
  exemptPeriods?: string[];
  overrideAmountCents?: number | null;
}) : ChargeDecision {
  assertPeriod(input.period);
  assertCents(input.amountCents, "Tarifa");
  if (input.eligibilityConfirmed === false) {
    return { status: "REVIEW_REQUIRED", amountCents: null, reason: "VIGENCIA_PENDIENTE" };
  }
  if (input.excludeJanuary && periodMonth(input.period) === 1) {
    return { status: "NOT_CHARGEABLE", amountCents: 0, reason: "ENERO_EXENTO" };
  }
  if (input.exemptPeriods?.includes(input.period)) {
    return { status: "NOT_CHARGEABLE", amountCents: 0, reason: "EXCEPCION_DE_PERIODO" };
  }
  if (input.eligible === false) {
    return { status: "NOT_CHARGEABLE", amountCents: 0, reason: "NO_ELEGIBLE" };
  }
  if (input.overrideAmountCents != null) {
    assertCents(input.overrideAmountCents, "Importe excepcional");
    return { status: "CHARGEABLE", amountCents: input.overrideAmountCents, reason: null };
  }
  return { status: "CHARGEABLE", amountCents: input.amountCents, reason: null };
}

export function chargeDedupeKey(input: {
  memberId: string;
  conceptId: string;
  period: string;
  activityId?: string | null;
}) {
  assertPeriod(input.period);
  return [input.memberId, input.conceptId, input.activityId ?? "ordinary", input.period].join(":");
}
