"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppRole, AttendanceStatus, RehearsalStatus } from "@/generated/prisma/client";
import { assertCanAccessMember, requireAccess } from "@/lib/access";
import { prisma } from "@/lib/db";

function localDateTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Fecha y hora inválidas.");
  return new Date(`${value}:00-05:00`);
}
function safe(error: unknown) { return error instanceof Error ? error.message.slice(0, 180) : "No se completó la operación."; }

export async function createRehearsalAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.DIRECTORA]);
  let target = "/asistencia?success=Ensayo creado";
  try {
    const title = String(formData.get("title") ?? "").trim();
    if (title.length < 3) throw new Error("Escribe un título para el ensayo.");
    const startsAt = localDateTime(String(formData.get("startsAt") ?? ""));
    const endsAt = localDateTime(String(formData.get("endsAt") ?? ""));
    const opensAt = localDateTime(String(formData.get("opensAt") ?? ""));
    const closesAt = localDateTime(String(formData.get("closesAt") ?? ""));
    if (!(opensAt < closesAt) || !(startsAt < endsAt)) throw new Error("Las ventanas de tiempo no son coherentes.");
    const sectionId = String(formData.get("sectionId") ?? "");
    const members = await prisma.member.findMany({ where: { status: "ACTIVE", ...(sectionId ? { currentSectionId: sectionId } : {}) }, select: { id: true } });
    if (!members.length) throw new Error("La convocatoria seleccionada no contiene miembros activos.");
    await prisma.$transaction(async (tx) => {
      const rehearsal = await tx.rehearsal.create({ data: { title, startsAt, endsAt, checkInOpensAt: opensAt, checkInClosesAt: closesAt, lateAfterMinutes: Number(formData.get("lateAfterMinutes") ?? 15), tokenTtlSeconds: 60, createdById: access.userId } });
      await tx.rehearsalInvitee.createMany({ data: members.map(({ id }) => ({ rehearsalId: rehearsal.id, memberId: id })) });
      await tx.auditLog.create({ data: { actorId: access.userId, action: "REHEARSAL_CREATED", entityType: "Rehearsal", entityId: rehearsal.id, summary: "Ensayo y convocatoria explícita creados.", metadata: { invitees: members.length, sectionId: sectionId || null } } });
    });
    revalidatePath("/asistencia");
  } catch (error) { target = `/asistencia?error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}

export async function setRehearsalStatusAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.DIRECTORA]);
  let target = "/asistencia";
  try {
    const rehearsalId = String(formData.get("rehearsalId") ?? "");
    const status = String(formData.get("status") ?? "") as RehearsalStatus;
    const permittedStatuses = new Set<RehearsalStatus>([
      RehearsalStatus.OPEN,
      RehearsalStatus.CLOSED,
      RehearsalStatus.CANCELLED,
    ]);
    if (!permittedStatuses.has(status)) throw new Error("Estado inválido.");
    await prisma.$transaction(async (tx) => {
      const rehearsal = await tx.rehearsal.update({ where: { id: rehearsalId }, data: { status } });
      if (status === RehearsalStatus.CLOSED) {
        const invitees = await tx.rehearsalInvitee.findMany({ where: { rehearsalId }, select: { memberId: true } });
        const existing = new Set((await tx.attendance.findMany({ where: { rehearsalId }, select: { memberId: true } })).map(({ memberId }) => memberId));
        await tx.attendance.createMany({ data: invitees.filter(({ memberId }) => !existing.has(memberId)).map(({ memberId }) => ({ rehearsalId, memberId, status: AttendanceStatus.ABSENT, source: "CLOSE", recordedById: access.userId })), skipDuplicates: true });
      }
      if (status === RehearsalStatus.CANCELLED) {
        await tx.attendance.updateMany({ where: { rehearsalId }, data: { status: AttendanceStatus.CANCELLED, source: "CANCELLED" } });
      }
      await tx.auditLog.create({ data: { actorId: access.userId, action: "REHEARSAL_STATUS_CHANGED", entityType: "Rehearsal", entityId: rehearsal.id, summary: `Ensayo cambiado a ${status}.` } });
    });
    target = `/asistencia?success=${encodeURIComponent(status === RehearsalStatus.CLOSED ? "Ensayo cerrado y ausencias de convocados generadas" : "Estado actualizado")}`;
    revalidatePath("/asistencia");
  } catch (error) { target = `/asistencia?error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}

export async function manualAttendanceAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.DIRECTORA, AppRole.JEFE_DE_CUERDA]);
  let target = "/asistencia?success=Asistencia manual guardada";
  try {
    const memberId = String(formData.get("memberId") ?? "");
    const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    assertCanAccessMember(access, member);
    const rehearsalId = String(formData.get("rehearsalId") ?? "");
    const status = String(formData.get("status") ?? "") as AttendanceStatus;
    const permittedStatuses = new Set<AttendanceStatus>([
      AttendanceStatus.PRESENT,
      AttendanceStatus.LATE,
      AttendanceStatus.EXCUSED,
      AttendanceStatus.ABSENT,
    ]);
    if (!permittedStatuses.has(status)) throw new Error("Estado de asistencia inválido.");
    const note = String(formData.get("note") ?? "").trim();
    if (note.length < 5) throw new Error("La corrección manual requiere un motivo.");
    const invited = await prisma.rehearsalInvitee.findUnique({ where: { rehearsalId_memberId: { rehearsalId, memberId } } });
    if (!invited) throw new Error("El miembro no estaba convocado a este ensayo.");
    const presentStatuses = new Set<AttendanceStatus>([AttendanceStatus.PRESENT, AttendanceStatus.LATE]);
    const attendance = await prisma.attendance.upsert({ where: { rehearsalId_memberId: { rehearsalId, memberId } }, update: { status, source: "MANUAL", note, recordedById: access.userId }, create: { rehearsalId, memberId, status, checkedInAt: presentStatuses.has(status) ? new Date() : null, source: "MANUAL", note, recordedById: access.userId } });
    await prisma.auditLog.create({ data: { actorId: access.userId, action: "ATTENDANCE_MANUAL_RECORDED", entityType: "Attendance", entityId: attendance.id, summary: "Asistencia manual registrada con motivo." } });
    revalidatePath("/asistencia");
  } catch (error) { target = `/asistencia?error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}
