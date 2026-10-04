import { AppRole } from "@/generated/prisma/client";
import type { AccessContext } from "@/lib/access";
import { prisma } from "@/lib/db";

export type ReportSource = "historical" | "operation";

type StoredCell = {
  cellReference: string;
  rowNumber: number;
  columnNumber: number;
  displayValue: string | null;
  literalValue: string | null;
  formula: string | null;
  cachedValue: string | null;
  originalDate: string | null;
};

const HISTORY_ROLES = new Set<AppRole>([
  AppRole.SUPERADMIN,
  AppRole.ADMIN,
  AppRole.TESORERIA,
]);

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export function canReadGlobalHistory(access: AccessContext) {
  return access.roles.some((role) => HISTORY_ROLES.has(role));
}

export function chooseReportSource(input: { requested?: string; canReadHistory: boolean; hasHistory: boolean }): ReportSource {
  if (input.requested === "operation" || !input.canReadHistory || !input.hasHistory) return "operation";
  return "historical";
}

export async function resolveReportSource(access: AccessContext, requested?: string) {
  const canReadHistory = canReadGlobalHistory(access);
  const latestBatch = canReadHistory ? await prisma.importBatch.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true },
  }) : null;
  const hasHistory = Boolean(latestBatch);
  const source = chooseReportSource({ requested, canReadHistory, hasHistory });
  return { source, canReadHistory, hasHistory, batchId: latestBatch?.id ?? null };
}

export function parseHistoricalAmount(cell: Pick<StoredCell, "literalValue" | "cachedValue" | "displayValue"> | undefined) {
  const original = cell?.literalValue ?? cell?.cachedValue ?? cell?.displayValue;
  if (!original) return null;
  let normalized = original.trim().replaceAll(/[$\s]/g, "");
  if (!normalized || /^x$/i.test(normalized)) return null;
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    normalized = lastComma > lastDot ? normalized.replaceAll(".", "").replace(",", ".") : normalized.replaceAll(",", "");
  } else if (lastComma > -1) {
    normalized = /,\d{1,2}$/.test(normalized) ? normalized.replace(",", ".") : normalized.replaceAll(",", "");
  }
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function byColumn(cells: StoredCell[]) {
  return new Map(cells.map((cell) => [cell.columnNumber, cell]));
}

function display(cell: StoredCell | undefined) {
  return cell?.displayValue?.trim() ?? "";
}

function groupCellsByRow(cells: StoredCell[]) {
  const grouped = new Map<number, StoredCell[]>();
  for (const cell of cells) {
    const row = grouped.get(cell.rowNumber) ?? [];
    row.push(cell);
    grouped.set(cell.rowNumber, row);
  }
  return grouped;
}

function monthlyRow(row: {
  id: string;
  sheetName: string;
  rowNumber: number;
  sourceKind: string;
  status: string;
}, cells: StoredCell[]) {
  const columns = byColumn(cells);
  return {
    id: row.id,
    sheetName: row.sheetName,
    rowNumber: row.rowNumber,
    sourceKind: row.sourceKind,
    reviewStatus: row.status,
    occurredOn: columns.get(1)?.originalDate ?? display(columns.get(1)),
    incomeDetail: display(columns.get(2)),
    incomeAmount: display(columns.get(3)),
    incomeCents: parseHistoricalAmount(columns.get(3)),
    expenseDetail: display(columns.get(4)),
    expenseAmount: display(columns.get(5)),
    expenseCents: parseHistoricalAmount(columns.get(5)),
    observation: display(columns.get(6)),
    contextAmount: display(columns.get(7)),
    cells: cells.map((cell) => ({
      reference: cell.cellReference,
      displayValue: cell.displayValue,
      formula: cell.formula,
      cachedValue: cell.cachedValue,
      originalDate: cell.originalDate,
    })),
  };
}

export async function getHistoricalMonthlyReport(input: {
  batchId: string;
  period: string;
  query?: string;
  page?: number;
}) {
  const pageSize = 80;
  const page = Number.isSafeInteger(input.page) && Number(input.page) > 0 ? Math.min(Number(input.page), 10_000) : 1;
  const query = input.query?.trim().slice(0, 100) || undefined;
  const batch = await prisma.importBatch.findUnique({
    where: { id: input.batchId },
    include: {
      sourceSheets: { where: { kind: "MONTHLY_MOVEMENTS" }, orderBy: { nominalPeriod: "asc" } },
      _count: { select: { rows: true, sourceCells: true, issues: true } },
    },
  });
  if (!batch) throw new Error("Lote histórico no encontrado.");
  const availablePeriods = batch.sourceSheets.flatMap((sheet) => sheet.nominalPeriod ? [sheet.nominalPeriod] : []);
  const period = availablePeriods.includes(input.period) ? input.period : availablePeriods.at(-1) ?? input.period;
  const sheet = batch.sourceSheets.find((item) => item.nominalPeriod === period) ?? null;
  if (!sheet) return { batch, sheet: null, period, availablePeriods, rows: [], openingRows: [], totals: { incomeCents: 0, expenseCents: 0 }, pagination: { page: 1, pageSize, totalRows: 0, totalPages: 1 } };

  const where = {
    batchId: batch.id,
    sheetName: sheet.name,
    sourceKind: { in: ["MONTHLY_MOVEMENT_CANDIDATE", "MONTHLY_OPENING_CONTEXT"] },
    ...(query ? { rawText: { contains: query, mode: "insensitive" as const } } : {}),
  };
  const [totalRows, sourceRows, allCandidateRows, issueCount] = await Promise.all([
    prisma.importRow.count({ where }),
    prisma.importRow.findMany({
      where,
      orderBy: { rowNumber: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, sheetName: true, rowNumber: true, sourceKind: true, status: true },
    }),
    prisma.importRow.findMany({
      where: { batchId: batch.id, sheetName: sheet.name, sourceKind: "MONTHLY_MOVEMENT_CANDIDATE" },
      select: { id: true, rowNumber: true },
    }),
    prisma.importIssue.count({ where: { batchId: batch.id, sheetName: sheet.name, status: "PENDING" } }),
  ]);
  const rowNumbers = [...new Set([...sourceRows.map(({ rowNumber }) => rowNumber), ...allCandidateRows.map(({ rowNumber }) => rowNumber)])];
  const cells = rowNumbers.length ? await prisma.importCell.findMany({
    where: { batchId: batch.id, sheetName: sheet.name, rowNumber: { in: rowNumbers } },
    orderBy: [{ rowNumber: "asc" }, { columnNumber: "asc" }],
    select: { cellReference: true, rowNumber: true, columnNumber: true, displayValue: true, literalValue: true, formula: true, cachedValue: true, originalDate: true },
  }) : [];
  const cellsByRow = groupCellsByRow(cells);
  const rows = sourceRows.map((row) => monthlyRow(row, cellsByRow.get(row.rowNumber) ?? []));
  const candidateNumbers = new Set(allCandidateRows.map(({ rowNumber }) => rowNumber));
  const totals = cells.reduce((sum, cell) => {
    if (!candidateNumbers.has(cell.rowNumber)) return sum;
    const cents = parseHistoricalAmount(cell);
    if (cents == null) return sum;
    if (cell.columnNumber === 3) sum.incomeCents += cents;
    if (cell.columnNumber === 5) sum.expenseCents += cents;
    return sum;
  }, { incomeCents: 0, expenseCents: 0 });

  return {
    batch,
    sheet,
    period,
    availablePeriods,
    rows: rows.filter((row) => row.sourceKind === "MONTHLY_MOVEMENT_CANDIDATE"),
    openingRows: rows.filter((row) => row.sourceKind === "MONTHLY_OPENING_CONTEXT"),
    totals,
    issueCount,
    pagination: { page, pageSize, totalRows, totalPages: Math.max(1, Math.ceil(totalRows / pageSize)) },
  };
}

export function classifyHistoricalMatrixValue(value: string, amountCents: number | null) {
  if (!value) return "UNSPECIFIED" as const;
  if (/^x$/i.test(value.trim())) return "MARK" as const;
  if (amountCents != null) return "AMOUNT" as const;
  return "REVIEW" as const;
}

export async function getHistoricalDuesReport(input: {
  batchId: string;
  year: number;
  query?: string;
  page?: number;
}) {
  const pageSize = 60;
  const page = Number.isSafeInteger(input.page) && Number(input.page) > 0 ? Math.min(Number(input.page), 10_000) : 1;
  const query = input.query?.trim().slice(0, 100) || undefined;
  const batch = await prisma.importBatch.findUnique({
    where: { id: input.batchId },
    include: {
      sourceSheets: { where: { kind: "DUES_MATRIX" }, orderBy: { physicalOrder: "asc" } },
      _count: { select: { rows: true, sourceCells: true, issues: true } },
    },
  });
  if (!batch) throw new Error("Lote histórico no encontrado.");
  const availableYears = batch.sourceSheets.flatMap((sheet) => {
    const year = Number(sheet.name.match(/20\d{2}/)?.[0]);
    return Number.isSafeInteger(year) ? [year] : [];
  });
  const year = availableYears.includes(input.year) ? input.year : availableYears.at(-1) ?? input.year;
  const sheet = batch.sourceSheets.find((item) => item.name.includes(String(year))) ?? null;
  if (!sheet) return { batch, sheet: null, year, availableYears, rows: [], totals: { people: 0, amounts: 0, marks: 0, unspecified: 0, review: 0 }, pagination: { page: 1, pageSize, totalRows: 0, totalPages: 1 } };
  const where = {
    batchId: batch.id,
    sheetName: sheet.name,
    sourceKind: "MATRIX_PERSON_CANDIDATE",
    ...(query ? { rawText: { contains: query, mode: "insensitive" as const } } : {}),
  };
  const [totalRows, sourceRows] = await Promise.all([
    prisma.importRow.count({ where }),
    prisma.importRow.findMany({
      where,
      orderBy: { rowNumber: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, sheetName: true, rowNumber: true, status: true },
    }),
  ]);
  const cells = sourceRows.length ? await prisma.importCell.findMany({
    where: { batchId: batch.id, sheetName: sheet.name, rowNumber: { in: sourceRows.map(({ rowNumber }) => rowNumber) } },
    orderBy: [{ rowNumber: "asc" }, { columnNumber: "asc" }],
    select: { cellReference: true, rowNumber: true, columnNumber: true, displayValue: true, literalValue: true, formula: true, cachedValue: true, originalDate: true },
  }) : [];
  const cellsByRow = groupCellsByRow(cells);
  const totals = { people: totalRows, amounts: 0, marks: 0, unspecified: 0, review: 0 };
  const rows = sourceRows.map((row) => {
    const rowCells = cellsByRow.get(row.rowNumber) ?? [];
    const columns = byColumn(rowCells);
    const months = MONTH_NAMES.map((label, index) => {
      const month = index + 1;
      if (month === 1) return { period: `${year}-01`, label, value: "", amountCents: null, status: "NOT_DUE" as const, reference: null, formula: null, cachedValue: null };
      const cell = columns.get(month + 3);
      const value = display(cell);
      const amountCents = parseHistoricalAmount(cell);
      const status = classifyHistoricalMatrixValue(value, amountCents);
      if (status === "AMOUNT") totals.amounts += 1;
      if (status === "MARK") totals.marks += 1;
      if (status === "UNSPECIFIED") totals.unspecified += 1;
      if (status === "REVIEW") totals.review += 1;
      return { period: `${year}-${String(month).padStart(2, "0")}`, label, value, amountCents, status, reference: cell?.cellReference ?? null, formula: cell?.formula ?? null, cachedValue: cell?.cachedValue ?? null };
    });
    const prior = columns.get(4);
    return {
      id: row.id,
      sheetName: row.sheetName,
      rowNumber: row.rowNumber,
      reviewStatus: row.status,
      sourceNumber: display(columns.get(2)),
      displayName: display(columns.get(3)) || display(columns.get(2)) || `Fila ${row.rowNumber}`,
      sectionLabel: display(columns.get(1)),
      priorValue: display(prior),
      priorReference: prior?.cellReference ?? null,
      months,
    };
  });
  return { batch, sheet, year, availableYears, rows, totals, pagination: { page, pageSize, totalRows, totalPages: Math.max(1, Math.ceil(totalRows / pageSize)) } };
}

export async function getHistoricalDashboard(input: { batchId: string; period: string }) {
  const batch = await prisma.importBatch.findUnique({
    where: { id: input.batchId },
    include: {
      sourceSheets: { orderBy: { physicalOrder: "asc" } },
      _count: { select: { rows: true, sourceCells: true, issues: true } },
    },
  });
  if (!batch) throw new Error("Lote histórico no encontrado.");
  const monthlySheets = batch.sourceSheets.filter((sheet) => sheet.kind === "MONTHLY_MOVEMENTS" && sheet.nominalPeriod);
  const candidateRows = await prisma.importRow.findMany({
    where: { batchId: batch.id, sourceKind: "MONTHLY_MOVEMENT_CANDIDATE" },
    select: { sheetName: true, rowNumber: true, nominalPeriod: true },
  });
  const candidateKey = new Set(candidateRows.map((row) => `${row.sheetName}:${row.rowNumber}`));
  const monthlyCells = await prisma.importCell.findMany({
    where: { batchId: batch.id, sheetName: { in: monthlySheets.map(({ name }) => name) }, columnNumber: { in: [3, 5] } },
    select: { cellReference: true, rowNumber: true, columnNumber: true, displayValue: true, literalValue: true, formula: true, cachedValue: true, originalDate: true, sheetName: true },
  });
  const byPeriod = new Map<string, { incomeCents: number; expenseCents: number; rows: number; status: string }>();
  for (const sheet of monthlySheets) {
    if (sheet.nominalPeriod) byPeriod.set(sheet.nominalPeriod, { incomeCents: 0, expenseCents: 0, rows: candidateRows.filter((row) => row.sheetName === sheet.name).length, status: sheet.coverageStatus });
  }
  for (const cell of monthlyCells) {
    if (!candidateKey.has(`${cell.sheetName}:${cell.rowNumber}`)) continue;
    const period = monthlySheets.find((sheet) => sheet.name === cell.sheetName)?.nominalPeriod;
    const summary = period ? byPeriod.get(period) : null;
    const cents = parseHistoricalAmount(cell);
    if (!summary || cents == null) continue;
    if (cell.columnNumber === 3) summary.incomeCents += cents;
    if (cell.columnNumber === 5) summary.expenseCents += cents;
  }
  const periods = [...byPeriod.keys()].toSorted();
  const period = periods.includes(input.period) ? input.period : periods.at(-1) ?? input.period;
  const visiblePeriods = periods.filter((item) => item <= period).slice(-6);
  const pendingIssues = await prisma.importIssue.count({ where: { batchId: batch.id, status: "PENDING" } });
  const matrixRows = await prisma.importRow.count({ where: { batchId: batch.id, sourceKind: "MATRIX_PERSON_CANDIDATE" } });
  return {
    batch,
    period,
    periods,
    periodSummary: byPeriod.get(period) ?? { incomeCents: 0, expenseCents: 0, rows: 0, status: "NOT_DOCUMENTED" },
    monthlyTrend: visiblePeriods.map((item) => ({ period: item, ...byPeriod.get(item)! })),
    candidateRows: candidateRows.length,
    matrixRows,
    pendingIssues,
  };
}
