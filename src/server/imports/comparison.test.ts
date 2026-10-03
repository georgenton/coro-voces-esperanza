import { describe, expect, it } from "vitest";
import { compareSourceRows } from "@/server/imports/comparison";

describe("comparación conservadora entre versiones del Excel", () => {
  it("distingue coincidencias, modificaciones, nuevos y ausentes sin usar el número de fila como identidad", () => {
    const previous = [
      { id: "p1", sheetName: "FEBRERO 2026", rowNumber: 3, contentFingerprint: "same", semanticKey: "movement:a" },
      { id: "p2", sheetName: "MARZO 2026", rowNumber: 4, contentFingerprint: "old", semanticKey: "movement:b" },
      { id: "p3", sheetName: "ABRIL 2026", rowNumber: 5, contentFingerprint: "gone", semanticKey: "movement:c" },
    ];
    const current = [
      { id: "c1", sheetName: "FEBRERO 2026", rowNumber: 9, contentFingerprint: "same", semanticKey: "movement:a" },
      { id: "c2", sheetName: "MARZO 2026", rowNumber: 4, contentFingerprint: "changed", semanticKey: "movement:b" },
      { id: "c3", sheetName: "MAYO 2026", rowNumber: 7, contentFingerprint: "new", semanticKey: "movement:d" },
    ];
    const result = compareSourceRows(current, previous);
    expect(result.counts).toMatchObject({ MATCHING: 1, MODIFIED: 1, NEW: 1, ABSENT: 1 });
  });

  it("no fusiona dos operaciones legítimas con la misma fecha, importe y descripción", () => {
    const previous = [
      { id: "p1", sheetName: "MARZO 2026", rowNumber: 4, contentFingerprint: "duplicate", semanticKey: "movement:same" },
      { id: "p2", sheetName: "MARZO 2026", rowNumber: 5, contentFingerprint: "duplicate", semanticKey: "movement:same" },
    ];
    const current = [
      { id: "c1", sheetName: "MARZO 2026", rowNumber: 8, contentFingerprint: "duplicate", semanticKey: "movement:same" },
      { id: "c2", sheetName: "MARZO 2026", rowNumber: 9, contentFingerprint: "duplicate", semanticKey: "movement:same" },
    ];
    const result = compareSourceRows(current, previous);
    expect(result.counts.AMBIGUOUS).toBe(2);
    expect(result.counts.MATCHING).toBe(0);
  });

  it("marca como ya importado solo cuando existe publicación previa", () => {
    const previous = [{ id: "p1", sheetName: "JUNIO 2026", rowNumber: 3, contentFingerprint: "same", semanticKey: "movement:a", publicationCount: 1 }];
    const current = [{ id: "c1", sheetName: "JUNIO 2026", rowNumber: 7, contentFingerprint: "same", semanticKey: "movement:a" }];
    expect(compareSourceRows(current, previous).counts.ALREADY_IMPORTED).toBe(1);
  });

  it("no cuenta como ausente la versión anterior de una fila ya publicada", () => {
    const previous = [{ id: "p1", sheetName: "JUNIO 2026", rowNumber: 3, contentFingerprint: "same", semanticKey: "movement:a" }];
    const current = [{ id: "c1", sheetName: "JUNIO 2026", rowNumber: 7, contentFingerprint: "same", semanticKey: "movement:a", publicationCount: 1 }];
    const result = compareSourceRows(current, previous);
    expect(result.counts.ALREADY_IMPORTED).toBe(1);
    expect(result.counts.ABSENT).toBe(0);
  });
});
