"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function acceptInvitationAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  let target = `/invitacion/${encodeURIComponent(token)}`;
  try {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const invitation = await prisma.invitation.findUnique({ where: { tokenHash } });
    if (!invitation || invitation.consumedAt || invitation.expiresAt < new Date()) throw new Error("La invitación no es válida o ya caducó.");
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    if (password.length < 12) throw new Error("La contraseña debe tener al menos 12 caracteres.");
    if (name.length < 2) throw new Error("Escribe tu nombre.");
    const created = await auth.api.signUpEmail({ body: { email: invitation.email, password, name } });
    await prisma.$transaction(async (tx) => {
      await tx.userRole.create({ data: { userId: created.user.id, role: invitation.role } });
      if (invitation.memberId) await tx.member.update({ where: { id: invitation.memberId }, data: { authUserId: created.user.id } });
      await tx.invitation.update({ where: { id: invitation.id }, data: { consumedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: created.user.id, action: "INVITATION_ACCEPTED", entityType: "Invitation", entityId: invitation.id, summary: "Invitación de un solo uso aceptada." } });
    });
    target = "/ingresar?success=Cuenta activada";
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0,180) : "No se pudo activar la cuenta.";
    target += `?error=${encodeURIComponent(message)}`;
  }
  redirect(target);
}
