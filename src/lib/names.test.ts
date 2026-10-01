import { describe, expect, it } from "vitest";
import { neutralizeCsvCell, normalizeName } from "@/lib/names";

describe("normalización segura", () => {
  it("conserva una coincidencia exacta normalizada sin implementar similitud débil", () => {
    expect(normalizeName("  Persona Álvarez ")).toBe("persona alvarez");
    expect(normalizeName("Álvarez")).not.toBe(normalizeName("Persona Álvarez"));
  });

  it("neutraliza fórmulas al exportar CSV", () => {
    expect(neutralizeCsvCell("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(neutralizeCsvCell("Texto normal")).toBe("Texto normal");
  });
});
