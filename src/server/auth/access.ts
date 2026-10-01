import { AppRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export async function replaceUserAccess(input: { userId: string; roles: AppRole[]; sectionIds: string[] }, actorId: string) {
  if (!input.roles.length || input.roles.some((role) => !Object.values(AppRole).includes(role))) throw new Error("Selecciona al menos un rol válido.");
  return prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId: input.userId } });
    await tx.userRole.createMany({ data: input.roles.map((role) => ({ userId: input.userId, role })), skipDuplicates: true });
    await tx.userSectionScope.deleteMany({ where: { userId: input.userId } });
    if (input.roles.includes(AppRole.JEFE_DE_CUERDA) && input.sectionIds.length) {
      await tx.userSectionScope.createMany({ data: input.sectionIds.map((sectionId) => ({ userId: input.userId, sectionId })), skipDuplicates: true });
    }
    const revoked = await tx.session.deleteMany({ where: { userId: input.userId } });
    await tx.auditLog.create({ data: {
      actorId,
      action: "USER_ACCESS_CHANGED",
      entityType: "User",
      entityId: input.userId,
      summary: "Roles y alcance de cuerda actualizados; sesiones revocadas.",
      metadata: { roles: input.roles, sectionIds: input.sectionIds, revokedSessions: revoked.count },
    } });
    return { revokedSessions: revoked.count };
  });
}
