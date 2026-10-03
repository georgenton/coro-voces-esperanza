import { createHash, randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { AppRole } from "@/generated/prisma/client";
import { createAttendanceToken } from "@/server/attendance/tokens";
import { checkInWithToken } from "@/server/attendance/service";
import { prisma } from "@/lib/db";
import { allocateExistingPayment, registerAndAllocatePayment, reversePayment } from "@/server/finance/payments";
import { registerExpense, registerInterest, registerInternalTransfer } from "@/server/finance/treasury";
import { generateChargesForPeriod } from "@/server/finance/charges";
import { consumeInvitation } from "@/server/auth/invitations";
import { replaceUserAccess } from "@/server/auth/access";
import {
  approveImportBatch,
  createPromotionPreview,
  promoteImportPlan,
  resolveImportItem,
  saveImportRowMapping,
  stageWorkbook,
} from "@/server/imports/service";
import { getAnnualDuesReport } from "@/server/reports/annual-dues";
import { getMonthlyAccountReport } from "@/server/reports/monthly-account";

describe("integración PostgreSQL", () => {
  let actorId: string;
  let memberId: string;
  let accountId: string;
  let savingsAccountId: string;
  let activityId: string;
  let chargeId: string;
  let conceptId: string;

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
    conceptId = concept.id;
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

  it("promueve una aplicación LEGACY concurrente sin crear caja ni duplicados", async () => {
    const suffix = randomUUID();
    const batch = await prisma.importBatch.create({ data: {
      sha256: suffix.replaceAll("-", "").padEnd(64, "0").slice(0, 64),
      originalName: "matriz-sintetica.xlsx",
      storageKey: `synthetic/${suffix}.xlsx`,
      sizeBytes: 100,
      status: "REVIEW_REQUIRED",
      sheetCount: 1,
      importedById: actorId,
    } });
    const row = await prisma.importRow.create({ data: {
      batchId: batch.id,
      sheetName: "CUOTAS SINTETICAS",
      rowNumber: 7,
      rawText: "Miembro Ficticio | 5",
      recordFingerprint: randomUUID(),
    } });
    await saveImportRowMapping(row.id, {
      type: "LEGACY_ALLOCATION",
      memberId,
      conceptId,
      period: "2026-03",
      chargeAmountCents: 500,
      appliedAmountCents: 500,
      appliedOn: null,
    }, actorId);
    await resolveImportItem({ kind: "row", id: row.id, status: "APPROVED" }, actorId);
    await approveImportBatch(batch.id, actorId);
    const plan = await createPromotionPreview(batch.id, "FINANCE", actorId);
    const movementsBefore = await prisma.moneyMovement.count();
    const results = await Promise.all([promoteImportPlan(plan.id, actorId), promoteImportPlan(plan.id, actorId)]);
    expect(results.every(({ id }) => id === plan.id)).toBe(true);
    const part = await prisma.paymentPart.findUniqueOrThrow({ where: { sourceReference: `import:${batch.sha256}:${row.id}:LEGACY_PAYMENT_PART` } });
    expect(part).toMatchObject({ movementId: null, isLegacy: true, cashEffect: false, receivedAt: null });
    expect(await prisma.allocation.count({ where: { paymentPartId: part.id } })).toBe(1);
    expect(await prisma.moneyMovement.count()).toBe(movementsBefore);
    expect(await prisma.importPublication.count({ where: { rowId: row.id } })).toBe(2);
    await expect(saveImportRowMapping(row.id, { type: "IDENTITY_LINK", memberId, sourceName: "Miembro Ficticio" }, actorId)).rejects.toThrow("ya fue promovida");
  });

  it("C31 reimporta el mismo XLSX sintético sin crear otro lote", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("INDICE GENERAL").addRow(["Hoja", "Descripción"]);
    const sheet = workbook.addWorksheet("DATOS SINTETICOS");
    sheet.addRow(["Persona Ficticia", 500]);
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    const file = new File([bytes], "reimportacion-sintetica.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const first = await stageWorkbook(file, actorId);
    const second = await stageWorkbook(file, actorId);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.batch.id).toBe(first.batch.id);
    expect(first.preview).toMatchObject({ sheetCount: 2 });
    expect(await prisma.importSheet.count({ where: { batchId: first.batch.id } })).toBe(2);
    expect(await prisma.importRow.count({ where: { batchId: first.batch.id } })).toBe(2);
    expect(await prisma.importCell.count({ where: { batchId: first.batch.id } })).toBe(4);
  });

  it("C28 revierte el pago, elimina sus aplicaciones y reabre el cargo", async () => {
    const suffix = randomUUID();
    const charge = await prisma.charge.create({ data: {
      dedupeKey: `reverse-${suffix}`,
      memberId,
      conceptId,
      period: "2026-04",
      amountCents: 500,
    } });
    const payment = await registerAndAllocatePayment({
      accountId,
      amountCents: 500,
      occurredAt: new Date(),
      idempotencyKey: suffix,
      parts: [{ memberId, amountCents: 500, allocations: [{ chargeId: charge.id, amountCents: 500 }] }],
    }, actorId);
    const reversal = await reversePayment(payment.id, "Corrección sintética de integración", actorId);
    expect(reversal).toMatchObject({ type: "REVERSAL", direction: "OUT", amountCents: 500 });
    expect(await prisma.allocation.count({ where: { chargeId: charge.id } })).toBe(0);
    expect((await prisma.charge.findUniqueOrThrow({ where: { id: charge.id } })).status).toBe("PENDING");
  });

  it("invitación de un solo uso y revocación inmediata de sesión", async () => {
    const token = randomUUID();
    const email = `${randomUUID()}@example.test`;
    const invitation = await prisma.invitation.create({ data: {
      email,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 60_000),
      createdById: actorId,
      role: "MIEMBRO",
    } });
    const attempts = await Promise.allSettled([
      consumeInvitation({ token, password: "Synthetic-password-123", name: "Invitada Ficticia" }),
      consumeInvitation({ token, password: "Synthetic-password-123", name: "Invitada Ficticia" }),
    ]);
    expect(attempts.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect((await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } })).consumedAt).not.toBeNull();
    const invitedUser = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.session.create({ data: {
      id: randomUUID(),
      token: randomUUID(),
      userId: invitedUser.id,
      expiresAt: new Date(Date.now() + 60_000),
    } });
    const changed = await replaceUserAccess({ userId: invitedUser.id, roles: ["JEFE_DE_CUERDA"], sectionIds: [] }, actorId);
    expect(changed.revokedSessions).toBe(1);
    expect(await prisma.session.count({ where: { userId: invitedUser.id } })).toBe(0);
    expect(await prisma.userRole.findMany({ where: { userId: invitedUser.id }, select: { role: true } })).toEqual([{ role: "JEFE_DE_CUERDA" }]);
  });

  it("C02 genera un solo cargo ante ejecuciones concurrentes", async () => {
    await prisma.chargeRule.create({ data: {
      conceptId,
      startsPeriod: "2027-02",
      endsPeriod: "2027-02",
      amountCents: 500,
      excludeJanuary: true,
    } });
    await Promise.all([generateChargesForPeriod("2027-02", actorId), generateChargesForPeriod("2027-02", actorId)]);
    expect(await prisma.charge.count({ where: { memberId, conceptId, period: "2027-02" } })).toBe(1);
  });

  it("C17 dos pagos concurrentes no sobreaplican el mismo cargo", async () => {
    const suffix = randomUUID();
    const charge = await prisma.charge.create({ data: {
      dedupeKey: `concurrent-${suffix}`,
      memberId,
      conceptId,
      period: "2027-03",
      amountCents: 500,
    } });
    const payment = (key: string) => registerAndAllocatePayment({
      accountId,
      amountCents: 500,
      occurredAt: new Date(),
      idempotencyKey: key,
      parts: [{ memberId, amountCents: 500, allocations: [{ chargeId: charge.id, amountCents: 500 }] }],
    }, actorId);
    const results = await Promise.allSettled([payment(`${suffix}-a`), payment(`${suffix}-b`)]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(await prisma.allocation.count({ where: { chargeId: charge.id } })).toBe(1);
    expect((await prisma.allocation.aggregate({ where: { chargeId: charge.id }, _sum: { amountCents: true } }))._sum.amountCents).toBe(500);
  });

  it("C12 conserva una sola entrada al repartir 5+5+2 entre dos personas", async () => {
    const suffix = randomUUID();
    const sectionId = (await prisma.member.findUniqueOrThrow({ where: { id: memberId }, select: { currentSectionId: true } })).currentSectionId!;
    const second = await prisma.member.create({ data: {
      displayName: "Segunda Persona Ficticia",
      normalizedName: `segunda persona ficticia ${suffix}`,
      status: "ACTIVE",
      currentSectionId: sectionId,
    } });
    const parking = await prisma.billingConcept.create({ data: { systemKey: `PARK-${suffix}`, name: "Parqueadero ficticio", defaultAmountCents: 200 } });
    const firstCharge = await prisma.charge.create({ data: { dedupeKey: `multipart-a-${suffix}`, memberId, conceptId, period: "2027-04", amountCents: 500 } });
    const secondCharge = await prisma.charge.create({ data: { dedupeKey: `multipart-b-${suffix}`, memberId: second.id, conceptId, period: "2027-04", amountCents: 500 } });
    const parkingCharge = await prisma.charge.create({ data: { dedupeKey: `multipart-p-${suffix}`, memberId: second.id, conceptId: parking.id, period: "2027-04", amountCents: 200 } });
    const movement = await registerAndAllocatePayment({
      accountId,
      amountCents: 1_200,
      occurredAt: new Date(),
      idempotencyKey: suffix,
      parts: [
        { memberId, amountCents: 500, allocations: [{ chargeId: firstCharge.id, amountCents: 500 }] },
        { memberId: second.id, amountCents: 700, allocations: [{ chargeId: secondCharge.id, amountCents: 500 }, { chargeId: parkingCharge.id, amountCents: 200 }] },
      ],
    }, actorId);
    expect(await prisma.moneyMovement.count({ where: { id: movement.id, amountCents: 1_200 } })).toBe(1);
    expect(await prisma.paymentPart.count({ where: { movementId: movement.id } })).toBe(2);
    expect((await prisma.allocation.aggregate({ where: { paymentPart: { movementId: movement.id } }, _sum: { amountCents: true } }))._sum.amountCents).toBe(1_200);
  });

  it("los reportes comparten la operación y respetan el alcance de jefe de cuerda", async () => {
    const suffix = randomUUID();
    const reportAccount = await prisma.financialAccount.create({ data: { name: `Cuenta reporte ${suffix}`, kind: "BANK" } });
    await prisma.moneyMovement.createMany({ data: [
      { accountId: reportAccount.id, type: "PAYMENT", direction: "IN", status: "CONFIRMED", amountCents: 2_000, occurredAt: new Date("2026-01-15T12:00:00-05:00"), description: "Apertura calculada sintética" },
      { accountId: reportAccount.id, type: "PAYMENT", direction: "IN", status: "CONFIRMED", amountCents: 1_000, occurredAt: new Date("2026-02-10T12:00:00-05:00"), description: "Entrada sintética" },
      { accountId: reportAccount.id, type: "EXPENSE", direction: "OUT", status: "CONFIRMED", amountCents: 400, occurredAt: new Date("2026-02-20T12:00:00-05:00"), description: "Salida sintética" },
    ] });
    const monthly = await getMonthlyAccountReport({ period: "2026-02", accountId: reportAccount.id, paginate: false });
    expect(monthly.periodTotals).toEqual({ openingCents: 2_000, entriesCents: 1_000, exitsCents: 400, closingCents: 2_600 });
    expect(monthly.coverageState).toBe("WITH_MOVEMENTS");

    const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId }, select: { currentSectionId: true } });
    const monthlyConcept = await prisma.billingConcept.upsert({
      where: { systemKey: "MONTHLY_DUES" },
      create: { systemKey: "MONTHLY_DUES", name: "Cuota mensual", defaultAmountCents: 500 },
      update: {},
    });
    const reportCharge = await prisma.charge.create({ data: { dedupeKey: `report-charge-${suffix}`, memberId, conceptId: monthlyConcept.id, period: "2026-09", amountCents: 500 } });
    await prisma.paymentPart.create({ data: {
      memberId,
      amountCents: 500,
      isLegacy: true,
      cashEffect: false,
      sourceReference: `report-part-${suffix}`,
      allocations: { create: { chargeId: reportCharge.id, amountCents: 500, isLegacy: true, cashEffect: false } },
    } });
    const annual = await getAnnualDuesReport({
      access: { userId: actorId, name: "Jefatura ficticia", email: "jefatura@example.test", roles: [AppRole.JEFE_DE_CUERDA], sectionIds: [member.currentSectionId!], memberId },
      year: 2026,
      cutoffPeriod: "2026-10",
      sectionId: member.currentSectionId!,
      paginate: false,
    });
    expect(annual.rows.length).toBeGreaterThan(1);
    expect(annual.rows.every((row) => row.section?.id === member.currentSectionId)).toBe(true);
    expect(annual.rows.find((row) => row.id === memberId)?.months[8].status).toBe("PAID");
  });
});
