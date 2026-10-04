import Link from "next/link";
import { AppRole, MovementType } from "@/generated/prisma/client";
import { Notice } from "@/components/notice";
import { HistoricalMonthlyLedger } from "@/components/reports/historical-monthly-ledger";
import { MonthlyLedger } from "@/components/reports/monthly-ledger";
import { ReportSourceSwitcher } from "@/components/reports/report-source-switcher";
import { StatusPill } from "@/components/status-pill";
import { requireAccess } from "@/lib/access";
import { formatLocalDate, formatLocalDateNumeric } from "@/lib/dates";
import { formatUsd } from "@/lib/money";
import { getMonthlyAccountReport } from "@/server/reports/monthly-account";
import { getHistoricalMonthlyReport, resolveReportSource } from "@/server/reports/historical";

function currentPeriod() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "America/Guayaquil" }).format(new Date()).slice(0, 7);
}

function reportUrl(input: { period: string; accountId?: string; movementType?: string; query?: string; page?: number }) {
  const params = new URLSearchParams({ period: input.period, source: "operation" });
  if (input.accountId) params.set("account", input.accountId);
  if (input.movementType) params.set("type", input.movementType);
  if (input.query) params.set("q", input.query);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  return `/reportes/movimientos?${params.toString()}`;
}

const coverageLabels: Record<string, string> = {
  EMPTY: "Mes vacío",
  NOT_IMPORTED: "Fuente no importada",
  PARTIAL: "Mes parcial",
  WITH_MOVEMENTS: "Con movimientos; conciliación no certificada",
  RECONCILED: "Conciliado con evidencia",
};

const movementTypeLabels: Record<string, string> = {
  PAYMENT: "Pago",
  EXPENSE: "Gasto",
  INTEREST: "Interés",
  INTERNAL_TRANSFER: "Transferencia interna",
  OPENING_BALANCE: "Saldo de apertura",
  REVERSAL: "Reversión",
};

export default async function MonthlyMovementsReport({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; source?: string; account?: string; type?: string; q?: string; page?: string }>;
}) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  const params = await searchParams;
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.period ?? "") ? params.period! : currentPeriod();
  const sourceContext = await resolveReportSource(access, params.source);

  if (sourceContext.source === "historical" && sourceContext.batchId) {
    const historical = await getHistoricalMonthlyReport({ batchId: sourceContext.batchId, period, query: params.q, page: Number(params.page) });
    const historyUrl = (page: number) => {
      const query = new URLSearchParams({ period: historical.period, source: "historical" });
      if (params.q) query.set("q", params.q);
      if (page > 1) query.set("page", String(page));
      return `/reportes/movimientos?${query.toString()}`;
    };
    return (
      <div className="page page-wide">
        <header className="page-header"><div><p className="eyebrow">Hoja mensual real · pendiente de validación</p><h1>Reporte mensual</h1><p className="lede">Lectura literal del Excel con procedencia por hoja, fila y celda. Los agregados y saldos de apertura quedan fuera de los totales de filas candidatas.</p></div><a className="button button-secondary" href={`/api/export/movements?period=${historical.period}&source=historical${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}>Exportar fuente CSV</a></header>
        <ReportSourceSwitcher source="historical" pathname="/reportes/movimientos" params={{ period: historical.period, q: params.q }}/>
        <section className="card filter-card"><form className="report-filters"><input type="hidden" name="source" value="historical"/><div className="field"><label htmlFor="period">Año y mes</label><input id="period" name="period" type="month" defaultValue={historical.period}/></div><div className="field filter-search"><label htmlFor="q">Buscar en la fila original</label><input id="q" name="q" defaultValue={params.q ?? ""} maxLength={100}/></div><button className="button">Aplicar filtros</button></form></section>
        {!historical.sheet ? <Notice warning="No existe una hoja mensual documentada para este período."/> : historical.sheet.coverageStatus === "PARTIAL" ? <Notice warning="Octubre de 2026 es parcial al corte declarado; estos importes no equivalen a un cierre conciliado."/> : <Notice warning="Fuente histórica pendiente de validación. Ninguna fila de esta tabla es un movimiento operativo todavía."/>}
        <section className="section grid grid-4"><article className="card"><div className="metric-label">Ingresos documentados</div><div className="metric-value amount-income">{formatUsd(historical.totals.incomeCents)}</div><div className="metric-note">Solo columna C de filas candidatas</div></article><article className="card"><div className="metric-label">Egresos documentados</div><div className="metric-value amount-expense">{formatUsd(historical.totals.expenseCents)}</div><div className="metric-note">Solo columna E de filas candidatas</div></article><article className="card"><div className="metric-label">Filas visibles</div><div className="metric-value">{historical.pagination.totalRows}</div><div className="metric-note">Incluye contexto de apertura identificado</div></article><article className="card"><div className="metric-label">Revisiones de la hoja</div><div className="metric-value">{historical.issueCount ?? 0}</div><div className="metric-note">Sin resolver en staging</div></article></section>
        {historical.openingRows.length ? <section className="section source-context"><strong>Contexto de apertura conservado, no sumado:</strong> {historical.openingRows.map((row) => <span key={row.id}>{row.sheetName}!fila {row.rowNumber}{row.contextAmount ? ` · ${row.contextAmount}` : ""}</span>)}</section> : null}
        <HistoricalMonthlyLedger rows={historical.rows}/>
        <div className="actions section">{historical.pagination.page > 1 ? <Link className="button button-secondary" href={historyUrl(historical.pagination.page - 1)}>Anterior</Link> : null}<span className="small muted">Página {historical.pagination.page} de {historical.pagination.totalPages}</span>{historical.pagination.page < historical.pagination.totalPages ? <Link className="button button-secondary" href={historyUrl(historical.pagination.page + 1)}>Siguiente</Link> : null}</div>
        <p className="small muted section">Lote {historical.batch.sha256.slice(0, 12)}… · {historical.sheet?.name ?? "sin hoja"}. La exportación conserva esta misma separación de fuente.</p>
      </div>
    );
  }

  const report = await getMonthlyAccountReport({ period, accountId: params.account, movementType: params.type, query: params.q, page: Number(params.page) });
  const exportParams = new URLSearchParams({ period, source: "operation" });
  if (report.accountId) exportParams.set("account", report.accountId);
  if (report.movementType) exportParams.set("type", report.movementType);
  if (report.query) exportParams.set("q", report.query);

  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">Cuenta por fecha real</p><h1>Reporte mensual</h1><p className="lede">Saldo inicial calculado, entradas, salidas y cierre usan una sola consulta operativa. La fuente histórica se muestra aparte y nunca se suma a esta tabla.</p></div>
        <a className="button button-secondary" href={`/api/export/movements?${exportParams.toString()}`}>Exportar CSV</a>
      </header>

      <ReportSourceSwitcher source="operation" pathname="/reportes/movimientos" params={{ period, account: report.accountId, type: report.movementType, q: report.query }}/>

      <section className="card filter-card"><form className="report-filters"><input type="hidden" name="source" value="operation"/><div className="field"><label htmlFor="period">Año y mes</label><input id="period" name="period" type="month" defaultValue={period}/></div><div className="field"><label htmlFor="account">Cuenta</label><select id="account" name="account" defaultValue={report.accountId ?? ""}><option value="">Todas las cuentas</option>{report.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div><div className="field"><label htmlFor="type">Tipo</label><select id="type" name="type" defaultValue={report.movementType ?? ""}><option value="">Todos los tipos</option>{Object.values(MovementType).map((type) => <option key={type} value={type}>{movementTypeLabels[type] ?? type}</option>)}</select></div><div className="field filter-search"><label htmlFor="q">Buscar detalle, referencia o cuenta</label><input id="q" name="q" defaultValue={report.query ?? ""} maxLength={100}/></div><button className="button">Aplicar filtros</button></form></section>

      {report.coverageState === "PARTIAL" ? <Notice warning="El período está documentado como parcial; sus totales no equivalen a un cierre mensual." /> : null}
      {report.coverageState === "NOT_IMPORTED" ? <Notice warning="Existe una hoja histórica para este período, pero sus filas no han sido promovidas como movimientos operativos." /> : null}

      <section className="section grid grid-4" aria-label="Totales del período completo">
        <article className="card"><div className="metric-label">Saldo inicial calculado</div><div className="metric-value">{formatUsd(report.periodTotals.openingCents)}</div><div className="metric-note">Movimientos confirmados anteriores; no crea una apertura</div></article>
        <article className="card"><div className="metric-label">Entradas del período</div><div className="metric-value">{formatUsd(report.periodTotals.entriesCents)}</div><div className="metric-note">Período completo, antes del filtro de texto</div></article>
        <article className="card"><div className="metric-label">Salidas del período</div><div className="metric-value">{formatUsd(report.periodTotals.exitsCents)}</div><div className="metric-note">Incluye salidas de cuenta; el consolidado trata transferencias aparte</div></article>
        <article className="card"><div className="metric-label">Saldo final calculado</div><div className="metric-value">{formatUsd(report.periodTotals.closingCents)}</div><div className="metric-note">{coverageLabels[report.coverageState]}{report.latestReconciledAt ? ` · última conciliación ${formatLocalDate(report.latestReconciledAt)}` : ""}</div></article>
      </section>

      <section className="section card">
        <div className="section-header"><div><h2>Subtotal filtrado</h2><p className="small muted">Cambia con búsqueda y cuenta; no sustituye el cierre del período completo.</p></div><StatusPill value={report.coverageState} /></div>
        <div className="metrics"><div className="metric"><span>Entradas filtradas</span><strong>{formatUsd(report.filteredTotals.entriesCents)}</strong></div><div className="metric"><span>Salidas filtradas</span><strong>{formatUsd(report.filteredTotals.exitsCents)}</strong></div><div className="metric"><span>Neto filtrado</span><strong>{formatUsd(report.filteredTotals.closingCents)}</strong></div><div className="metric"><span>Filas</span><strong>{report.pagination.totalRows}</strong></div></div>
      </section>

      <MonthlyLedger movements={report.movements.map((movement) => ({
        id: movement.id,
        occurredOn: formatLocalDateNumeric(movement.occurredAt),
        direction: movement.direction,
        amountCents: movement.amountCents,
        detail: movement.description ?? movement.externalReference ?? "Sin detalle",
        accountName: movement.account.name,
        type: movement.type,
        externalReference: movement.externalReference,
        source: movement.source,
        reconciliationStatus: movement.reconciliationCandidate?.status ?? null,
        paymentParts: movement.paymentParts.map((part) => ({
          id: part.id,
          memberName: part.member.displayName,
          amountCents: part.amountCents,
          note: part.note,
          allocations: part.allocations.map((allocation) => ({ id: allocation.id, period: allocation.charge.period, conceptName: allocation.charge.concept.name, amountCents: allocation.amountCents })),
        })),
      }))} />

      <div className="actions section">{report.pagination.page > 1 ? <Link className="button button-secondary" href={reportUrl({ period, accountId: report.accountId, movementType: report.movementType, query: report.query, page: report.pagination.page - 1 })}>Anterior</Link> : null}<span className="small muted">Página {report.pagination.page} de {report.pagination.totalPages}</span>{report.pagination.page < report.pagination.totalPages ? <Link className="button button-secondary" href={reportUrl({ period, accountId: report.accountId, movementType: report.movementType, query: report.query, page: report.pagination.page + 1 })}>Siguiente</Link> : null}</div>
      {report.sourceCoverage ? <p className="small muted section">Cobertura documental: {report.sourceCoverage.status.toLowerCase()} · lote {report.sourceCoverage.sha256.slice(0, 12)}… · estado {report.sourceCoverage.batchStatus}. Esta referencia no se suma a los movimientos.</p> : null}
    </div>
  );
}
