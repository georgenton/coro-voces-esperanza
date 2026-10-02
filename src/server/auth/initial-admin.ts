import { AppRole, Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  classifyInitialAdminBootstrap,
  describeInitialAdminConflict,
  type InitialAdminBootstrapState,
} from "@/server/auth/initial-admin-policy";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function inspectInitialAdmin(email: string): Promise<InitialAdminBootstrapState> {
  const normalizedEmail = normalizeEmail(email);
  const [targetUser, superadminRoles] = await Promise.all([
    prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, roles: { where: { role: AppRole.SUPERADMIN }, select: { id: true } } },
    }),
    prisma.userRole.findMany({ where: { role: AppRole.SUPERADMIN }, select: { userId: true } }),
  ]);

  return classifyInitialAdminBootstrap({
    targetUserId: targetUser?.id ?? null,
    targetIsSuperadmin: Boolean(targetUser?.roles.length),
    superadminUserIds: superadminRoles.map(({ userId }) => userId),
  });
}

export async function createInitialAdmin(input: { email: string; name: string; password: string }) {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (!email || !name) throw new Error("El acceso inicial requiere nombre y correo explícitos.");
  if (input.password.length < 12 || input.password.length > 128) {
    throw new Error("La contraseña debe tener entre 12 y 128 caracteres.");
  }

  const state = await inspectInitialAdmin(email);
  if (state.kind === "ACTIVE") return { created: false as const, userId: state.userId };
  const conflict = describeInitialAdminConflict(state);
  if (conflict) throw new Error(conflict);

  const created = await auth.api.signUpEmail({ body: { email, password: input.password, name } });
  try {
    await prisma.$transaction(async (tx) => {
      const existingSuperadmin = await tx.userRole.findFirst({
        where: { role: AppRole.SUPERADMIN },
        select: { id: true },
      });
      if (existingSuperadmin) throw new Error("Ya existe otra cuenta SUPERADMIN. El bootstrap no creó un acceso adicional.");
      await tx.user.update({ where: { id: created.user.id }, data: { emailVerified: true } });
      await tx.userRole.create({ data: { userId: created.user.id, role: AppRole.SUPERADMIN } });
      await tx.auditLog.create({
        data: {
          actorId: created.user.id,
          action: "INITIAL_SUPERADMIN_CREATED",
          entityType: "User",
          entityId: created.user.id,
          summary: "Acceso SUPERADMIN inicial creado mediante bootstrap privado.",
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    await prisma.user.deleteMany({ where: { id: created.user.id, roles: { none: {} } } });
    throw error;
  }

  return { created: true as const, userId: created.user.id };
}
