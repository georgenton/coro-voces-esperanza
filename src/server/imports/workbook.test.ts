import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { EXPECTED_SOURCE_SHEETS, previewWorkbook } from "@/server/imports/workbook";

describe("vista previa XLSX", () => {
  it("genera staging sintético sin convertir celdas en dinero", async () => {
    const workbook = new ExcelJS.Workbook();
    const index = workbook.addWorksheet("INDICE GENERAL");
    index.addRow(["Hoja", "Descripción"]);
    const dues = workbook.addWorksheet("1.a SOLO CUOTAS 2026");
    dues.getCell("A1").value = "Matriz ficticia";
    dues.getCell("B49").value = 35;
    dues.getCell("E4").value = "X";
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    const preview = await previewWorkbook(bytes);
    expect(preview.sheetCount).toBe(2);
    expect(preview.rows.length).toBeGreaterThan(0);
    expect(preview.issues.some(({ code }) => code === "MIG-X-MONTH")).toBe(true);
    expect(preview.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("lee las 30 hojas, ordena los meses cronológicamente y conserva bloques por año", async () => {
    const workbook = new ExcelJS.Workbook();
    for (const name of EXPECTED_SOURCE_SHEETS) workbook.addWorksheet(name).getCell("A1").value = `Fuente ${name}`;
    const savings = workbook.getWorksheet("2. CUENTA AHORRO FLEXIBLE")!;
    savings.getCell("A2").value = "AÑO 2025";
    savings.getCell("A29").value = "AÑO 2026";
    const parking = workbook.getWorksheet("3. PAGO PARQUEADERO")!;
    parking.getCell("B2").value = "PAGOS COSTO PARQUEADERO 2025";
    parking.getCell("B18").value = "PAGOS COSTO PARQUEADERO 2026";

    const preview = await previewWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()));
    expect(preview.sheetCount).toBe(30);
    expect(preview.sourceSummary.monthlySheetCount).toBe(22);
    expect(preview.sourceSummary.monthlyPeriods.at(0)).toBe("2025-01");
    expect(preview.sourceSummary.monthlyPeriods.at(-1)).toBe("2026-10");
    expect(preview.sheets.find(({ name }) => name === "2. CUENTA AHORRO FLEXIBLE")?.blockYears).toEqual([2025, 2026]);
    expect(preview.sheets.find(({ name }) => name === "3. PAGO PARQUEADERO")?.blockYears).toEqual([2025, 2026]);
    expect(preview.issues.some(({ code }) => code === "SOURCE_SHEET_INVENTORY")).toBe(false);
  });

  it("conserva fechas contradictorias, fórmulas, valores cacheados y casos humanos sin corregirlos", async () => {
    const workbook = new ExcelJS.Workbook();
    for (const name of EXPECTED_SOURCE_SHEETS) workbook.addWorksheet(name).getCell("A1").value = `Fuente ${name}`;
    const october = workbook.getWorksheet("OCTUBRE 2026")!;
    october.getCell("A3").value = new Date("2025-10-01T05:00:00.000Z");
    october.getCell("C3").value = 28;
    october.getCell("D25").value = "SALDO OCTUBRE 2025";
    const september = workbook.getWorksheet("SEPTIEMBRE 2026")!;
    september.getCell("D27").value = "SALDO AL 7 AGOSTO 2025";
    september.getCell("G18").value = "Persona ficticia por incorporar";
    september.getCell("G23").value = "Otra persona ficticia por incorporar";
    const matrix = workbook.getWorksheet("1.a SOLO CUOTAS 2026")!;
    matrix.getCell("B4").value = "Dirección ficticia";
    matrix.getCell("C30").value = "Persona ficticia sin número";
    matrix.getCell("O44").value = 55;
    matrix.getCell("B49").value = 35;
    matrix.getCell("P4").value = { formula: "SUM(D4:N4)", result: 50 };
    for (let row = 4; row <= 27; row += 1) matrix.getCell(`I${row}`).value = 5;

    const preview = await previewWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()));
    expect(preview.sheets.find(({ name }) => name === "OCTUBRE 2026")?.coverageStatus).toBe("PARTIAL");
    expect(preview.issues.some(({ code, cellReference }) => code === "DATE_CONFLICT" && cellReference === "A3")).toBe(true);
    expect(preview.issues.some(({ code }) => code === "MATRIX_PERSON_WITHOUT_NUMBER")).toBe(true);
    expect(preview.issues.find(({ code }) => code === "MATRIX_JUNE_RULE_REVIEW")?.evidence).toContain("24");
    expect(preview.cells.find(({ sheetName, cellReference }) => sheetName === "1.a SOLO CUOTAS 2026" && cellReference === "P4")).toMatchObject({ formula: "SUM(D4:N4)", cachedValue: "50" });
    expect(preview.cells.find(({ sheetName, cellReference }) => sheetName === "1.a SOLO CUOTAS 2026" && cellReference === "O44")?.literalValue).toBe("55");
  });

  it("separa la huella de contenido de la procedencia física de la fila", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("FEBRERO 2026");
    sheet.addRow(["Encabezado"]);
    sheet.addRow(["Saldo de apertura"]);
    sheet.addRow([new Date("2026-02-10T05:00:00.000Z"), "Cuota", 5]);
    sheet.addRow([new Date("2026-02-10T05:00:00.000Z"), "Cuota", 5]);
    const preview = await previewWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()));
    const candidates = preview.rows.filter(({ sourceKind }) => sourceKind === "MONTHLY_MOVEMENT_CANDIDATE");
    expect(candidates).toHaveLength(2);
    expect(candidates[0].contentFingerprint).toBe(candidates[1].contentFingerprint);
    expect(candidates[0].fingerprint).not.toBe(candidates[1].fingerprint);
  });

  it("conserva la apertura mensual como contexto y solo marca una fecha de apertura incoherente", async () => {
    const workbook = new ExcelJS.Workbook();
    const valid = workbook.addWorksheet("FEBRERO 2026");
    valid.addRow(["Encabezado"]);
    valid.addRow([new Date("2026-01-31T05:00:00.000Z"), "Saldo anterior", 25]);
    valid.addRow([new Date("2026-01-15T05:00:00.000Z"), "Movimiento fuera de mes", 5]);
    const invalid = workbook.addWorksheet("AGOSTO 2026");
    invalid.addRow(["Encabezado"]);
    invalid.addRow([new Date("2025-07-31T05:00:00.000Z"), "Saldo anterior", 10]);

    const preview = await previewWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()));
    expect(preview.rows.find(({ sheetName, rowNumber }) => sheetName === "FEBRERO 2026" && rowNumber === 2)).toMatchObject({
      sourceKind: "MONTHLY_OPENING_CONTEXT",
      isAggregate: true,
    });
    expect(preview.issues.some(({ code, sheetName }) => code === "DATE_OUTSIDE_NOMINAL_MONTH" && sheetName === "FEBRERO 2026")).toBe(true);
    expect(preview.issues.some(({ code, sheetName }) => code === "OPENING_DATE_CONFLICT" && sheetName === "FEBRERO 2026")).toBe(false);
    expect(preview.issues.some(({ code, sheetName }) => code === "OPENING_DATE_CONFLICT" && sheetName === "AGOSTO 2026")).toBe(true);
  });

  it("mantiene la clave semántica al cambiar solo el importe de un movimiento", async () => {
    const workbook = (amount: number) => {
      const value = new ExcelJS.Workbook();
      const sheet = value.addWorksheet("MARZO 2026");
      sheet.addRow(["Encabezado"]);
      sheet.addRow(["Saldo de apertura"]);
      sheet.addRow([new Date("2026-03-10T05:00:00.000Z"), "", amount, "Cuota ficticia"]);
      return value;
    };
    const before = await previewWorkbook(Buffer.from(await workbook(5).xlsx.writeBuffer()));
    const after = await previewWorkbook(Buffer.from(await workbook(10).xlsx.writeBuffer()));
    const beforeRow = before.rows.find(({ sourceKind }) => sourceKind === "MONTHLY_MOVEMENT_CANDIDATE")!;
    const afterRow = after.rows.find(({ sourceKind }) => sourceKind === "MONTHLY_MOVEMENT_CANDIDATE")!;
    expect(afterRow.semanticKey).toBe(beforeRow.semanticKey);
    expect(afterRow.contentFingerprint).not.toBe(beforeRow.contentFingerprint);
  });
});
