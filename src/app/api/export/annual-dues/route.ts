import { AppRole } from "@/generated/prisma/client";
import { requireAccess } from "@/lib/access";
import { getAnnualDuesReport } from "@/server/reports/annual-dues";
import { csvDocument, csvResponse } from "@/server/reports/csv";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA, AppRole.DIRECTORA, AppRole.JEFE_DE_CUERDA, AppRole.MIEMBRO]);
  const params = new URL(request.url).searchParams;
  const year = Number(params.get("year"));
  const cutoff = params.get("cutoff") ?? "";
  if (!Number.isSafeInteger(year) || year < 2020 || year > 2100 || !new RegExp(`^${year}-(0[1-9]|1[0-2])$`).test(cutoff)) {
    return Response.json({ error: "Año o corte inválido." }, { status: 400 });
  }
  const report = await getAnnualDuesReport({
    access,
    year,
    cutoffPeriod: cutoff,
    conceptId: params.get("concept") ?? undefined,
    sectionId: params.get("section") ?? undefined,
    memberStatus: params.get("status") ?? undefined,
    query: params.get("q") ?? undefined,
    paginate: false,
  });
  const monthHeaders = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const rows: Array<Array<string | number>> = [["Concepto", "Persona", "Cuerda", "Vigencia", "Deuda anterior USD", ...monthHeaders, "Aplicado al corte USD", "Pendiente al corte USD", "Crédito USD", "Adelantos USD"]];
  for (const row of report.rows) rows.push([
    report.selectedConcept.name,
    row.displayName,
    row.section?.name ?? "Administración / pendiente",
    row.status,
    (row.priorDebtCents / 100).toFixed(2),
    ...row.months.map((month) => `${month.status}:${(month.appliedCents / 100).toFixed(2)}/${(month.dueCents / 100).toFixed(2)}`),
    (row.appliedAtCutoffCents / 100).toFixed(2),
    (row.pendingAtCutoffCents / 100).toFixed(2),
    (row.creditCents / 100).toFixed(2),
    (row.advanceCents / 100).toFixed(2),
  ]);
  return csvResponse(csvDocument(rows), `cuotas-${report.selectedConcept.systemKey.toLowerCase()}-${year}-corte-${cutoff}.csv`);
}
