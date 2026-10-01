"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppRole } from "@/generated/prisma/client";
import { requireAccess } from "@/lib/access";
import type { ImportTransformation, PromotionScope } from "@/server/imports/mapping";
import {
  approveImportBatch,
  createPromotionPreview,
  promoteImportPlan,
  resolveImportItem,
  saveImportRowMapping,
  stageWorkbook,
} from "@/server/imports/service";

function safe(error: unknown) { return error instanceof Error ? error.message.slice(0, 180) : "No se completó la importación."; }

function textValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optionalText(formData: FormData, name: string) {
  return textValue(formData, name) || undefined;
}

function centsValue(formData: FormData, name: string) {
  const value = Number(textValue(formData, name));
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} debe ser un entero positivo en centavos.`);
  return value;
}

function mappingFromForm(formData: FormData): ImportTransformation {
  const type = textValue(formData, "proposedType") as ImportTransformation["type"];
  if (type === "MEMBER_CREATE") return {
    type,
    displayName: textValue(formData, "displayName"),
    originalName: optionalText(formData, "sourceName"),
    sectionId: textValue(formData, "sectionId"),
    startsOn: textValue(formData, "startsOn"),
    status: textValue(formData, "memberStatus") as "ACTIVE" | "PAUSED" | "RETIRED",
  };
  if (type === "IDENTITY_LINK") return { type, memberId: textValue(formData, "memberId"), sourceName: textValue(formData, "sourceName") };
  if (type === "SECTION_ASSIGNMENT") return {
    type,
    memberId: textValue(formData, "memberId"),
    sectionId: textValue(formData, "sectionId"),
    startsOn: textValue(formData, "startsOn"),
    endsOn: optionalText(formData, "endsOn") ?? null,
  };
  if (type === "CHARGE") return {
    type,
    memberId: textValue(formData, "memberId"),
    conceptId: textValue(formData, "conceptId"),
    period: textValue(formData, "period"),
    amountCents: centsValue(formData, "amountCents"),
    dueOn: optionalText(formData, "dueOn") ?? null,
  };
  if (type === "LEGACY_ALLOCATION") return {
    type,
    memberId: textValue(formData, "memberId"),
    conceptId: textValue(formData, "conceptId"),
    period: textValue(formData, "period"),
    chargeAmountCents: centsValue(formData, "chargeAmountCents"),
    appliedAmountCents: centsValue(formData, "appliedAmountCents"),
    dueOn: optionalText(formData, "dueOn") ?? null,
    appliedOn: optionalText(formData, "appliedOn") ?? null,
  };
  if (type === "MONEY_MOVEMENT") return {
    type,
    accountId: textValue(formData, "accountId"),
    movementType: textValue(formData, "movementType") as "PAYMENT" | "EXPENSE" | "INTEREST",
    direction: textValue(formData, "direction") as "IN" | "OUT",
    amountCents: centsValue(formData, "amountCents"),
    occurredOn: textValue(formData, "occurredOn"),
    externalReference: optionalText(formData, "externalReference"),
    description: optionalText(formData, "description"),
  };
  if (type === "OPENING_BALANCE") return {
    type,
    accountId: textValue(formData, "accountId"),
    amountCents: centsValue(formData, "amountCents"),
    direction: textValue(formData, "direction") as "IN" | "OUT",
    cutoffOn: textValue(formData, "cutoffOn"),
    description: textValue(formData, "description"),
  };
  throw new Error("Selecciona un tipo de transformación explícito.");
}

export async function uploadWorkbookAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  let target = "/importar";
  try {
    const file = formData.get("workbook");
    if (!(file instanceof File) || !file.size) throw new Error("Selecciona un archivo XLSX.");
    const result = await stageWorkbook(file, access.userId);
    target = `/importar?batch=${result.batch.id}&success=${encodeURIComponent(result.duplicate ? "El mismo archivo ya estaba en staging; no se duplicó." : "Libro cargado para revisión; no se crearon operaciones.")}`;
    revalidatePath("/importar");
  } catch (error) { target = `/importar?error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}

export async function resolveImportItemAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  const batchId = String(formData.get("batchId") ?? "");
  let target = `/importar?batch=${batchId}`;
  try {
    const kind = String(formData.get("kind") ?? "");
    const id = String(formData.get("id") ?? "");
    const statusValue = String(formData.get("status") ?? "");
    if (statusValue !== "APPROVED" && statusValue !== "REJECTED") throw new Error("Resolución inválida.");
    const status = statusValue;
    if (kind !== "issue" && kind !== "row") throw new Error("Elemento de importación inválido.");
    await resolveImportItem({ kind, id, status }, access.userId);
    revalidatePath("/importar");
  } catch (error) { target += `&error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}

export async function saveRowMappingAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  const batchId = textValue(formData, "batchId");
  let target = `/importar?batch=${batchId}`;
  try {
    await saveImportRowMapping(textValue(formData, "rowId"), mappingFromForm(formData), access.userId);
    target += `&success=${encodeURIComponent("Mapeo guardado. La fila debe aprobarse y cualquier aprobación previa del lote quedó invalidada.")}`;
    revalidatePath("/importar");
  } catch (error) { target += `&error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}

export async function createPromotionPreviewAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  const batchId = textValue(formData, "batchId");
  let target = `/importar?batch=${batchId}`;
  try {
    const scope = textValue(formData, "scope") as PromotionScope;
    if (!new Set<PromotionScope>(["ALL_APPROVED", "MEMBERS", "FINANCE"]).has(scope)) throw new Error("Alcance de promoción inválido.");
    const plan = await createPromotionPreview(batchId, scope, access.userId);
    target += `&plan=${plan.id}&success=${encodeURIComponent("Vista previa calculada sin publicar registros.")}`;
    revalidatePath("/importar");
  } catch (error) { target += `&error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}

export async function promotePlanAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  const batchId = textValue(formData, "batchId");
  const planId = textValue(formData, "planId");
  let target = `/importar?batch=${batchId}&plan=${planId}`;
  try {
    await promoteImportPlan(planId, access.userId);
    target += `&success=${encodeURIComponent("Promoción completada de forma atómica; el reintento no duplica registros.")}`;
    revalidatePath("/importar");
    revalidatePath("/resumen");
    revalidatePath("/miembros");
    revalidatePath("/cuotas");
    revalidatePath("/movimientos");
  } catch (error) { target += `&error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}

export async function approveBatchAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  const batchId = String(formData.get("batchId") ?? "");
  let target = `/importar?batch=${batchId}&success=Staging aprobado`;
  try { await approveImportBatch(batchId, access.userId); revalidatePath("/importar"); }
  catch (error) { target = `/importar?batch=${batchId}&error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}
