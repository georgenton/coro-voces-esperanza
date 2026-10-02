import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { AppRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createInitialAdmin } from "@/server/auth/initial-admin";

describe("bootstrap inicial contra PostgreSQL", () => {
  const suffix = randomUUID();
  const firstEmail = `admin-inicial-${suffix}@example.test`;
  const secondEmail = `admin-segundo-${suffix}@example.test`;
  let createdUserId: string | null = null;

  afterAll(async () => {
    if (createdUserId) {
      await prisma.auditLog.deleteMany({ where: { action: "INITIAL_SUPERADMIN_CREATED", entityId: createdUserId } });
      await prisma.user.deleteMany({ where: { id: createdUserId } });
    }
    await prisma.user.deleteMany({ where: { email: { in: [firstEmail, secondEmail] } } });
    await prisma.$disconnect();
  });

  it("crea una sola cuenta sin ficha de miembro y conserva credenciales y sesiones al repetir", async () => {
    const created = await createInitialAdmin({
      email: firstEmail,
      name: "Administradora Sintética",
      password: "Synthetic-bootstrap-password-123",
    });
    expect(created.created).toBe(true);
    createdUserId = created.userId;

    const originalAccount = await prisma.account.findFirstOrThrow({
      where: { userId: created.userId },
      select: { password: true },
    });
    await prisma.session.create({
      data: {
        id: `session-${suffix}`,
        token: `token-${suffix}`,
        userId: created.userId,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const repeated = await createInitialAdmin({
      email: firstEmail.toUpperCase(),
      name: "Nombre que no debe sustituirse",
      password: "Different-synthetic-password-456",
    });
    expect(repeated).toEqual({ created: false, userId: created.userId });

    const [user, roleCount, memberCount, sessionCount, account] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: created.userId }, select: { name: true } }),
      prisma.userRole.count({ where: { userId: created.userId, role: AppRole.SUPERADMIN } }),
      prisma.member.count({ where: { authUserId: created.userId } }),
      prisma.session.count({ where: { userId: created.userId } }),
      prisma.account.findFirstOrThrow({ where: { userId: created.userId }, select: { password: true } }),
    ]);
    expect(user.name).toBe("Administradora Sintética");
    expect(roleCount).toBe(1);
    expect(memberCount).toBe(0);
    expect(sessionCount).toBe(1);
    expect(account.password).toBe(originalAccount.password);
  });

  it("rechaza crear un segundo SUPERADMIN", async () => {
    await expect(createInitialAdmin({
      email: secondEmail,
      name: "Segunda Administradora Sintética",
      password: "Synthetic-bootstrap-password-789",
    })).rejects.toThrow("otra cuenta SUPERADMIN");
    expect(await prisma.user.count({ where: { email: secondEmail } })).toBe(0);
  });
});
