import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createAttendanceToken } from "@/server/attendance/tokens";
import { checkInWithToken } from "@/server/attendance/service";
import { prisma } from "@/lib/db";
import { allocateExistingPayment, registerAndAllocatePayment } from "@/server/finance/payments";
import { registerExpense, registerInterest, registerInternalTransfer } from "@/server/finance/treasury";

describe("integración PostgreSQL", () => {
  let actorId: string;
  let memberId: string;
  let accountId: string;
  let savingsAccountId: string;
  let activityId: string;
  let chargeId: string;

  beforeAll(async () => {
    const suffix = randomUUID();
    const actor = await prisma.user.create({ data: { id: `user-${suffix}`, name: "Tesorería Ficticia", email: `${suffix}@example.test`, emailVerified: true } });
    actorId = actor.id;
    const section = await prisma.voiceSection.create({ data: { name: `Sección ${suffix}` } });
    const member = await prisma.member.create({ data: { displayName: "Miembro Ficticio", originalName: "Miembro Ficticio", normalizedName: `miembro ficticio ${suffix}`, status: "ACTIVE", currentSectionId: section.id, authUserId: actor.id } });
    memberId = member.id;
    const account = await prisma.financialAccount.create({ data: { name: `Cuenta ${suffix}`, kind: "BANK" } });
    accountId = account.id;
    const savings = await prisma.financialAccount.create({ data: { name: `Ahorro ${suffix}`, kind: "SAVINGS" } });
    savingsAccountId = savings.id;
    activityId = (await prisma.activity.create({ data: { name: `Actividad ${suffix}`, status: "OPEN" } })).id;
    const concept = await prisma.billingConcept.create({ data: { systemKey: `TEST-${suffix}`, name: "Cuota ficticia", defaultAmountCents: 500 } });
    const charge = await prisma.charge.create({ data: { dedupeKey: `charge-${suffix}`, memberId, conceptId: concept.id, period: "2026-02", amountCents: 500 } });
    chargeId = charge.id;
  });

  it("confirma y aplica un pago de forma idempotente", async () => {
    const key = randomUUID();
    const input = { accountId, amountCents: 500, occurredAt: new Date(), idempotencyKey: key, parts: [{ memberId, amountCents: 500, allocations: [{ chargeId, amountCents: 500 }] }] };
    const first = await registerAndAllocatePayment(input, actorId);
    const second = await registerAndAllocatePayment(input, actorId);
    expect(second.id).toBe(first.id);
    expect(await prisma.allocation.count({ where: { chargeId } })).toBe(1);
    expect((await prisma.charge.findUniqueOrThrow({ where: { id: chargeId } })).status).toBe("PAID");
  });

  it("C38 conserva una sola asistencia ante dos solicitudes concurrentes", async () => {
    const now = new Date();
    const rehearsal = await prisma.rehearsal.create({ data: { title: "Ensayo ficticio", startsAt: new Date(now.getTime() - 5_000), endsAt: new Date(now.getTime() + 60_000), checkInOpensAt: new Date(now.getTime() - 60_000), checkInClosesAt: new Date(now.getTime() + 60_000), status: "OPEN", createdById: actorId } });
    await prisma.rehearsalInvitee.create({ data: { rehearsalId: rehearsal.id, memberId } });
    const token = createAttendanceToken(rehearsal.id, 60, now);
    const results = await Promise.all([checkInWithToken(token, actorId, now), checkInWithToken(token, actorId, now)]);
    expect(await prisma.attendance.count({ where: { rehearsalId: rehearsal.id, memberId } })).toBe(1);
    expect(results.some(({ duplicate }) => duplicate)).toBe(true);
  });

  it("registra ahorro, interés y gasto de actividad sin duplicar flujo", async () => {
    const transfer = await registerInternalTransfer({
      fromAccountId: accountId,
      toAccountId: savingsAccountId,
      amountCents: 10_000,
      occurredAt: new Date(),
      idempotencyKey: randomUUID(),
    }, actorId);
    const transferMovements = await prisma.moneyMovement.findMany({ where: { transferGroupId: transfer.groupId } });
    expect(transferMovements).toHaveLength(2);
    expect(transferMovements.reduce((sum, movement) => sum + (movement.direction === "IN" ? movement.amountCents : -movement.amountCents), 0)).toBe(0);

    const interest = await registerInterest({ accountId: savingsAccountId, amountCents: 100, occurredAt: new Date(), idempotencyKey: randomUUID() }, actorId);
    expect(interest.type).toBe("INTEREST");
    expect(interest.direction).toBe("IN");

    const expense = await registerExpense({ accountId, amountCents: 400, occurredAt: new Date(), description: "Compra ficticia", activityId, idempotencyKey: randomUUID() }, actorId);
    const linked = await prisma.activityExpense.findUniqueOrThrow({ where: { activityId_movementId: { activityId, movementId: expense.id } } });
    expect(linked.amountCents).toBe(400);
  });

  it("distribuye una entrada conciliada sin crear otro movimiento", async () => {
    const movement = await registerAndAllocatePayment({
      accountId,
      amountCents: 700,
      occurredAt: new Date(),
      idempotencyKey: randomUUID(),
      parts: [],
      source: "RECONCILIATION",
    }, actorId);
    const countBefore = await prisma.moneyMovement.count();
    await allocateExistingPayment({
      movementId: movement.id,
      idempotencyKey: randomUUID(),
      parts: [{ memberId, amountCents: 200, allocations: [] }],
    }, actorId);
    expect(await prisma.moneyMovement.count()).toBe(countBefore);
    expect(await prisma.paymentPart.count({ where: { movementId: movement.id } })).toBe(1);
  });
});
