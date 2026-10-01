import { describe, expect, it } from "vitest";
import { AppRole } from "@/generated/prisma/client";
import { canAccessMember, type AccessContext } from "@/lib/access";

function access(overrides: Partial<AccessContext>): AccessContext {
  return {
    userId: "user-test",
    name: "Persona ficticia",
    email: "persona@example.test",
    roles: [],
    sectionIds: [],
    memberId: null,
    ...overrides,
  };
}

describe("alcance por objeto", () => {
  it("un jefe no puede consultar otra cuerda", () => {
    const chief = access({ roles: [AppRole.JEFE_DE_CUERDA], sectionIds: ["soprano"] });
    expect(canAccessMember(chief, { id: "member-1", currentSectionId: "tenor" })).toBe(false);
  });

  it("un jefe puede consultar su cuerda", () => {
    const chief = access({ roles: [AppRole.JEFE_DE_CUERDA], sectionIds: ["soprano"] });
    expect(canAccessMember(chief, { id: "member-1", currentSectionId: "soprano" })).toBe(true);
  });

  it("un miembro solo puede consultar su propia ficha", () => {
    const member = access({ roles: [AppRole.MIEMBRO], memberId: "member-1" });
    expect(canAccessMember(member, { id: "member-1", currentSectionId: "soprano" })).toBe(true);
    expect(canAccessMember(member, { id: "member-2", currentSectionId: "soprano" })).toBe(false);
  });

  it("Dirección tiene lectura global", () => {
    const director = access({ roles: [AppRole.DIRECTORA] });
    expect(canAccessMember(director, { id: "member-2", currentSectionId: "tenor" })).toBe(true);
  });
});
