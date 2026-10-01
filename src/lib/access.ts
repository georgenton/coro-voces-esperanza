import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppRole, type Member } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type AccessContext = {
  userId: string;
  name: string;
  email: string;
  roles: AppRole[];
  sectionIds: string[];
  memberId: string | null;
};

export const getAccessContext = cache(async (): Promise<AccessContext | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      roles: { select: { role: true } },
      sectionScopes: { select: { sectionId: true } },
      member: { select: { id: true } },
    },
  });
  if (!user) return null;
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles.map(({ role }) => role),
    sectionIds: user.sectionScopes.map(({ sectionId }) => sectionId),
    memberId: user.member?.id ?? null,
  };
});

export async function requireAccess(allowed?: AppRole[]) {
  const context = await getAccessContext();
  if (!context) redirect("/ingresar");
  if (allowed && !allowed.some((role) => context.roles.includes(role))) {
    redirect("/sin-acceso");
  }
  return context;
}

export function isFinanceRole(access: AccessContext) {
  const allowed = new Set<AppRole>([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  return access.roles.some((role) => allowed.has(role));
}

export function isGlobalReadRole(access: AccessContext) {
  const allowed = new Set<AppRole>([
    AppRole.SUPERADMIN,
    AppRole.ADMIN,
    AppRole.TESORERIA,
    AppRole.DIRECTORA,
  ]);
  return access.roles.some((role) => allowed.has(role));
}

export function canAccessMember(
  access: AccessContext,
  member: Pick<Member, "id" | "currentSectionId">,
) {
  if (isGlobalReadRole(access)) return true;
  if (access.roles.includes(AppRole.JEFE_DE_CUERDA)) {
    return Boolean(member.currentSectionId && access.sectionIds.includes(member.currentSectionId));
  }
  return access.roles.includes(AppRole.MIEMBRO) && access.memberId === member.id;
}

export function assertCanAccessMember(
  access: AccessContext,
  member: Pick<Member, "id" | "currentSectionId">,
) {
  if (!canAccessMember(access, member)) throw new AccessDeniedError();
}

export class AccessDeniedError extends Error {
  status = 403;
  constructor() {
    super("No tienes permiso para esta operación.");
  }
}
