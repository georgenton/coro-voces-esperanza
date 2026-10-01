"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppRole } from "@/generated/prisma/client";
import { requireAccess } from "@/lib/access";
import { parseUsdToCents } from "@/lib/money";
import { allocateExistingPayment, registerAndAllocatePayment } from "@/server/finance/payments";
import { registerExpense, registerInterest, registerInternalTransfer } from "@/server/finance/treasury";

const planSchema = z.array(z.object({
  memberId: z.string().min(1),
  amount: z.string().min(1),
  note: z.string().optional(),
  allocations: z.array(z.object({ chargeId: z.string().min(1), amount: z.string().min(1) })),
})).min(1);

function dateOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  return text ? new Date(`${text}T12:00:00-05:00`) : null;
}

function message(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 180) : "No se guardó la operación.";
}

export async function registerPaymentAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  let target = "/movimientos?success=Pago registrado";
  try {
    const rawPlan = planSchema.parse(JSON.parse(String(formData.get("plan") ?? "[]")));
    const accountId = String(formData.get("accountId") ?? "");
    const externalReference = String(formData.get("externalReference") ?? "").trim();
    await registerAndAllocatePayment({
      accountId,
      amountCents: parseUsdToCents(String(formData.get("amount") ?? "")),
      occurredAt: dateOrNull(formData.get("occurredOn")),
      description: String(formData.get("description") ?? ""),
      externalReference,
      bankReferenceKey: externalReference ? createHash("sha256").update(JSON.stringify([accountId, externalReference])).digest("hex") : undefined,
      idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
      parts: rawPlan.map((part) => ({
        memberId: part.memberId,
        amountCents: parseUsdToCents(part.amount),
        note: part.note,
        allocations: part.allocations.map((allocation) => ({ chargeId: allocation.chargeId, amountCents: parseUsdToCents(allocation.amount) })),
      })),
    }, access.userId);
    revalidatePath("/movimientos"); revalidatePath("/cuotas"); revalidatePath("/resumen");
  } catch (error) {
    target = `/movimientos?error=${encodeURIComponent(message(error))}`;
  }
  redirect(target);
}

export async function allocateExistingPaymentAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  let target = "/movimientos?success=Entrada distribuida sin duplicar caja";
  try {
    const rawPlan = planSchema.parse(JSON.parse(String(formData.get("plan") ?? "[]")));
    await allocateExistingPayment({
      movementId: String(formData.get("movementId") ?? ""),
      idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
      parts: rawPlan.map((part) => ({
        memberId: part.memberId,
        amountCents: parseUsdToCents(part.amount),
        note: part.note,
        allocations: part.allocations.map((allocation) => ({ chargeId: allocation.chargeId, amountCents: parseUsdToCents(allocation.amount) })),
      })),
    }, access.userId);
    revalidatePath("/movimientos"); revalidatePath("/cuotas"); revalidatePath("/resumen");
  } catch (error) { target = `/movimientos?error=${encodeURIComponent(message(error))}`; }
  redirect(target);
}

export async function registerExpenseAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  let target = "/movimientos?success=Gasto registrado";
  try {
    await registerExpense({
      accountId: String(formData.get("accountId") ?? ""),
      amountCents: parseUsdToCents(String(formData.get("amount") ?? "")),
      occurredAt: dateOrNull(formData.get("occurredOn")),
      description: String(formData.get("description") ?? ""),
      externalReference: String(formData.get("externalReference") ?? ""),
      activityId: String(formData.get("activityId") ?? "") || undefined,
      idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
    }, access.userId);
    revalidatePath("/movimientos"); revalidatePath("/resumen");
  } catch (error) { target = `/movimientos?error=${encodeURIComponent(message(error))}`; }
  redirect(target);
}

export async function registerInterestAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  let target = "/movimientos?success=Interés registrado";
  try {
    await registerInterest({
      accountId: String(formData.get("accountId") ?? ""),
      amountCents: parseUsdToCents(String(formData.get("amount") ?? "")),
      occurredAt: dateOrNull(formData.get("occurredOn")),
      description: String(formData.get("description") ?? ""),
      idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
    }, access.userId);
    revalidatePath("/movimientos"); revalidatePath("/resumen");
  } catch (error) { target = `/movimientos?error=${encodeURIComponent(message(error))}`; }
  redirect(target);
}

export async function registerTransferAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  let target = "/movimientos?success=Transferencia interna registrada";
  try {
    await registerInternalTransfer({
      fromAccountId: String(formData.get("fromAccountId") ?? ""),
      toAccountId: String(formData.get("toAccountId") ?? ""),
      amountCents: parseUsdToCents(String(formData.get("amount") ?? "")),
      occurredAt: dateOrNull(formData.get("occurredOn")),
      description: String(formData.get("description") ?? ""),
      idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
    }, access.userId);
    revalidatePath("/movimientos"); revalidatePath("/resumen");
  } catch (error) { target = `/movimientos?error=${encodeURIComponent(message(error))}`; }
  redirect(target);
}
