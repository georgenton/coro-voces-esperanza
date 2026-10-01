"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppRole } from "@/generated/prisma/client";
import { chargeDedupeKey } from "@/server/finance/rules";
import { requireAccess } from "@/lib/access";
import { assertPeriod, dueDateForPeriod } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { parseUsdToCents } from "@/lib/money";

function safe(error: unknown) { return error instanceof Error ? error.message.slice(0, 180) : "No se guardó la actividad."; }

export async function createActivityAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  let target = "/actividades?success=Actividad creada";
  try {
    const name = String(formData.get("name") ?? "").trim();
    if (name.length < 3) throw new Error("Escribe el nombre de la actividad.");
    const amount = String(formData.get("participantAmount") ?? "");
    await prisma.activity.create({ data: { name, description: String(formData.get("description") ?? "").trim() || null, participantAmountCents: amount ? parseUsdToCents(amount) : null, status: "OPEN" } });
    await prisma.auditLog.create({ data: { actorId: access.userId, action: "ACTIVITY_CREATED", entityType: "Activity", summary: "Actividad creada sin inscribir ni cobrar automáticamente a miembros." } });
    revalidatePath("/actividades");
  } catch (error) { target = `/actividades?error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}

export async function enrollParticipantAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  let target = "/actividades?success=Participante inscrito";
  try {
    const activityId = String(formData.get("activityId") ?? "");
    const memberId = String(formData.get("memberId") ?? "");
    const period = String(formData.get("period") ?? "");
    const createCharge = formData.get("createCharge") === "on";
    await prisma.$transaction(async (tx) => {
      const activity = await tx.activity.findUniqueOrThrow({ where: { id: activityId } });
      await tx.activityParticipant.upsert({ where: { activityId_memberId: { activityId, memberId } }, update: {}, create: { activityId, memberId } });
      if (createCharge) {
        if (!activity.participantAmountCents) throw new Error("La actividad no tiene importe por participante.");
        assertPeriod(period);
        const concept = await tx.billingConcept.findUniqueOrThrow({ where: { systemKey: "ACTIVITY" } });
        await tx.charge.upsert({
          where: { dedupeKey: chargeDedupeKey({ memberId, conceptId: concept.id, activityId, period }) },
          update: {},
          create: { dedupeKey: chargeDedupeKey({ memberId, conceptId: concept.id, activityId, period }), memberId, conceptId: concept.id, activityId, period, dueOn: dueDateForPeriod(period), amountCents: activity.participantAmountCents, source: "ACTIVITY", publishedAt: new Date() },
        });
      }
      await tx.auditLog.create({ data: { actorId: access.userId, action: "ACTIVITY_PARTICIPANT_ENROLLED", entityType: "Activity", entityId: activityId, summary: createCharge ? "Participante inscrito y cargo explícito generado." : "Participante inscrito sin cargo automático.", metadata: { memberId, createCharge } } });
    });
    revalidatePath("/actividades"); revalidatePath("/cuotas");
  } catch (error) { target = `/actividades?error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}
