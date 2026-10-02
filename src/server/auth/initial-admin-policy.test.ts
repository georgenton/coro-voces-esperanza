import { describe, expect, it } from "vitest";
import { classifyInitialAdminBootstrap, describeInitialAdminConflict } from "@/server/auth/initial-admin-policy";

describe("bootstrap del SUPERADMIN inicial", () => {
  it("queda listo únicamente con la base sin SUPERADMIN y sin la identidad objetivo", () => {
    expect(classifyInitialAdminBootstrap({
      targetUserId: null,
      targetIsSuperadmin: false,
      superadminUserIds: [],
    })).toEqual({ kind: "READY" });
  });

  it("es idempotente para la misma cuenta ya activa", () => {
    expect(classifyInitialAdminBootstrap({
      targetUserId: "user-approved",
      targetIsSuperadmin: true,
      superadminUserIds: ["user-approved"],
    })).toEqual({ kind: "ACTIVE", userId: "user-approved" });
  });

  it("no eleva una cuenta preexistente sin SUPERADMIN", () => {
    const state = classifyInitialAdminBootstrap({
      targetUserId: "user-existing",
      targetIsSuperadmin: false,
      superadminUserIds: [],
    });
    expect(state).toEqual({ kind: "CONFLICT_EXISTING_USER", userId: "user-existing" });
    expect(describeInitialAdminConflict(state)).toContain("no la elevó");
  });

  it("bloquea un segundo SUPERADMIN aunque use otro correo", () => {
    const state = classifyInitialAdminBootstrap({
      targetUserId: null,
      targetIsSuperadmin: false,
      superadminUserIds: ["user-other"],
    });
    expect(state).toEqual({ kind: "CONFLICT_OTHER_SUPERADMIN" });
    expect(describeInitialAdminConflict(state)).toContain("no modificó usuarios");
  });

  it("reporta conflicto si la cuenta aprobada convive con otro SUPERADMIN", () => {
    expect(classifyInitialAdminBootstrap({
      targetUserId: "user-approved",
      targetIsSuperadmin: true,
      superadminUserIds: ["user-approved", "user-other"],
    })).toEqual({ kind: "CONFLICT_OTHER_SUPERADMIN" });
  });
});
