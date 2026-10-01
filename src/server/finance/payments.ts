import {
  ChargeStatus,
  MovementDirection,
  MovementStatus,
  MovementType,
  Prisma,
} from "@/generated/prisma/client";
import { assertCents } from "@/lib/money";
import { prisma } from "@/lib/db";
import { validateAllocationPlan, type PaymentPartInput } from "@/server/finance/allocation";

export type RegisterPaymentInput = {
  accountId: string;
  amountCents: number;
  occurredAt: Date | null;
  description?: string;
  externalReference?: string;
  bankReferenceKey?: string;
  parts: PaymentPartInput[];
  idempotencyKey: string;
  source?: string;
};

export async function registerAndAllocatePayment(
  input: RegisterPaymentInput,
  actorId: string,
) {
  assertCents(input.amountCents, "Importe", false);
  if (!input.idempotencyKey.trim()) throw new Error("Falta la clave de idempotencia.");

  return prisma.$transaction(
    async (tx) => {
      const prior = await tx.idempotencyKey.findUnique({
        where: { scope_key: { scope: "PAYMENT", key: input.idempotencyKey } },
      });
      if (prior?.resultId) {
        const movement = await tx.moneyMovement.findUnique({ where: { id: prior.resultId } });
        if (movement) return movement;
      }
      if (prior) throw new Error("La operación equivalente aún está en proceso.");
      await tx.idempotencyKey.create({
        data: { scope: "PAYMENT", key: input.idempotencyKey },
      });

      const requestedChargeIds = input.parts.flatMap((part) =>
        part.allocations.map(({ chargeId }) => chargeId),
      );
      const charges = await tx.charge.findMany({
        where: { id: { in: requestedChargeIds } },
        include: { allocations: { select: { amountCents: true } }, adjustments: true },
      });
      const balances = charges.map((charge) => {
        const adjusted = charge.amountCents + charge.adjustments.reduce((sum, item) => sum + item.amountCents, 0);
        const allocated = charge.allocations.reduce((sum, item) => sum + item.amountCents, 0);
        return { id: charge.id, memberId: charge.memberId, outstandingCents: Math.max(0, adjusted - allocated) };
      });
      validateAllocationPlan({ totalCents: input.amountCents, parts: input.parts, charges: balances });

      const movement = await tx.moneyMovement.create({
        data: {
          accountId: input.accountId,
          type: MovementType.PAYMENT,
          direction: MovementDirection.IN,
          status: MovementStatus.CONFIRMED,
          amountCents: input.amountCents,
          occurredAt: input.occurredAt,
          description: input.description?.trim() || null,
          externalReference: input.externalReference?.trim() || null,
          bankReferenceKey: input.bankReferenceKey || null,
          source: input.source ?? "MANUAL",
          confirmedAt: new Date(),
          confirmedById: actorId,
        },
      });

      for (const part of input.parts) {
        const createdPart = await tx.paymentPart.create({
          data: {
            movementId: movement.id,
            memberId: part.memberId,
            amountCents: part.amountCents,
            note: part.note?.trim() || null,
          },
        });
        if (part.allocations.length) {
          await tx.allocation.createMany({
            data: part.allocations.map((allocation) => ({
              paymentPartId: createdPart.id,
              chargeId: allocation.chargeId,
              amountCents: allocation.amountCents,
            })),
          });
        }
      }

      for (const charge of charges) {
        const added = input.parts
          .flatMap((part) => part.allocations)
          .filter((allocation) => allocation.chargeId === charge.id)
          .reduce((sum, allocation) => sum + allocation.amountCents, 0);
        const adjusted = charge.amountCents + charge.adjustments.reduce((sum, item) => sum + item.amountCents, 0);
        const previous = charge.allocations.reduce((sum, item) => sum + item.amountCents, 0);
        const totalApplied = previous + added;
        await tx.charge.update({
          where: { id: charge.id },
          data: {
            status:
              totalApplied >= adjusted
                ? ChargeStatus.PAID
                : totalApplied > 0
                  ? ChargeStatus.PARTIAL
                  : ChargeStatus.PENDING,
          },
        });
      }

      await tx.idempotencyKey.update({
        where: { scope_key: { scope: "PAYMENT", key: input.idempotencyKey } },
        data: { resultId: movement.id },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "PAYMENT_CONFIRMED",
          entityType: "MoneyMovement",
          entityId: movement.id,
          summary: "Pago confirmado y distribuido.",
          metadata: {
            amountCents: input.amountCents,
            parts: input.parts.length,
            allocations: input.parts.reduce((sum, part) => sum + part.allocations.length, 0),
          },
        },
      });
      return movement;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function allocateExistingPayment(input: {
  movementId: string;
  parts: PaymentPartInput[];
  idempotencyKey: string;
}, actorId: string) {
  if (!input.idempotencyKey.trim()) throw new Error("Falta la clave de idempotencia.");
  if (!input.parts.length) throw new Error("Añade al menos una parte identificada.");
  return prisma.$transaction(async (tx) => {
    const prior = await tx.idempotencyKey.findUnique({
      where: { scope_key: { scope: "PAYMENT_ALLOCATION", key: input.idempotencyKey } },
    });
    if (prior?.resultId) return tx.moneyMovement.findUniqueOrThrow({ where: { id: prior.resultId } });
    if (prior) throw new Error("La distribución equivalente aún está en proceso.");
    await tx.idempotencyKey.create({ data: { scope: "PAYMENT_ALLOCATION", key: input.idempotencyKey } });

    const movement = await tx.moneyMovement.findUnique({
      where: { id: input.movementId },
      include: { paymentParts: { select: { amountCents: true } } },
    });
    if (!movement || movement.type !== MovementType.PAYMENT || movement.direction !== MovementDirection.IN || movement.status !== MovementStatus.CONFIRMED) {
      throw new Error("El movimiento no es una entrada confirmada distribuible.");
    }
    const alreadyIdentified = movement.paymentParts.reduce((sum, part) => sum + part.amountCents, 0);
    const remaining = movement.amountCents - alreadyIdentified;
    if (remaining <= 0) throw new Error("El movimiento ya está completamente identificado.");

    const requestedChargeIds = input.parts.flatMap((part) => part.allocations.map(({ chargeId }) => chargeId));
    const charges = await tx.charge.findMany({
      where: { id: { in: requestedChargeIds } },
      include: { allocations: { select: { amountCents: true } }, adjustments: true },
    });
    const balances = charges.map((charge) => ({
      id: charge.id,
      memberId: charge.memberId,
      outstandingCents: Math.max(0, charge.amountCents + charge.adjustments.reduce((sum, item) => sum + item.amountCents, 0) - charge.allocations.reduce((sum, item) => sum + item.amountCents, 0)),
    }));
    validateAllocationPlan({ totalCents: remaining, parts: input.parts, charges: balances });

    for (const part of input.parts) {
      const createdPart = await tx.paymentPart.create({ data: {
        movementId: movement.id,
        memberId: part.memberId,
        amountCents: part.amountCents,
        note: part.note?.trim() || null,
      } });
      if (part.allocations.length) {
        await tx.allocation.createMany({ data: part.allocations.map((allocation) => ({
          paymentPartId: createdPart.id,
          chargeId: allocation.chargeId,
          amountCents: allocation.amountCents,
        })) });
      }
    }

    for (const charge of charges) {
      const added = input.parts.flatMap((part) => part.allocations)
        .filter((allocation) => allocation.chargeId === charge.id)
        .reduce((sum, allocation) => sum + allocation.amountCents, 0);
      const adjusted = charge.amountCents + charge.adjustments.reduce((sum, item) => sum + item.amountCents, 0);
      const totalApplied = charge.allocations.reduce((sum, item) => sum + item.amountCents, 0) + added;
      await tx.charge.update({ where: { id: charge.id }, data: {
        status: totalApplied >= adjusted ? ChargeStatus.PAID : totalApplied > 0 ? ChargeStatus.PARTIAL : ChargeStatus.PENDING,
      } });
    }
    await tx.idempotencyKey.update({
      where: { scope_key: { scope: "PAYMENT_ALLOCATION", key: input.idempotencyKey } },
      data: { resultId: movement.id },
    });
    await tx.auditLog.create({ data: {
      actorId,
      action: "PAYMENT_DISTRIBUTED",
      entityType: "MoneyMovement",
      entityId: movement.id,
      summary: "Entrada existente distribuida sin crear otro movimiento de caja.",
      metadata: { parts: input.parts.length },
    } });
    return movement;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function reversePayment(movementId: string, reason: string, actorId: string) {
  if (reason.trim().length < 5) throw new Error("Se requiere un motivo de reverso.");
  return prisma.$transaction(
    async (tx) => {
      const original = await tx.moneyMovement.findUnique({
        where: { id: movementId },
        include: { paymentParts: { include: { allocations: true } } },
      });
      if (!original || original.status !== MovementStatus.CONFIRMED || original.type !== MovementType.PAYMENT) {
        throw new Error("El pago no está disponible para reverso.");
      }
      const already = await tx.moneyMovement.findUnique({ where: { reversalOfId: movementId } });
      if (already) return already;

      const reversal = await tx.moneyMovement.create({
        data: {
          accountId: original.accountId,
          type: MovementType.REVERSAL,
          direction: MovementDirection.OUT,
          status: MovementStatus.CONFIRMED,
          amountCents: original.amountCents,
          occurredAt: new Date(),
          description: reason.trim(),
          source: "REVERSAL",
          reversalOfId: original.id,
          confirmedAt: new Date(),
          confirmedById: actorId,
        },
      });
      const chargeIds = original.paymentParts.flatMap((part) => part.allocations.map(({ chargeId }) => chargeId));
      await tx.allocation.deleteMany({ where: { paymentPartId: { in: original.paymentParts.map(({ id }) => id) } } });
      await tx.moneyMovement.update({ where: { id: original.id }, data: { status: MovementStatus.REVERSED } });
      for (const chargeId of new Set(chargeIds)) {
        const charge = await tx.charge.findUnique({
          where: { id: chargeId },
          include: { allocations: true, adjustments: true },
        });
        if (!charge) continue;
        const adjusted = charge.amountCents + charge.adjustments.reduce((sum, item) => sum + item.amountCents, 0);
        const applied = charge.allocations.reduce((sum, item) => sum + item.amountCents, 0);
        await tx.charge.update({
          where: { id: charge.id },
          data: { status: applied >= adjusted ? ChargeStatus.PAID : applied > 0 ? ChargeStatus.PARTIAL : ChargeStatus.PENDING },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId,
          action: "PAYMENT_REVERSED",
          entityType: "MoneyMovement",
          entityId: reversal.id,
          summary: "Pago revertido sin borrar el movimiento original.",
          metadata: { originalMovementId: original.id },
        },
      });
      return reversal;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
