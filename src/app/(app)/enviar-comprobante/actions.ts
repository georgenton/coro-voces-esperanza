"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/db";
import { addEvidenceToBatch } from "@/server/reconciliation/service";

export async function submitMemberReceiptAction(formData: FormData) {
  const access = await requireAccess();
  let target = "/enviar-comprobante?success=Comprobante enviado para revisión; aún no acredita un pago";
  try {
    if (!access.memberId) throw new Error("Tu cuenta no está vinculada a una ficha de miembro.");
    const file = formData.get("evidence");
    if (!(file instanceof File) || !file.size) throw new Error("Selecciona una imagen.");
    const period = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "America/Guayaquil" }).format(new Date()).slice(0, 7);
    let batch = await prisma.reconciliationBatch.findFirst({ where: { name: `Comprobantes de miembros ${period}`, status: "PENDING" } });
    batch ??= await prisma.reconciliationBatch.create({ data: { name: `Comprobantes de miembros ${period}`, createdById: access.userId } });
    const candidate = await addEvidenceToBatch(batch.id, file, access.userId);
    await prisma.reconciliationCandidate.update({ where: { id: candidate.id }, data: { extraction: { declaredMemberId: access.memberId, declaredDestination: String(formData.get("destination") ?? "").trim() || null }, reviewNote: "Comprobante enviado por miembro; no verificado en la cuenta del coro." } });
    revalidatePath("/enviar-comprobante");
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0,180) : "No se pudo enviar el comprobante.";
    target = `/enviar-comprobante?error=${encodeURIComponent(message)}`;
  }
  redirect(target);
}
