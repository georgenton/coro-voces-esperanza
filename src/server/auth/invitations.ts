import { createHash } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function consumeInvitation(input: { token: string; password: string; name: string }) {
  const tokenHash = createHash("sha256").update(input.token).digest("hex");
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash } });
  if (!invitation || invitation.consumedAt || invitation.expiresAt < new Date()) throw new Error("La invitación no es válida o ya caducó.");
  if (input.password.length < 12) throw new Error("La contraseña debe tener al menos 12 caracteres.");
  if (input.name.trim().length < 2) throw new Error("Escribe tu nombre.");

  const claimedAt = new Date();
  const claimed = await prisma.invitation.updateMany({
    where: { id: invitation.id, consumedAt: null, expiresAt: { gt: claimedAt } },
    data: { consumedAt: claimedAt },
  });
  if (claimed.count !== 1) throw new Error("La invitación ya fue utilizada por otra solicitud.");

  let created: Awaited<ReturnType<typeof auth.api.signUpEmail>>;
  try {
    created = await auth.api.signUpEmail({ body: { email: invitation.email, password: input.password, name: input.name.trim() } });
  } catch (error) {
    await prisma.invitation.updateMany({ where: { id: invitation.id, consumedAt: claimedAt }, data: { consumedAt: null } });
    throw error;
  }
  await prisma.$transaction(async (tx) => {
    await tx.userRole.create({ data: { userId: created.user.id, role: invitation.role } });
    if (invitation.memberId) await tx.member.update({ where: { id: invitation.memberId }, data: { authUserId: created.user.id } });
    await tx.auditLog.create({ data: {
      actorId: created.user.id,
      action: "INVITATION_ACCEPTED",
      entityType: "Invitation",
      entityId: invitation.id,
      summary: "Invitación de un solo uso aceptada.",
    } });
  });
  return created.user;
}
