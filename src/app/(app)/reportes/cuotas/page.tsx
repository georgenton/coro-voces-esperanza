import Link from "next/link";
import { AppRole } from "@/generated/prisma/client";
import { AnnualDuesMatrix } from "@/components/reports/annual-dues-matrix";
import { HistoricalDuesMatrix } from "@/components/reports/historical-dues-matrix";
import { ReportSourceSwitcher } from "@/components/reports/report-source-switcher";
import { Notice } from "@/components/notice";
import { requireAccess } from "@/lib/access";
import { formatUsd } from "@/lib/money";
import { getAnnualDuesReport } from "@/server/reports/annual-dues";
import { getHistoricalDuesReport, resolveReportSource } from "@/server/reports/historical";

function currentPeriod() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "America/Guayaquil" }).format(new Date()).slice(0, 7);
}

function reportUrl(input: { year: number; cutoff: string; month?: number; concept?: string; section?: string; status?: string; query?: string; page?: number }) {
  const params = new URLSearchParams({ year: String(input.year), cutoff: input.cutoff, source: "operation" });
  if (input.month) params.set("month", String(input.month));
  if (input.concept) params.set("concept", input.concept);
  if (input.section) params.set("section", input.section);
  if (input.status) params.set("status", input.status);
  if (input.query) params.set("q", input.query);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  return `/reportes/cuotas?${params.toString()}`;
}

export default async function AnnualDuesReport({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; cutoff?: string; month?: string; source?: string; concept?: string; section?: string; status?: string; q?: string; page?: string }>;
}) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA, AppRole.DIRECTORA, AppRole.JEFE_DE_CUERDA, AppRole.MIEMBRO]);
  const params = await searchParams;
  const now = currentPeriod();
  const requestedYear = Number(params.year);
  const year = Number.isSafeInteger(requestedYear) && requestedYear >= 2020 && requestedYear <= 2100 ? requestedYear : Number(now.slice(0, 4));
  const cutoff = new RegExp(`^${year}-(0[1-9]|1[0-2])$`).test(params.cutoff ?? "") ? params.cutoff! : `${year}-${year === Number(now.slice(0, 4)) ? now.slice(5, 7) : "12"}`;
  const requestedMonth = Number(params.month);
  const month = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : Number(cutoff.slice(5, 7));
  const sourceContext = await resolveReportSource(access, params.source);

  if (sourceContext.source === "historical" && sourceContext.batchId) {
    const historical = await getHistoricalDuesReport({ batchId: sourceContext.batchId, year, query: params.q, page: Number(params.page) });
    const historyUrl = (page: number) => {
      const query = new URLSearchParams({ year: String(historical.year), month: String(month), source: "historical" });
      if (params.q) query.set("q", params.q);
      if (page > 1) query.set("page", String(page));
      return `/reportes/cuotas?${query.toString()}`;
    };
    return (
      <div className="page page-wide">
        <header className="page-header"><div><p className="eyebrow">Matriz real del Excel · pendiente de validación</p><h1>Matriz anual de cuotas</h1><p className="lede">Valores literales de la fuente con procedencia por celda. Una cantidad, X, vacío o color no se transforma automáticamente en pago, exención, mora ni fecha de cobro.</p></div><a className="button button-secondary" href={`/api/export/annual-dues?year=${historical.year}&source=historical${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}>Exportar fuente CSV</a></header>
        <ReportSourceSwitcher source="historical" pathname="/reportes/cuotas" params={{ year: String(historical.year), month: String(month), q: params.q }}/>
        <section className="card filter-card"><form className="report-filters"><input type="hidden" name="source" value="historical"/><input type="hidden" name="month" value={month}/><div className="field"><label htmlFor="year">Año</label><select id="year" name="year" defaultValue={String(historical.year)}>{historical.availableYears.map((availableYear) => <option key={availableYear} value={availableYear}>{availableYear}</option>)}</select></div><div className="field filter-search"><label htmlFor="q">Buscar nombre original</label><input id="q" name="q" defaultValue={params.q ?? ""} maxLength={100}/></div><button className="button">Aplicar filtros</button></form></section>
        <Notice warning="Fuente histórica pendiente de validación. Enero se muestra como no exigible por la regla documentada; el resto conserva el valor original sin inferir su significado."/>
        <details className="audit-details section"><summary>Resumen técnico de la matriz</summary><section className="grid grid-4"><article className="card"><div className="metric-label">Filas de personas</div><div className="metric-value">{historical.totals.people}</div><div className="metric-note">No consolida identidades entre años</div></article><article className="card"><div className="metric-label">Celdas con importe</div><div className="metric-value">{historical.totals.amounts}</div><div className="metric-note">Importe documentado, no fecha de recepción</div></article><article className="card"><div className="metric-label">Marcas X</div><div className="metric-value">{historical.totals.marks}</div><div className="metric-note">Significado pendiente de revisión</div></article><article className="card"><div className="metric-label">Sin dato / revisión</div><div className="metric-value">{historical.totals.unspecified + historical.totals.review}</div><div className="metric-note">No equivale a deuda ni a estar al día</div></article></section></details>
        <HistoricalDuesMatrix rows={historical.rows} initialMonthIndex={month - 1}/>
        <div className="actions section">{historical.pagination.page > 1 ? <Link className="button button-secondary" href={historyUrl(historical.pagination.page - 1)}>Anterior</Link> : null}<span className="small muted">Página {historical.pagination.page} de {historical.pagination.totalPages}</span>{historical.pagination.page < historical.pagination.totalPages ? <Link className="button button-secondary" href={historyUrl(historical.pagination.page + 1)}>Siguiente</Link> : null}</div>
        <p className="small muted section">{historical.sheet?.name ?? "Matriz no disponible"} · lote {historical.batch.sha256.slice(0, 12)}… · sin promoción operativa.</p>
      </div>
    );
  }

  const report = await getAnnualDuesReport({ access, year, cutoffPeriod: cutoff, conceptId: params.concept, sectionId: params.section, memberStatus: params.status, query: params.q, page: Number(params.page) });
  const exportParams = new URLSearchParams({ year: String(year), cutoff, source: "operation" });
  exportParams.set("concept", report.filters.conceptId);
  if (report.filters.sectionId) exportParams.set("section", report.filters.sectionId);
  if (report.filters.memberStatus) exportParams.set("status", report.filters.memberStatus);
  if (report.filters.query) exportParams.set("q", report.filters.query);

  return (
    <div className="page page-wide">
      <header className="page-header"><div><p className="eyebrow">Personas únicas · cargos y aplicaciones operativas</p><h1>Matriz anual de cuotas</h1><p className="lede">La fecha del cobro y el mes cubierto son distintos. Enero no exigible, períodos futuros, celdas sin importar y revisiones pendientes nunca se convierten en mora.</p></div><a className="button button-secondary" href={`/api/export/annual-dues?${exportParams.toString()}`}>Exportar CSV</a></header>

      {sourceContext.canReadHistory && sourceContext.hasHistory ? <ReportSourceSwitcher source="operation" pathname="/reportes/cuotas" params={{ year: String(year), cutoff, month: String(month), concept: report.filters.conceptId, section: report.filters.sectionId, status: report.filters.memberStatus, q: report.filters.query }}/> : null}

      <section className="card filter-card"><form className="report-filters annual-filters"><input type="hidden" name="source" value="operation"/><div className="field"><label htmlFor="year">Año</label><input id="year" name="year" type="number" min="2020" max="2100" defaultValue={year}/></div><div className="field"><label htmlFor="cutoff">Corte</label><input id="cutoff" name="cutoff" type="month" defaultValue={cutoff}/></div><div className="field"><label htmlFor="concept">Concepto</label><select id="concept" name="concept" defaultValue={report.filters.conceptId}>{report.concepts.map((concept) => <option key={concept.id} value={concept.id}>{concept.name}</option>)}</select></div><div className="field"><label htmlFor="section">Cuerda</label><select id="section" name="section" defaultValue={report.filters.sectionId ?? ""}><option value="">Todas las autorizadas</option>{report.sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></div><div className="field"><label htmlFor="status">Vigencia</label><select id="status" name="status" defaultValue={report.filters.memberStatus ?? ""}><option value="">Todas</option><option value="ACTIVE">Activo</option><option value="PAUSED">Pausa</option><option value="RETIRED">Retirado</option><option value="REVIEW_REQUIRED">Revisión</option></select></div><div className="field filter-search"><label htmlFor="q">Buscar persona</label><input id="q" name="q" defaultValue={report.filters.query ?? ""} maxLength={100}/></div><button className="button">Aplicar filtros</button></form></section>

      <section className="section grid grid-4"><article className="card"><div className="metric-label">Personas en el filtro</div><div className="metric-value">{report.pagination.totalRows}</div><div className="metric-note">No usa contadores ni subtotales del Excel</div></article><article className="card"><div className="metric-label">Deuda anterior pendiente</div><div className="metric-value">{formatUsd(report.totals.priorDebtCents)}</div><div className="metric-note">No se registra como ingreso</div></article><article className="card"><div className="metric-label">Aplicado al corte</div><div className="metric-value">{formatUsd(report.totals.appliedAtCutoffCents)}</div><div className="metric-note">Corte {cutoff}</div></article><article className="card"><div className="metric-label">Pendiente al corte</div><div className="metric-value">{formatUsd(report.totals.pendingAtCutoffCents)}</div><div className="metric-note">Crédito {formatUsd(report.totals.creditCents)} · adelantos {formatUsd(report.totals.advanceCents)}</div></article></section>

      <AnnualDuesMatrix conceptName={report.selectedConcept.name} initialMonthIndex={month - 1} rows={report.rows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        status: row.status,
        sectionName: row.section?.name ?? "Administración / pendiente",
        priorDebtCents: row.priorDebtCents,
        pendingAtCutoffCents: row.pendingAtCutoffCents,
        creditCents: row.creditCents,
        advanceCents: row.advanceCents,
        months: row.months,
      }))} />

      <div className="actions section">{report.pagination.page > 1 ? <Link className="button button-secondary" href={reportUrl({ year, cutoff, month, concept: report.filters.conceptId, section: report.filters.sectionId, status: report.filters.memberStatus, query: report.filters.query, page: report.pagination.page - 1 })}>Anterior</Link> : null}<span className="small muted">Página {report.pagination.page} de {report.pagination.totalPages}</span>{report.pagination.page < report.pagination.totalPages ? <Link className="button button-secondary" href={reportUrl({ year, cutoff, month, concept: report.filters.conceptId, section: report.filters.sectionId, status: report.filters.memberStatus, query: report.filters.query, page: report.pagination.page + 1 })}>Siguiente</Link> : null}</div>
    </div>
  );
}
