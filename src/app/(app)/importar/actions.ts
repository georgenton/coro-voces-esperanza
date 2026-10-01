"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppRole, ReviewStatus } from "@/generated/prisma/client";
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/db";
import { approveImportBatch, stageWorkbook } from "@/server/imports/service";

function safe(error: unknown) { return error instanceof Error ? error.message.slice(0, 180) : "No se completó la importación."; }

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
    const status = String(formData.get("status") ?? "") as ReviewStatus;
    const resolutions = new Set<ReviewStatus>([ReviewStatus.APPROVED, ReviewStatus.REJECTED]);
    if (!resolutions.has(status)) throw new Error("Resolución inválida.");
    if (kind === "issue") await prisma.importIssue.update({ where: { id }, data: { status } });
    else if (kind === "row") await prisma.importRow.update({ where: { id }, data: { status } });
    else throw new Error("Elemento de importación inválido.");
    await prisma.auditLog.create({ data: { actorId: access.userId, action: "IMPORT_ITEM_RESOLVED", entityType: kind === "issue" ? "ImportIssue" : "ImportRow", entityId: id, summary: `Elemento de staging marcado como ${status}.`, metadata: { batchId } } });
    revalidatePath("/importar");
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
