import { AppRole, MovementDirection } from "@/generated/prisma/client";
import { requireAccess } from "@/lib/access";
import { formatLocalDateNumeric } from "@/lib/dates";
import { csvDocument, csvResponse } from "@/server/reports/csv";
import { getMonthlyAccountReport } from "@/server/reports/monthly-account";

export const runtime = "nodejs";

export async function GET(request: Request) {
  await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  const params = new URL(request.url).searchParams;
  const period = params.get("period") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return Response.json({ error: "Período inválido." }, { status: 400 });
  const report = await getMonthlyAccountReport({
    period,
    accountId: params.get("account") ?? undefined,
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
