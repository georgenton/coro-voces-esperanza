"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppRole } from "@/generated/prisma/client";
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/db";

function safe(error: unknown) { return error instanceof Error ? error.message.slice(0, 180) : "No se guardó la configuración."; }

export async function createInvitationAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN]);
  let target = "/configuracion";
  try {
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Correo inválido.");
    const role = String(formData.get("role") ?? "MIEMBRO") as AppRole;
    if (!Object.values(AppRole).includes(role)) throw new Error("Rol inválido.");
    const memberId = String(formData.get("memberId") ?? "") || null;
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.invitation.create({ data: { email, role, memberId, tokenHash, expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), createdById: access.userId } });
    await prisma.auditLog.create({ data: { actorId: access.userId, action: "INVITATION_CREATED", entityType: "Invitation", summary: "Invitación individual creada con vigencia de 48 horas.", metadata: { role, memberId } } });
    target = `/configuracion?success=Invitación creada&invite=${encodeURIComponent(token)}`;
    revalidatePath("/configuracion");
  } catch (error) { target = `/configuracion?error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}

export async function setUserAccessAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN]);
  let target = "/configuracion?success=Acceso actualizado; sesiones anteriores revocadas";
  try {
    const userId = String(formData.get("userId") ?? "");
    const roles = formData.getAll("roles").map(String) as AppRole[];
    const sectionIds = formData.getAll("sectionIds").map(String);
    if (!roles.length || roles.some((role) => !Object.values(AppRole).includes(role))) throw new Error("Selecciona al menos un rol válido.");
    if (userId === access.userId && !roles.includes(AppRole.SUPERADMIN)) throw new Error("No puedes retirar tu propio acceso SUPERADMIN.");
    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.createMany({ data: roles.map((role) => ({ userId, role })), skipDuplicates: true });
      await tx.userSectionScope.deleteMany({ where: { userId } });
      if (roles.includes(AppRole.JEFE_DE_CUERDA) && sectionIds.length) await tx.userSectionScope.createMany({ data: sectionIds.map((sectionId) => ({ userId, sectionId })), skipDuplicates: true });
      await tx.session.deleteMany({ where: { userId } });
      await tx.auditLog.create({ data: { actorId: access.userId, action: "USER_ACCESS_CHANGED", entityType: "User", entityId: userId, summary: "Roles y alcance de cuerda actualizados; sesiones revocadas.", metadata: { roles, sectionIds } } });
    });
    revalidatePath("/configuracion");
  } catch (error) { target = `/configuracion?error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}

export async function createFinancialAccountAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN]);
  let target = "/configuracion?success=Cuenta financiera creada";
  try {
    const name = String(formData.get("name") ?? "").trim();
    const kind = String(formData.get("kind") ?? "").trim();
    if (name.length < 3 || kind.length < 2) throw new Error("Nombre o tipo de cuenta inválido.");
    const account = await prisma.financialAccount.create({ data: { name, kind } });
    await prisma.auditLog.create({ data: { actorId: access.userId, action: "FINANCIAL_ACCOUNT_CREATED", entityType: "FinancialAccount", entityId: account.id, summary: "Cuenta financiera creada sin saldo inicial inventado." } });
    revalidatePath("/configuracion");
  } catch (error) { target = `/configuracion?error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}

export async function saveRehearsalRecurrenceAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN]);
  let target = "/configuracion?success=Recurrencia guardada";
  try {
    const weekday = Number(formData.get("weekday"));
    const time = String(formData.get("time") ?? "");
    const durationMinutes = Number(formData.get("durationMinutes"));
    const openBeforeMinutes = Number(formData.get("openBeforeMinutes"));
    const closeAfterMinutes = Number(formData.get("closeAfterMinutes"));
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Día u hora inválidos.");
    if (![durationMinutes, openBeforeMinutes, closeAfterMinutes].every((value) => Number.isInteger(value) && value >= 0 && value <= 480)) throw new Error("Duración o ventana inválida.");
    const value = { enabled: formData.get("enabled") === "on", weekday, time, durationMinutes, openBeforeMinutes, closeAfterMinutes, sectionId: String(formData.get("sectionId") ?? "") || null };
    await prisma.appSetting.upsert({ where: { key: "rehearsalRecurrence" }, update: { value, updatedById: access.userId }, create: { key: "rehearsalRecurrence", value, updatedById: access.userId } });
    await prisma.auditLog.create({ data: { actorId: access.userId, action: "REHEARSAL_RECURRENCE_CHANGED", entityType: "AppSetting", entityId: "rehearsalRecurrence", summary: "Recurrencia de ensayos configurada explícitamente.", metadata: value } });
    revalidatePath("/configuracion");
  } catch (error) { target = `/configuracion?error=${encodeURIComponent(safe(error))}`; }
  redirect(target);
}
