import { createHash } from "node:crypto";
import ExcelJS from "exceljs";

const MAX_SHEETS = 50;
const MAX_ROWS_PER_SHEET = 10_000;
const MAX_CELLS = 250_000;
const MAX_COLUMNS_PER_ROW = 64;

export const EXPECTED_SOURCE_SHEETS = [
  "INDICE GENERAL",
  "1. SOLO CUOTAS 2025",
  "1.a SOLO CUOTAS 2026",
  "2. CUENTA AHORRO FLEXIBLE",
  "3. PAGO PARQUEADERO",
  "4. APORTES MIEMBROS RETIRADOS",
  "5. PAGO CAMISETAS NUEVAS",
  "6. EVENTO CORAL INTEGRACIÓN",
  "ENERO 2025",
  "ENERO 2026",
  "FEBRERO 2025",
  "FEBRERO 2026",
  "MARZO 2025",
  "MARZO 2026",
  "ABRIL 2025",
  "ABRIL 2026",
  "MAYO 2025",
  "MAYO 2026",
  "JUNIO 2025",
  "JUNIO 2026",
  "JULIO 2025",
  "JULIO 2026",
  "AGOSTO 2025",
  "AGOSTO 2026",
  "SEPTIEMBRE 2025",
  "SEPTIEMBRE 2026",
  "OCTUBRE 2025",
  "OCTUBRE 2026",
  "NOVIEMBRE 2025",
  "DICIEMBRE 2025",
] as const;

const MONTH_NUMBER = new Map([
  ["ENERO", 1], ["FEBRERO", 2], ["MARZO", 3], ["ABRIL", 4],
  ["MAYO", 5], ["JUNIO", 6], ["JULIO", 7], ["AGOSTO", 8],
  ["SEPTIEMBRE", 9], ["OCTUBRE", 10], ["NOVIEMBRE", 11], ["DICIEMBRE", 12],
]);

export type SourceIssue = {
  code: string;
  sheetName?: string;
  cellReference?: string;
  message: string;
  evidence?: string;
  proposal?: string;
  decisionNeeded?: string;
};

export type SourceCell = {
  sheetName: string;
  cellReference: string;
  rowNumber: number;
  columnNumber: number;
  valueType: string;
  literalValue: string | null;
  formula: string | null;
  cachedValue: string | null;
  displayValue: string | null;
  annotation: string | null;
  originalDate: string | null;
  numberFormat: string | null;
  styleEvidence: Record<string, unknown> | null;
};

export type WorkbookPreview = {
  sha256: string;
  sheetCount: number;
  sheets: Array<{
    name: string;
    physicalOrder: number;
    kind: string;
    nominalPeriod: string | null;
    coverageStatus: "DOCUMENTED" | "PARTIAL";
    rowCount: number;
    columnCount: number;
    declaredRange: string;
    blockYears: number[];
    sample: string[][];
  }>;
  rows: Array<{
    sheetName: string;
    rowNumber: number;
    rawText: string;
    fingerprint: string;
    contentFingerprint: string;
    semanticKey: string | null;
    sourceKind: string;
    nominalPeriod: string | null;
    sourceData: { cells: Array<{ cellReference: string; displayValue: string | null; formula: string | null; cachedValue: string | null }> };
    firstCellReference: string | null;
    lastCellReference: string | null;
    isAggregate: boolean;
  }>;
  cells: SourceCell[];
  issues: SourceIssue[];
  sourceSummary: {
    expectedSheetCount: number;
    monthlySheetCount: number;
    monthlyPeriods: string[];
    cutoff: string;
    cutoffTimezone: string;
    partialPeriods: string[];
  };
};

function hash(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function columnName(column: number) {
  let value = column;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function plainValue(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && "text" in value && typeof value.text === "string") return value.text;
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => typeof part === "object" && part && "text" in part ? String(part.text) : "").join("");
  }
  return JSON.stringify(value);
}

function noteText(note: ExcelJS.Cell["note"]): string | null {
  if (!note) return null;
  if (typeof note === "string") return note;
  if ("texts" in note && Array.isArray(note.texts)) return note.texts.map((part) => part.text).join("");
  return JSON.stringify(note);
}

function colorEvidence(color: Partial<ExcelJS.Color> | undefined) {
  if (!color) return null;
  const extended = color as Partial<ExcelJS.Color> & { indexed?: number; tint?: number };
  const value = { argb: color.argb, indexed: extended.indexed, theme: color.theme, tint: extended.tint };
  return Object.values(value).some((item) => item != null) ? value : null;
}

function styleEvidence(cell: ExcelJS.Cell): Record<string, unknown> | null {
  const fill = cell.fill && "type" in cell.fill ? {
    type: cell.fill.type,
    pattern: "pattern" in cell.fill ? cell.fill.pattern : undefined,
    foreground: "fgColor" in cell.fill ? colorEvidence(cell.fill.fgColor) : null,
    background: "bgColor" in cell.fill ? colorEvidence(cell.fill.bgColor) : null,
  } : null;
  const font = cell.font ? {
    bold: cell.font.bold ?? false,
    italic: cell.font.italic ?? false,
    color: colorEvidence(cell.font.color),
  } : null;
  const evidence = { fill, font };
  return fill || font?.bold || font?.italic || font?.color ? evidence : null;
}

function sourceCell(sheetName: string, cell: ExcelJS.Cell): SourceCell | null {
  const formulaValue = cell.value && typeof cell.value === "object" && "formula" in cell.value ? cell.value : null;
  const sharedFormula = cell.value && typeof cell.value === "object" && "sharedFormula" in cell.value ? cell.value : null;
  const formula = formulaValue ? String(formulaValue.formula) : sharedFormula ? String(sharedFormula.sharedFormula) : null;
  const result = formulaValue && "result" in formulaValue ? formulaValue.result : sharedFormula && "result" in sharedFormula ? sharedFormula.result : null;
  const annotation = noteText(cell.note);
  if (cell.value == null && !formula && !annotation) return null;
  const dateValue = cell.value instanceof Date ? cell.value : result instanceof Date ? result : null;
  return {
    sheetName,
    cellReference: cell.address,
    rowNumber: Number(cell.row),
    columnNumber: Number(cell.col),
    valueType: formula ? "FORMULA" : cell.value instanceof Date ? "DATE" : typeof cell.value === "object" ? "COMPLEX" : typeof cell.value,
    literalValue: formula ? null : plainValue(cell.value),
    formula,
    cachedValue: formula ? plainValue(result) : null,
    displayValue: cell.text || plainValue(result) || plainValue(cell.value),
    annotation,
    originalDate: dateValue ? dateValue.toISOString().slice(0, 10) : null,
    numberFormat: cell.numFmt || null,
    styleEvidence: styleEvidence(cell),
  };
}

function nominalPeriodForSheet(name: string) {
  const match = /^(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+(20\d{2})$/.exec(name);
  if (!match) return null;
  const month = MONTH_NUMBER.get(match[1]);
  return month ? `${match[2]}-${String(month).padStart(2, "0")}` : null;
}

function sheetKind(name: string) {
  if (name === "INDICE GENERAL") return "INDEX";
  if (name.startsWith("1.")) return "DUES_MATRIX";
  if (name.startsWith("1.a")) return "DUES_MATRIX";
  if (name.startsWith("2.")) return "SAVINGS";
  if (name.startsWith("3.")) return "PARKING";
  if (name.startsWith("4.")) return "RETIRED_MEMBERS";
  if (name.startsWith("5.") || name.startsWith("6.")) return "ACTIVITY";
  if (nominalPeriodForSheet(name)) return "MONTHLY_MOVEMENTS";
  return "UNKNOWN";
}

function normalizeKey(value: string) {
  return value.normalize("NFD").replaceAll(/[\u0300-\u036f]/g, "").toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim();
}

function rowClassification(input: { kind: string; nominalPeriod: string | null; rowNumber: number; cells: SourceCell[]; rawText: string }) {
  const upper = input.rawText.toUpperCase();
  const aggregate = /\b(SALDO|SUMA|SUMAN|TOTAL|CIERRE)\b/.test(upper);
  if (input.kind === "MONTHLY_MOVEMENTS") {
    const first = input.cells.find((cell) => cell.columnNumber === 1);
    if (input.rowNumber === 2 && (first?.originalDate || first?.valueType === "DATE")) {
      return { sourceKind: "MONTHLY_OPENING_CONTEXT", isAggregate: true };
    }
    if (aggregate) return { sourceKind: "MONTHLY_AGGREGATE", isAggregate: true };
    const hasAmount = input.cells.some((cell) => [3, 5].includes(cell.columnNumber) && /^-?\d+(?:\.\d+)?$/.test(cell.displayValue ?? ""));
    if ((first?.originalDate || first?.valueType === "DATE") && hasAmount) return { sourceKind: "MONTHLY_MOVEMENT_CANDIDATE", isAggregate: false };
  }
  if (input.kind === "DUES_MATRIX" && input.rowNumber >= 3 && input.rowNumber <= 50 && !aggregate) {
    const label = input.cells.find((cell) => cell.columnNumber === 3)?.displayValue ?? input.cells.find((cell) => cell.columnNumber === 2)?.displayValue;
    if (label && normalizeKey(label).length > 2) return { sourceKind: "MATRIX_PERSON_CANDIDATE", isAggregate: false };
  }
  return { sourceKind: aggregate ? "SOURCE_AGGREGATE" : "SOURCE_CONTEXT", isAggregate: aggregate };
}

function previousNominalPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

function semanticKeyForRow(input: { sheetName: string; nominalPeriod: string | null; sourceKind: string; cells: SourceCell[] }) {
  if (input.sourceKind === "MATRIX_PERSON_CANDIDATE") {
    const label = input.cells.find((cell) => cell.columnNumber === 3)?.displayValue ?? input.cells.find((cell) => cell.columnNumber === 2)?.displayValue ?? "";
    return label ? `matrix:${input.sheetName}:${normalizeKey(label)}` : null;
  }
  if (input.sourceKind === "MONTHLY_MOVEMENT_CANDIDATE") {
    const keyBody = input.cells
      .filter((cell) => cell.columnNumber <= 7 && ![3, 5].includes(cell.columnNumber))
      .map((cell) => `${cell.columnNumber}:${cell.originalDate ?? normalizeKey(cell.displayValue ?? "")}`)
      .join("|");
    return `movement:${input.nominalPeriod ?? input.sheetName}:${keyBody}`;
  }
  const labels = input.cells.map((cell) => cell.displayValue ?? "").filter(Boolean).slice(0, 2).map(normalizeKey).filter(Boolean);
  return labels.length ? `source:${input.sheetName}:${input.sourceKind}:${labels.join("|")}` : null;
}

function issueKey(issue: SourceIssue) {
  return `${issue.code}:${issue.sheetName ?? ""}:${issue.cellReference ?? ""}`;
}

function pushIssue(issues: SourceIssue[], issue: SourceIssue) {
  if (!issues.some((item) => issueKey(item) === issueKey(issue))) issues.push(issue);
}

function cellAt(cells: SourceCell[], sheetName: string, address: string) {
  return cells.find((cell) => cell.sheetName === sheetName && cell.cellReference === address);
}

function addKnownIssues(cells: SourceCell[], sheetNames: Set<string>, issues: SourceIssue[]) {
  if (sheetNames.has("OCTUBRE 2026")) {
    pushIssue(issues, {
      code: "SOURCE_PARTIAL_MONTH", sheetName: "OCTUBRE 2026",
      message: "Octubre de 2026 tiene cobertura parcial al corte declarado; no es un mes cerrado.",
      evidence: "Corte declarado 01/10/2026, inclusive, America/Guayaquil.",
      proposal: "Mostrar el período como parcial y mantener separados los movimientos posteriores.",
      decisionNeeded: "Confirmar la fecha de cierre cuando octubre se complete.",
    });
    const date = cellAt(cells, "OCTUBRE 2026", "A3");
    if (date) pushIssue(issues, {
      code: "DATE_CONFLICT", sheetName: "OCTUBRE 2026", cellReference: "A3",
      message: "La fecha original pertenece a 2025 aunque la hoja corresponde a octubre de 2026.",
      evidence: date.originalDate ?? date.displayValue ?? "Valor conservado en la celda fuente.",
      proposal: "Mantener la fecha original y excluirla de octubre de 2026 hasta resolverla.",
      decisionNeeded: "Confirmar si es fecha incorrecta o agrupación administrativa.",
    });
    const label = cellAt(cells, "OCTUBRE 2026", "D25");
    if (label) pushIssue(issues, {
      code: "STALE_LABEL", sheetName: "OCTUBRE 2026", cellReference: "D25",
      message: "El rótulo conserva el año 2025 dentro de la hoja 2026.", evidence: label.displayValue ?? undefined,
      proposal: "Tratarlo como rótulo de fuente, no como fecha económica.", decisionNeeded: "Confirmar el período correcto del saldo.",
    });
  }

  const staleSeptember = cellAt(cells, "SEPTIEMBRE 2026", "D27");
  if (staleSeptember) pushIssue(issues, {
    code: "STALE_LABEL", sheetName: "SEPTIEMBRE 2026", cellReference: "D27",
    message: "El rótulo conserva agosto de 2025 dentro del cierre de septiembre de 2026.", evidence: staleSeptember.displayValue ?? undefined,
    proposal: "Conservar el texto como evidencia y no usarlo para fechar el movimiento.", decisionNeeded: "Confirmar el período al que corresponde el cierre.",
  });

  const matrixCounter = cellAt(cells, "1.a SOLO CUOTAS 2026", "B49");
  if (matrixCounter) pushIssue(issues, {
    code: "MATRIX_COUNTER_NOT_ROSTER", sheetName: "1.a SOLO CUOTAS 2026", cellReference: "B49",
    message: "El contador escrito no constituye el padrón operativo.", evidence: `Valor literal: ${matrixCounter.displayValue ?? "vacío"}; las filas personales requieren conteo independiente.`,
    proposal: "Contar filas personales por estructura y revisar identidades fuera de matriz.", decisionNeeded: "Aprobar el padrón y las vigencias por persona.",
  });
  if (!cellAt(cells, "1.a SOLO CUOTAS 2026", "B30")?.displayValue && cellAt(cells, "1.a SOLO CUOTAS 2026", "C30")?.displayValue) {
    pushIssue(issues, {
      code: "MATRIX_PERSON_WITHOUT_NUMBER", sheetName: "1.a SOLO CUOTAS 2026", cellReference: "B30:C30",
      message: "Existe una fila personal sin numeración; no debe descartarse.", evidence: "B30 vacío y C30 con nombre en la fuente.",
      proposal: "Conservarla como identidad candidata sin asignar un número inventado.", decisionNeeded: "Confirmar identidad y vigencia operativa.",
    });
  }
  if (cellAt(cells, "1.a SOLO CUOTAS 2026", "B4")?.displayValue || cellAt(cells, "1.a SOLO CUOTAS 2026", "C4")?.displayValue) {
    pushIssue(issues, {
      code: "MATRIX_DIRECTION_PERSON", sheetName: "1.a SOLO CUOTAS 2026", cellReference: "B4:C4",
      message: "Dirección se conserva como fila personal/administrativa, no como cuerda vocal.",
      proposal: "Mapear la persona y su función sin crear una cuerda ficticia.", decisionNeeded: "Confirmar identidad y acceso administrativo.",
    });
  }
  const unusual = cellAt(cells, "1.a SOLO CUOTAS 2026", "O44");
  if (unusual?.displayValue === "55") pushIssue(issues, {
    code: "MATRIX_UNUSUAL_AMOUNT", sheetName: "1.a SOLO CUOTAS 2026", cellReference: "O44",
    message: "El valor 55 es atípico para una cuota de USD 5 y no se corrige automáticamente.", evidence: "Valor literal 55.",
    proposal: "Mantenerlo pendiente, sin redistribuir ni convertir a 5.", decisionNeeded: "Confirmar su significado y el importe correcto.",
  });
  const p4 = cellAt(cells, "1.a SOLO CUOTAS 2026", "P4");
  if (p4?.formula) pushIssue(issues, {
    code: "MATRIX_DECEMBER_RANGE", sheetName: "1.a SOLO CUOTAS 2026", cellReference: "P4",
    message: "La suma anual no integra diciembre de forma uniforme y mezcla deuda anterior.", evidence: `Fórmula original: ${p4.formula}.`,
    proposal: "Calcular cargos y aplicaciones por período en PostgreSQL; no importar el total como caja.", decisionNeeded: "Confirmar el tratamiento de diciembre y deuda anterior.",
  });
  const juneValues = cells.filter((cell) => cell.sheetName === "1.a SOLO CUOTAS 2026" && cell.columnNumber === 9 && Number(cell.displayValue) === 5);
  if (juneValues.length) pushIssue(issues, {
    code: "MATRIX_JUNE_RULE_REVIEW", sheetName: "1.a SOLO CUOTAS 2026", cellReference: "I4:I48",
    message: "Junio contiene importes y la hipótesis previa de no exigibilidad requiere revisión.", evidence: `${juneValues.length} celdas personales contienen 5.`,
    proposal: "Conservar las aplicaciones; no borrar pagos al resolver la regla del cargo.", decisionNeeded: "Ratificar si junio de 2026 fue exigible y cómo tratar los cargos ya cubiertos.",
  });
  for (const address of ["G18", "G23"]) {
    const candidate = cellAt(cells, "SEPTIEMBRE 2026", address);
    if (candidate?.displayValue) pushIssue(issues, {
      code: "MATRIX_OUTSIDE_CANDIDATE", sheetName: "SEPTIEMBRE 2026", cellReference: address,
      message: "La hoja mensual menciona una persona por incorporar al listado.", evidence: candidate.displayValue,
      proposal: "Conservar la mención como candidata, sin crear ni activar identidad automáticamente.", decisionNeeded: "Confirmar identidad, cuerda y vigencia.",
    });
  }
  if (sheetNames.has("2. CUENTA AHORRO FLEXIBLE")) pushIssue(issues, {
    code: "SAVINGS_MULTI_YEAR_TOTAL", sheetName: "2. CUENTA AHORRO FLEXIBLE", cellReference: "A29:F56",
    message: "Ahorro contiene bloques 2025 y 2026 y un total que atraviesa ambos bloques.",
    evidence: "Segundo encabezado en A29; fórmulas de total en C55, D55 y D56.",
    proposal: "Leer por bloque/año y clasificar transferencias e intereses por cuenta.", decisionNeeded: "Aprobar el alcance exacto de cada total antes de promover movimientos.",
  });
  if (sheetNames.has("3. PAGO PARQUEADERO")) pushIssue(issues, {
    code: "PARKING_MULTI_YEAR_BLOCK", sheetName: "3. PAGO PARQUEADERO", cellReference: "B2:Z40",
    message: "Parqueadero contiene bloques 2025 y 2026 en la misma pestaña.",
    evidence: "Encabezados de año en B2 y B18; notas adicionales en B39:B40.",
    proposal: "Interpretar cada bloque por año y conservar notas de vigencia.", decisionNeeded: "Ratificar vigencias y periodicidad antes de generar cargos.",
  });
}

export async function previewWorkbook(buffer: Buffer): Promise<WorkbookPreview> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  if (workbook.worksheets.length === 0 || workbook.worksheets.length > MAX_SHEETS) {
    throw new Error("Cantidad de hojas fuera del límite permitido.");
  }

  let totalCells = 0;
  const rows: WorkbookPreview["rows"] = [];
  const sheets: WorkbookPreview["sheets"] = [];
  const cells: SourceCell[] = [];
  const issues: SourceIssue[] = [];

  for (const [physicalIndex, sheet] of workbook.worksheets.entries()) {
    if (sheet.rowCount > MAX_ROWS_PER_SHEET) throw new Error(`La hoja ${sheet.name} excede el límite de filas.`);
    totalCells += sheet.rowCount * sheet.columnCount;
    if (totalCells > MAX_CELLS) throw new Error("El libro excede el límite de celdas para vista previa.");
    const nominalPeriod = nominalPeriodForSheet(sheet.name);
    const kind = sheetKind(sheet.name);
    const sample: string[][] = [];
    const years = new Set<number>();

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const rowCells: SourceCell[] = [];
      const sampleValues: string[] = [];
      for (let column = 1; column <= Math.min(sheet.columnCount, MAX_COLUMNS_PER_ROW); column += 1) {
        const parsed = sourceCell(sheet.name, row.getCell(column));
        if (parsed) {
          rowCells.push(parsed);
          cells.push(parsed);
          for (const year of parsed.displayValue?.match(/20\d{2}/g) ?? []) years.add(Number(year));
        }
        if (column <= 12) sampleValues.push(parsed?.displayValue?.slice(0, 300) ?? "");
      }
      while (sampleValues.at(-1) === "") sampleValues.pop();
      if (sample.length < 8 && sampleValues.length) sample.push(sampleValues);
      if (!rowCells.length) return;
      const rawText = rowCells.map((cell) => cell.displayValue ?? cell.formula ?? "").join(" | ").slice(0, 4_000);
      const contentFingerprint = hash(`${sheet.name}\n${rowCells.map((cell) => `${cell.columnNumber}:${cell.literalValue ?? ""}:${cell.formula ?? ""}:${cell.cachedValue ?? ""}:${cell.annotation ?? ""}`).join("\n")}`);
      const classification = rowClassification({ kind, nominalPeriod, rowNumber, cells: rowCells, rawText });
      const semanticKey = semanticKeyForRow({ sheetName: sheet.name, nominalPeriod, sourceKind: classification.sourceKind, cells: rowCells });
      rows.push({
        sheetName: sheet.name,
        rowNumber,
        rawText,
        fingerprint: hash(`${sheet.name}\n${rowNumber}\n${contentFingerprint}`),
        contentFingerprint,
        semanticKey,
        sourceKind: classification.sourceKind,
        nominalPeriod,
        sourceData: { cells: rowCells.map(({ cellReference, displayValue, formula, cachedValue }) => ({ cellReference, displayValue, formula, cachedValue })) },
        firstCellReference: rowCells.at(0)?.cellReference ?? null,
        lastCellReference: rowCells.at(-1)?.cellReference ?? null,
        isAggregate: classification.isAggregate,
      });
    });

    sheets.push({
      name: sheet.name,
      physicalOrder: physicalIndex + 1,
      kind,
      nominalPeriod,
      coverageStatus: nominalPeriod === "2026-10" ? "PARTIAL" : "DOCUMENTED",
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      declaredRange: `A1:${columnName(Math.max(1, sheet.columnCount))}${Math.max(1, sheet.rowCount)}`,
      blockYears: [...years].filter((year) => year >= 2020 && year <= 2035).toSorted(),
      sample,
    });
  }

  const sheetNames = new Set(sheets.map(({ name }) => name));
  const expectedNames = new Set<string>(EXPECTED_SOURCE_SHEETS);
  const missing = EXPECTED_SOURCE_SHEETS.filter((name) => !sheetNames.has(name));
  const unexpected = sheets.map(({ name }) => name).filter((name) => !expectedNames.has(name));
  if (sheets.length !== EXPECTED_SOURCE_SHEETS.length || missing.length || unexpected.length) {
    pushIssue(issues, {
      code: "SOURCE_SHEET_INVENTORY",
      message: "El inventario de pestañas no coincide con la versión esperada de 30 hojas.",
      evidence: `Encontradas ${sheets.length}; faltan ${missing.join(", ") || "ninguna"}; adicionales ${unexpected.join(", ") || "ninguna"}.`,
      proposal: "Mantener el lote en revisión y contrastar la versión del archivo.",
      decisionNeeded: "Confirmar si se trata de una nueva versión autorizada.",
    });
  }

  for (const sheet of sheets.filter(({ nominalPeriod }) => nominalPeriod)) {
    const outOfPeriod = cells.filter((cell) => cell.sheetName === sheet.name && cell.columnNumber === 1 && cell.originalDate && !cell.originalDate.startsWith(sheet.nominalPeriod!));
    for (const cell of outOfPeriod) {
      if (cell.rowNumber === 2) {
        if (cell.originalDate?.startsWith(previousNominalPeriod(sheet.nominalPeriod!))) continue;
        pushIssue(issues, {
          code: "OPENING_DATE_CONFLICT", sheetName: sheet.name, cellReference: cell.cellReference,
          message: "La fecha de apertura no corresponde al mes anterior al período de la pestaña.", evidence: cell.originalDate ?? undefined,
          proposal: "Conservar la apertura como contexto fuente y no convertirla en movimiento.", decisionNeeded: "Confirmar el período de origen del saldo de apertura.",
        });
        continue;
      }
      pushIssue(issues, {
        code: "DATE_OUTSIDE_NOMINAL_MONTH", sheetName: sheet.name, cellReference: cell.cellReference,
        message: "La fecha original está fuera del mes indicado por la pestaña.", evidence: cell.originalDate ?? undefined,
        proposal: "Conservar la fecha original y mantener el movimiento en revisión.", decisionNeeded: "Confirmar si la fecha es correcta o si la fila fue agrupada administrativamente.",
      });
    }
  }

  addKnownIssues(cells, sheetNames, issues);
  if (sheetNames.has("1.a SOLO CUOTAS 2026")) pushIssue(issues, {
    code: "MIG-X-MONTH", sheetName: "1.a SOLO CUOTAS 2026",
    message: "Las marcas X mensuales no se convierten automáticamente en deuda, pago o pausa.",
    proposal: "Resolverlas mediante un diccionario de significado aprobado por columna y período.",
    decisionNeeded: "Aprobar el significado de X, blancos, ceros y colores.",
  });
  pushIssue(issues, {
    code: "BANK_DATE",
    message: "Las celdas por período no prueban la fecha bancaria.",
    proposal: "Mantener la fecha de movimiento nula hasta vincular evidencia verificable.",
    decisionNeeded: "Aprobar fecha y cuenta solo a partir de movimientos o evidencia conciliada.",
  });

  const monthlyPeriods = sheets.flatMap(({ nominalPeriod }) => nominalPeriod ? [nominalPeriod] : []).toSorted();
  return {
    sha256: hash(buffer),
    sheetCount: sheets.length,
    sheets,
    rows,
    cells,
    issues,
    sourceSummary: {
      expectedSheetCount: EXPECTED_SOURCE_SHEETS.length,
      monthlySheetCount: monthlyPeriods.length,
      monthlyPeriods,
      cutoff: "2026-10-01",
      cutoffTimezone: "America/Guayaquil",
      partialPeriods: ["2026-10"],
    },
  };
}
