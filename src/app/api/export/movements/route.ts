import { AppRole, MovementDirection } from "@/generated/prisma/client";
import { requireAccess } from "@/lib/access";
import { formatLocalDateNumeric } from "@/lib/dates";
import { csvDocument, csvResponse } from "@/server/reports/csv";
import { getHistoricalMonthlyReport, resolveReportSource } from "@/server/reports/historical";
import { getMonthlyAccountReport } from "@/server/reports/monthly-account";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  const params = new URL(request.url).searchParams;
  const period = params.get("period") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return Response.json({ error: "Período inválido." }, { status: 400 });
  const sourceContext = await resolveReportSource(access, params.get("source") ?? undefined);
  if (sourceContext.source === "historical" && sourceContext.batchId) {
    const report = await getHistoricalMonthlyReport({ batchId: sourceContext.batchId, period, query: params.get("q") ?? undefined });
    const rows: Array<Array<string | number>> = [["Fuente", "Hoja", "Fila", "Fecha original", "Ingreso: detalle", "Monto ingreso original", "Egreso: detalle", "Monto egreso original", "Observaciones", "Estado revisión", "Celdas de procedencia"]];
    for (const row of report.rows) rows.push(["HISTORICO_EXCEL_PENDIENTE", row.sheetName, row.rowNumber, row.occurredOn, row.incomeDetail, row.incomeAmount, row.expenseDetail, row.expenseAmount, row.observation, row.reviewStatus, row.cells.map(({ reference }) => `${row.sheetName}!${reference}`).join(" | ")]);
    return csvResponse(csvDocument(rows), `fuente-historica-${report.period}.csv`);
  }
  const report = await getMonthlyAccountReport({
    period,
    accountId: params.get("account") ?? undefined,
    movementType: params.get("type") ?? undefined,
    query: params.get("q") ?? undefined,
    paginate: false,
  });
  const rows: Array<Array<string | number>> = [["Fecha", "Ingreso: detalle", "Monto ingreso USD", "Egreso: detalle", "Monto egreso USD", "Cuenta", "Tipo", "Referencia", "Conciliación"]];
  for (const movement of report.movements) {
    const detail = movement.description ?? movement.externalReference ?? "Sin detalle";
    rows.push([
      formatLocalDateNumeric(movement.occurredAt),
      movement.direction === MovementDirection.IN ? detail : "",
      movement.direction === MovementDirection.IN ? (movement.amountCents / 100).toFixed(2) : "",
      movement.direction === MovementDirection.OUT ? detail : "",
      movement.direction === MovementDirection.OUT ? (movement.amountCents / 100).toFixed(2) : "",
      movement.account.name,
      movement.type,
      movement.externalReference ?? "",
      movement.reconciliationCandidate?.status === "CONFIRMED" ? "CONCILIADO" : "SIN CIERRE",
    ]);
  }
  return csvResponse(csvDocument(rows), `movimientos-${period}.csv`);
}
