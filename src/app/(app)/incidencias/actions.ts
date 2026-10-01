"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppRole, IncidentType } from "@/generated/prisma/client";
import { assertCanAccessMember, requireAccess } from "@/lib/access";
import { prisma } from "@/lib/db";
import { approveIncident, simulateIncident } from "@/server/incidents/service";

function safe(error: unknown) { return error instanceof Error ? error.message.slice(0, 180) : "No se guardó la incidencia."; }

export async function proposeIncidentAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA, AppRole.DIRECTORA, AppRole.JEFE_DE_CUERDA]);
  let target = "/incidencias?success=Incidencia propuesta para revisión";
  try {
    const memberId = String(formData.get("memberId") ?? "");
    const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    assertCanAccessMember(access, member);
    const type = String(formData.get("type") ?? "") as IncidentType;
    if (!Object.values(IncidentType).includes(type)) throw new Error("Tipo de incidencia inválido.");
    const economicPeriod = String(formData.get("economicPeriod") ?? "") || null;
    const effectiveText = String(formData.get("effectiveOn") ?? "");
    const simulation = await simulateIncident(memberId, type, economicPeriod);
    const sectionId = String(formData.get("sectionId") ?? "") || undefined;
    await prisma.membershipIncident.create({ data: {
      memberId,
      type,
      effectiveOn: effectiveText ? new Date(`${effectiveText}T00:00:00Z`) : null,
      economicPeriod,
      publicNote: String(formData.get("publicNote") ?? "").trim() || null,
      privateReason: String(formData.get("privateReason") ?? "").trim() || null,
      proposedChange: sectionId ? { sectionId } : undefined,
      simulation,
      authorId: access.userId,
    } });
    revalidatePath("/incidencias");
  } catch (error) { target = `/incidencias?error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}

export async function approveIncidentAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  let target = "/incidencias?success=Incidencia aprobada y auditada";
  try { await approveIncident(String(formData.get("incidentId") ?? ""), access.userId); revalidatePath("/incidencias"); revalidatePath("/cuotas"); revalidatePath("/resumen"); }
  catch (error) { target = `/incidencias?error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}
