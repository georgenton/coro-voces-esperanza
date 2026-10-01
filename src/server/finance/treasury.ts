import { randomUUID } from "node:crypto";
import { MovementDirection, MovementStatus, MovementType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { assertCents } from "@/lib/money";

export async function registerExpense(input: {
  accountId: string;
  amountCents: number;
  occurredAt: Date | null;
  description: string;
  externalReference?: string;
  activityId?: string;
  idempotencyKey: string;
}, actorId: string) {
  assertCents(input.amountCents, "Gasto", false);
  if (input.description.trim().length < 3) throw new Error("Describe el gasto.");
  return prisma.$transaction(async (tx) => {
    const previous = await tx.idempotencyKey.findUnique({ where: { scope_key: { scope: "EXPENSE", key: input.idempotencyKey } } });
    if (previous?.resultId) return tx.moneyMovement.findUniqueOrThrow({ where: { id: previous.resultId } });
    await tx.idempotencyKey.create({ data: { scope: "EXPENSE", key: input.idempotencyKey } });
    const movement = await tx.moneyMovement.create({ data: {
      accountId: input.accountId,
      type: MovementType.EXPENSE,
      direction: MovementDirection.OUT,
      status: MovementStatus.CONFIRMED,
      amountCents: input.amountCents,
      occurredAt: input.occurredAt,
      description: input.description.trim(),
      externalReference: input.externalReference?.trim() || null,
      confirmedAt: new Date(),
      confirmedById: actorId,
    } });
    if (input.activityId) {
      await tx.activity.findUniqueOrThrow({ where: { id: input.activityId } });
      await tx.activityExpense.create({
        data: { activityId: input.activityId, movementId: movement.id, amountCents: input.amountCents },
      });
    }
    await tx.idempotencyKey.update({ where: { scope_key: { scope: "EXPENSE", key: input.idempotencyKey } }, data: { resultId: movement.id } });
    await tx.auditLog.create({ data: { actorId, action: "EXPENSE_CONFIRMED", entityType: "MoneyMovement", entityId: movement.id, summary: "Gasto confirmado." } });
    return movement;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function registerInterest(input: {
  accountId: string;
  amountCents: number;
  occurredAt: Date | null;
  description?: string;
  idempotencyKey: string;
}, actorId: string) {
  assertCents(input.amountCents, "Interés", false);
  return prisma.$transaction(async (tx) => {
    const previous = await tx.idempotencyKey.findUnique({ where: { scope_key: { scope: "INTEREST", key: input.idempotencyKey } } });
    if (previous?.resultId) return tx.moneyMovement.findUniqueOrThrow({ where: { id: previous.resultId } });
    await tx.idempotencyKey.create({ data: { scope: "INTEREST", key: input.idempotencyKey } });
    const movement = await tx.moneyMovement.create({ data: {
      accountId: input.accountId,
      type: MovementType.INTEREST,
      direction: MovementDirection.IN,
      status: MovementStatus.CONFIRMED,
      amountCents: input.amountCents,
      occurredAt: input.occurredAt,
      description: input.description?.trim() || "Interés acreditado",
      confirmedAt: new Date(),
      confirmedById: actorId,
    } });
    await tx.idempotencyKey.update({ where: { scope_key: { scope: "INTEREST", key: input.idempotencyKey } }, data: { resultId: movement.id } });
    await tx.auditLog.create({ data: { actorId, action: "INTEREST_CONFIRMED", entityType: "MoneyMovement", entityId: movement.id, summary: "Interés externo confirmado como ingreso." } });
    return movement;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function registerInternalTransfer(input: {
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  occurredAt: Date | null;
  description?: string;
  idempotencyKey: string;
}, actorId: string) {
  assertCents(input.amountCents, "Transferencia", false);
  if (input.fromAccountId === input.toAccountId) throw new Error("Selecciona dos cuentas distintas.");
  return prisma.$transaction(async (tx) => {
    const previous = await tx.idempotencyKey.findUnique({ where: { scope_key: { scope: "TRANSFER", key: input.idempotencyKey } } });
    if (previous?.resultId) return { groupId: previous.resultId };
    await tx.idempotencyKey.create({ data: { scope: "TRANSFER", key: input.idempotencyKey } });
    const groupId = randomUUID();
    await tx.moneyMovement.createMany({ data: [
      { accountId: input.fromAccountId, type: MovementType.INTERNAL_TRANSFER, direction: MovementDirection.OUT, status: MovementStatus.CONFIRMED, amountCents: input.amountCents, occurredAt: input.occurredAt, description: input.description?.trim() || "Transferencia interna", transferGroupId: groupId, confirmedAt: new Date(), confirmedById: actorId },
      { accountId: input.toAccountId, type: MovementType.INTERNAL_TRANSFER, direction: MovementDirection.IN, status: MovementStatus.CONFIRMED, amountCents: input.amountCents, occurredAt: input.occurredAt, description: input.description?.trim() || "Transferencia interna", transferGroupId: groupId, confirmedAt: new Date(), confirmedById: actorId },
    ] });
    await tx.idempotencyKey.update({ where: { scope_key: { scope: "TRANSFER", key: input.idempotencyKey } }, data: { resultId: groupId } });
    await tx.auditLog.create({ data: { actorId, action: "INTERNAL_TRANSFER_CONFIRMED", entityType: "MoneyMovement", entityId: groupId, summary: "Transferencia interna registrada como salida y entrada neutrales.", metadata: { amountCents: input.amountCents } } });
    return { groupId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
