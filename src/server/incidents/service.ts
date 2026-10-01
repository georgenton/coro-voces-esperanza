import { ChargeStatus, IncidentType, MemberStatus, Prisma, ReviewStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { assertPeriod } from "@/lib/dates";

export async function simulateIncident(memberId: string, type: IncidentType, economicPeriod: string | null) {
  const financialTypes = new Set<IncidentType>([
    IncidentType.PAUSE,
    IncidentType.RETIREMENT,
    IncidentType.EXEMPTION,
    IncidentType.PARKING_END,
  ]);
  if (financialTypes.has(type) && !economicPeriod) {
    return { reviewRequired: true, reason: "Falta seleccionar el período de efecto económico.", affected: 0, paidOrPartial: 0, outstandingCents: 0 };
  }
  if (!economicPeriod) return { reviewRequired: false, affected: 0, paidOrPartial: 0, outstandingCents: 0 };
  assertPeriod(economicPeriod);
  const periodFilter = type === IncidentType.EXEMPTION ? { equals: economicPeriod } : { gte: economicPeriod };
  const conceptFilter = type === IncidentType.PARKING_END ? { concept: { systemKey: "PARKING" } } : {};
  const charges = await prisma.charge.findMany({
    where: { memberId, period: periodFilter, status: { not: ChargeStatus.VOIDED }, ...conceptFilter },
    include: { allocations: true, adjustments: true },
  });
  let outstandingCents = 0;
  let paidOrPartial = 0;
  for (const charge of charges) {
    const due = charge.amountCents + charge.adjustments.reduce((sum, item) => sum + item.amountCents, 0);
    const applied = charge.allocations.reduce((sum, item) => sum + item.amountCents, 0);
    outstandingCents += Math.max(0, due - applied);
    if (applied > 0) paidOrPartial += 1;
  }
  return { reviewRequired: false, affected: charges.length, paidOrPartial, outstandingCents };
}

export async function approveIncident(incidentId: string, approverId: string) {
  return prisma.$transaction(async (tx) => {
    const incident = await tx.membershipIncident.findUnique({ where: { id: incidentId } });
    if (!incident || incident.status !== ReviewStatus.PENDING) throw new Error("La incidencia ya fue resuelta o no existe.");
    const type = incident.type;
    const financialTypes = new Set<IncidentType>([
      IncidentType.PAUSE, IncidentType.RETIREMENT, IncidentType.EXEMPTION, IncidentType.PARKING_END,
    ]);
    if (financialTypes.has(type) && !incident.economicPeriod) {
      throw new Error("Falta el período económico; no se aplicaron cambios.");
    }
    if (incident.economicPeriod) assertPeriod(incident.economicPeriod);

    if (financialTypes.has(type) && incident.economicPeriod) {
      const period = type === IncidentType.EXEMPTION ? { equals: incident.economicPeriod } : { gte: incident.economicPeriod };
      const charges = await tx.charge.findMany({
        where: {
          memberId: incident.memberId,
          period,
          status: { not: ChargeStatus.VOIDED },
          ...(type === IncidentType.PARKING_END ? { concept: { systemKey: "PARKING" } } : {}),
        },
        include: { allocations: true, adjustments: true },
      });
      for (const charge of charges) {
        const due = charge.amountCents + charge.adjustments.reduce((sum, item) => sum + item.amountCents, 0);
        const applied = charge.allocations.reduce((sum, item) => sum + item.amountCents, 0);
        const outstanding = Math.max(0, due - applied);
        if (outstanding) {
          await tx.chargeAdjustment.create({
            data: {
              chargeId: charge.id,
              amountCents: -outstanding,
              reason: `Incidencia ${type} aprobada: ${incident.id}`,
              authorId: approverId,
            },
          });
        }
        await tx.charge.update({
          where: { id: charge.id },
          data: { status: applied > 0 ? ChargeStatus.PAID : ChargeStatus.VOIDED },
        });
      }
    }

    if (type === IncidentType.PAUSE) await tx.member.update({ where: { id: incident.memberId }, data: { status: MemberStatus.PAUSED } });
    if (type === IncidentType.RETIREMENT) await tx.member.update({ where: { id: incident.memberId }, data: { status: MemberStatus.RETIRED, leftOn: incident.effectiveOn } });
    if (type === IncidentType.JOIN || type === IncidentType.REENTRY) await tx.member.update({ where: { id: incident.memberId }, data: { status: MemberStatus.ACTIVE, leftOn: null } });
    if (type === IncidentType.SECTION_CHANGE) {
      if (!incident.effectiveOn) throw new Error("Falta fecha efectiva para el cambio de cuerda.");
      const proposed = incident.proposedChange as { sectionId?: string } | null;
      if (!proposed?.sectionId) throw new Error("Falta la cuerda propuesta.");
      await tx.sectionAssignment.updateMany({ where: { memberId: incident.memberId, endsOn: null }, data: { endsOn: incident.effectiveOn } });
      await tx.sectionAssignment.create({ data: { memberId: incident.memberId, sectionId: proposed.sectionId, startsOn: incident.effectiveOn, source: `INCIDENT:${incident.id}` } });
      await tx.member.update({ where: { id: incident.memberId }, data: { currentSectionId: proposed.sectionId } });
    }

    const updated = await tx.membershipIncident.update({
      where: { id: incident.id },
      data: { status: ReviewStatus.APPROVED, approvedById: approverId, approvedAt: new Date() },
    });
    await tx.auditLog.create({ data: {
      actorId: approverId,
      action: "INCIDENT_APPROVED",
      entityType: "MembershipIncident",
      entityId: incident.id,
      summary: "Incidencia aprobada con ajustes trazables sobre saldos pendientes.",
      metadata: { type, economicPeriod: incident.economicPeriod ?? null } as Prisma.InputJsonValue,
    } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
