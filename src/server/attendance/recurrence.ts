import { z } from "zod";
import { prisma } from "@/lib/db";

const recurrenceSchema = z.object({
  enabled: z.boolean(),
  weekday: z.number().int().min(0).max(6),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().positive().max(480),
  openBeforeMinutes: z.number().int().min(0).max(480),
  closeAfterMinutes: z.number().int().min(0).max(480),
  sectionId: z.string().nullable(),
});

function localDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(date);
}

function localStart(dateKey: string, time: string) {
  return new Date(`${dateKey}T${time}:00-05:00`);
}

export async function generateRecurringRehearsals(actorId: string, now = new Date(), daysAhead = 35) {
  const setting = await prisma.appSetting.findUnique({ where: { key: "rehearsalRecurrence" } });
  const parsed = recurrenceSchema.safeParse(setting?.value);
  if (!parsed.success || !parsed.data.enabled) return { created: 0, reason: "disabled" as const };
  const config = parsed.data;
  let created = 0;
  for (let offset = 0; offset <= daysAhead; offset += 1) {
    const candidate = new Date(now.getTime() + offset * 86_400_000);
    const dateKey = localDateKey(candidate);
    const noon = new Date(`${dateKey}T12:00:00-05:00`);
    if (noon.getDay() !== config.weekday) continue;
    const startsAt = localStart(dateKey, config.time);
    const recurrenceKey = `weekly:${config.sectionId ?? "all"}:${dateKey}:${config.time}`;
    const existing = await prisma.rehearsal.findUnique({ where: { recurrenceKey } });
    if (existing) continue;
    const members = await prisma.member.findMany({ where: { status: "ACTIVE", ...(config.sectionId ? { currentSectionId: config.sectionId } : {}) }, select: { id: true } });
    if (!members.length) continue;
    await prisma.$transaction(async (tx) => {
      const rehearsal = await tx.rehearsal.create({ data: {
        title: "Ensayo semanal",
        startsAt,
        endsAt: new Date(startsAt.getTime() + config.durationMinutes * 60_000),
        checkInOpensAt: new Date(startsAt.getTime() - config.openBeforeMinutes * 60_000),
        checkInClosesAt: new Date(startsAt.getTime() + config.closeAfterMinutes * 60_000),
        recurrenceKey,
        createdById: actorId,
      } });
      await tx.rehearsalInvitee.createMany({ data: members.map(({ id }) => ({ rehearsalId: rehearsal.id, memberId: id })) });
    });
    created += 1;
  }
  if (created) await prisma.auditLog.create({ data: { actorId, action: "RECURRING_REHEARSALS_GENERATED", entityType: "Rehearsal", summary: `${created} ensayo(s) recurrentes generados de forma idempotente.` } });
  return { created, reason: "ok" as const };
}
