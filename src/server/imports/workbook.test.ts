import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { previewWorkbook } from "@/server/imports/workbook";

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
});
