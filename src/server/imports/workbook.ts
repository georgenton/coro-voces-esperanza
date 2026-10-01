import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { z } from "zod";

const MAX_SHEETS = 50;
const MAX_ROWS_PER_SHEET = 10_000;
const MAX_CELLS = 250_000;

const spreadsheetValueSchema = z.union([z.string(), z.number(), z.boolean(), z.date(), z.null()]);

function cellText(cell: ExcelJS.Cell) {
  if (cell.value == null) return "";
  if (typeof cell.value === "object" && "formula" in cell.value) {
    const result = "result" in cell.value ? cell.value.result : null;
    return result == null ? String(cell.value.formula) : String(result);
  }
  if (cell.value instanceof Date) return cell.value.toISOString();
  if (typeof cell.value === "object") return cell.text;
  const parsed = spreadsheetValueSchema.safeParse(cell.value);
  return parsed.success ? String(parsed.data ?? "") : cell.text;
}

export type WorkbookPreview = {
  sha256: string;
  sheetCount: number;
  sheets: Array<{
    name: string;
    rowCount: number;
    columnCount: number;
    sample: string[][];
  }>;
  rows: Array<{
    sheetName: string;
    rowNumber: number;
    rawText: string;
    fingerprint: string;
  }>;
  issues: Array<{ code: string; sheetName?: string; cellReference?: string; message: string }>;
};

export async function previewWorkbook(buffer: Buffer): Promise<WorkbookPreview> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  if (workbook.worksheets.length === 0 || workbook.worksheets.length > MAX_SHEETS) {
    throw new Error("Cantidad de hojas fuera del límite permitido.");
  }
  let totalCells = 0;
  const rows: WorkbookPreview["rows"] = [];
  const sheets: WorkbookPreview["sheets"] = [];
  const issues: WorkbookPreview["issues"] = [];

  for (const sheet of workbook.worksheets) {
    if (sheet.rowCount > MAX_ROWS_PER_SHEET) throw new Error(`La hoja ${sheet.name} excede el límite de filas.`);
    totalCells += sheet.rowCount * sheet.columnCount;
    if (totalCells > MAX_CELLS) throw new Error("El libro excede el límite de celdas para vista previa.");
    const sample: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const values: string[] = [];
      for (let column = 1; column <= Math.min(sheet.columnCount, 24); column += 1) {
        values.push(cellText(row.getCell(column)).slice(0, 300));
      }
      while (values.at(-1) === "") values.pop();
      const rawText = values.join(" | ").slice(0, 4_000);
      if (rawText) {
        rows.push({
          sheetName: sheet.name,
          rowNumber,
          rawText,
          fingerprint: createHash("sha256").update(`${sheet.name}\n${rowNumber}\n${rawText}`).digest("hex"),
        });
      }
      if (sample.length < 8) sample.push(values.slice(0, 12));
    });
    sheets.push({ name: sheet.name, rowCount: sheet.rowCount, columnCount: sheet.columnCount, sample });
  }

  const names = new Set(sheets.map(({ name }) => name));
  if (names.has("1.a SOLO CUOTAS 2026")) {
    const dues = workbook.getWorksheet("1.a SOLO CUOTAS 2026");
    if (dues?.getCell("B49").value !== 35) {
      issues.push({ code: "MIG-004", sheetName: dues?.name, cellReference: "B49", message: "El contador escrito no coincide con la estructura esperada; contar filas de personas en revisión." });
    } else {
      issues.push({ code: "MIG-004", sheetName: dues.name, cellReference: "B49", message: "El contador escrito debe contrastarse con las filas de personas; no usarlo como fuente única." });
    }
    issues.push({ code: "MIG-X-MONTH", sheetName: dues?.name, message: "Las marcas X mensuales son propuestas de no exigibilidad y requieren motivo aprobado." });
  }
  if (!names.has("INDICE GENERAL")) {
    issues.push({ code: "STRUCTURE-INDEX", message: "No se encontró una hoja de índice; revisar el mapeo del libro." });
  }
  issues.push({ code: "BANK-DATE", message: "Las celdas por período no prueban la fecha bancaria; las fechas desconocidas permanecerán nulas." });

  return {
    sha256: createHash("sha256").update(buffer).digest("hex"),
    sheetCount: sheets.length,
    sheets,
    rows,
    issues,
  };
}
