"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppRole } from "@/generated/prisma/client";
import { requireAccess } from "@/lib/access";
import { parseUsdToCents } from "@/lib/money";
import { addEvidenceToBatch, confirmUnidentifiedCandidate, createReconciliationBatch, importBankCsv, runVisionExtraction, updateCandidateManually } from "@/server/reconciliation/service";

function safe(error: unknown) { return error instanceof Error ? error.message.slice(0, 180) : "No se completó la conciliación."; }

export async function createBatchAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  let target = "/conciliar";
  try { const batch = await createReconciliationBatch(String(formData.get("name") ?? ""), access.userId); target = `/conciliar?batch=${batch.id}&success=Lote creado`; }
  catch (error) { target = `/conciliar?error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}

export async function uploadEvidenceAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  const batchId = String(formData.get("batchId") ?? "");
  let target = `/conciliar?batch=${batchId}&success=Evidencia recibida`;
  try {
    const file = formData.get("evidence");
    if (!(file instanceof File) || !file.size) throw new Error("Selecciona una imagen o CSV.");
    if (file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv")) await importBankCsv(batchId, file, access.userId);
    else await addEvidenceToBatch(batchId, file, access.userId);
    revalidatePath("/conciliar");
  } catch (error) { target = `/conciliar?batch=${batchId}&error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}

export async function extractCandidateAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  const batchId = String(formData.get("batchId") ?? "");
  let target = `/conciliar?batch=${batchId}&success=Extracción guardada como propuesta`;
  try { await runVisionExtraction(String(formData.get("candidateId") ?? ""), access.userId); revalidatePath("/conciliar"); }
  catch (error) { target = `/conciliar?batch=${batchId}&error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}

export async function reviewCandidateAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  const batchId = String(formData.get("batchId") ?? "");
  let target = `/conciliar?batch=${batchId}&success=Candidato revisado`;
  try {
    const amount = String(formData.get("amount") ?? "");
    const date = String(formData.get("occurredOn") ?? "");
    const direction = String(formData.get("direction") ?? "") as "IN" | "OUT" | "";
    await updateCandidateManually(String(formData.get("candidateId") ?? ""), {
      amountCents: amount ? parseUsdToCents(amount) : null,
      occurredAt: date ? new Date(`${date}T12:00:00-05:00`) : null,
      externalReference: String(formData.get("externalReference") ?? "").trim() || null,
      payerName: String(formData.get("payerName") ?? "").trim() || null,
      direction: direction || null,
      reviewNote: String(formData.get("reviewNote") ?? "").trim() || null,
    }, access.userId);
    revalidatePath("/conciliar");
  } catch (error) { target = `/conciliar?batch=${batchId}&error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}

export async function confirmCandidateAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  const batchId = String(formData.get("batchId") ?? "");
  let target = `/conciliar?batch=${batchId}&success=Entrada confirmada; el importe sigue sin identificar hasta distribuirlo`;
  try { await confirmUnidentifiedCandidate(String(formData.get("candidateId") ?? ""), String(formData.get("accountId") ?? ""), access.userId); revalidatePath("/conciliar"); revalidatePath("/resumen"); }
  catch (error) { target = `/conciliar?batch=${batchId}&error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}
