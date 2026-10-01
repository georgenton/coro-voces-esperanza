import { AttendanceStatus, MemberStatus, Prisma, RehearsalStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { verifyAttendanceToken } from "@/server/attendance/tokens";

export async function checkInWithToken(token: string, userId: string, now = new Date()) {
  const payload = verifyAttendanceToken(token, now);
  try {
    return await prisma.$transaction(
      async (tx) => {
      const [rehearsal, member] = await Promise.all([
        tx.rehearsal.findUnique({ where: { id: payload.rehearsalId } }),
        tx.member.findUnique({ where: { authUserId: userId } }),
      ]);
      if (!rehearsal || !member) throw new Error("No existe una identidad de miembro vinculada.");
      const invited = await tx.rehearsalInvitee.findUnique({
        where: { rehearsalId_memberId: { rehearsalId: rehearsal.id, memberId: member.id } },
      });
      if (!invited) throw new Error("No constas en la convocatoria de este ensayo.");
      const validStatuses = new Set<RehearsalStatus>([RehearsalStatus.OPEN, RehearsalStatus.SCHEDULED]);
      if (!validStatuses.has(rehearsal.status)) {
        throw new Error("El ensayo no está abierto para asistencia.");
      }
      if (now < rehearsal.checkInOpensAt || now > rehearsal.checkInClosesAt) {
        throw new Error("La asistencia está fuera de la ventana habilitada.");
      }
      if (member.status !== MemberStatus.ACTIVE) throw new Error("Tu convocatoria requiere revisión.");
      const lateAt = new Date(rehearsal.startsAt.getTime() + rehearsal.lateAfterMinutes * 60_000);
      const status = now > lateAt ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
      const existing = await tx.attendance.findUnique({
        where: { rehearsalId_memberId: { rehearsalId: rehearsal.id, memberId: member.id } },
      });
      if (existing) return { attendance: existing, duplicate: true };
      const attendance = await tx.attendance.create({
        data: {
          rehearsalId: rehearsal.id,
          memberId: member.id,
          status,
          checkedInAt: now,
          source: "QR",
          recordedById: userId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "ATTENDANCE_QR_RECORDED",
          entityType: "Attendance",
          entityId: attendance.id,
          summary: "Asistencia individual registrada mediante QR.",
          metadata: { rehearsalId: rehearsal.id, status },
        },
      });
      return { attendance, duplicate: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    const member = await prisma.member.findUnique({ where: { authUserId: userId }, select: { id: true } });
    if (member) {
      const attendance = await prisma.attendance.findUnique({
        where: { rehearsalId_memberId: { rehearsalId: payload.rehearsalId, memberId: member.id } },
      });
      if (attendance) return { attendance, duplicate: true };
    }
    throw error;
  }
}
