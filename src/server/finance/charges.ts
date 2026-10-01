import { ChargeStatus, IncidentType, MemberStatus, type Prisma } from "@/generated/prisma/client";
import { dueDateForPeriod, assertPeriod } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { chargeDedupeKey, decideCharge } from "@/server/finance/rules";

function parkingEligible(
  incidents: Array<{ type: IncidentType; economicPeriod: string | null }>,
  period: string,
) {
  const parkingTypes = new Set<IncidentType>([IncidentType.PARKING_START, IncidentType.PARKING_END]);
  const relevant = incidents
    .filter((incident) =>
      parkingTypes.has(incident.type) &&
      incident.economicPeriod && incident.economicPeriod <= period,
    )
    .toSorted((a, b) => (a.economicPeriod ?? "").localeCompare(b.economicPeriod ?? ""));
  const latest = relevant.at(-1);
  return latest ? latest.type === IncidentType.PARKING_START : false;
}

export async function generateChargesForPeriod(period: string, actorId: string) {
  assertPeriod(period);
  const [rules, members] = await Promise.all([
    prisma.chargeRule.findMany({
      where: {
        active: true,
        startsPeriod: { lte: period },
        OR: [{ endsPeriod: null }, { endsPeriod: { gte: period } }],
      },
      include: {
        concept: true,
        exceptions: { where: { period } },
      },
    }),
    prisma.member.findMany({
      include: {
        incidents: {
          where: { status: "APPROVED" },
          select: { type: true, economicPeriod: true },
        },
      },
    }),
  ]);

  const pendingIncidentMembers = new Set(
    (
      await prisma.membershipIncident.findMany({
        where: { status: "PENDING", economicPeriod: { lte: period } },
        select: { memberId: true },
      })
    ).map(({ memberId }) => memberId),
  );

  const candidates: Prisma.ChargeCreateManyInput[] = [];
  let reviewRequired = 0;
  for (const member of members) {
    for (const rule of rules) {
      const globalException = rule.exceptions.find((item) => item.memberId === null);
      const memberException = rule.exceptions.find((item) => item.memberId === member.id);
      const exception = memberException ?? globalException;
      const isParking = rule.concept.systemKey === "PARKING";
      const eligibilityConfirmed =
        member.status !== MemberStatus.REVIEW_REQUIRED && !pendingIncidentMembers.has(member.id);
      const eligible =
        member.status === MemberStatus.ACTIVE &&
        (!isParking || parkingEligible(member.incidents, period));
      const decision = decideCharge({
        period,
        amountCents: rule.amountCents,
        excludeJanuary: rule.excludeJanuary,
        eligibilityConfirmed,
        eligible: exception ? exception.chargeable : eligible,
        exemptPeriods: exception && !exception.chargeable ? [period] : [],
        overrideAmountCents: exception?.amountCents,
      });
      if (decision.status === "REVIEW_REQUIRED") {
        reviewRequired += 1;
        continue;
      }
      if (decision.status !== "CHARGEABLE") continue;
      candidates.push({
        dedupeKey: chargeDedupeKey({ memberId: member.id, conceptId: rule.conceptId, period }),
        memberId: member.id,
        conceptId: rule.conceptId,
        ruleId: rule.id,
        period,
        dueOn: dueDateForPeriod(period),
        amountCents: decision.amountCents,
        status: ChargeStatus.PENDING,
        source: "RULE",
        publishedAt: new Date(),
      });
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const result = await tx.charge.createMany({ data: candidates, skipDuplicates: true });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "CHARGES_GENERATED",
        entityType: "Charge",
        summary: `Generación idempotente de cargos para ${period}.`,
        metadata: { period, candidates: candidates.length, created: result.count, reviewRequired },
      },
    });
    return result.count;
  });
  return { created, candidates: candidates.length, reviewRequired };
}
