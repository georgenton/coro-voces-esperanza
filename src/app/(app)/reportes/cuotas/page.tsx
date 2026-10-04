import Link from "next/link";
import { AppRole } from "@/generated/prisma/client";
import { AnnualDuesMatrix } from "@/components/reports/annual-dues-matrix";
import { requireAccess } from "@/lib/access";
import { formatUsd } from "@/lib/money";
import { getAnnualDuesReport } from "@/server/reports/annual-dues";

function currentPeriod() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "America/Guayaquil" }).format(new Date()).slice(0, 7);
}

function reportUrl(input: { year: number; cutoff: string; concept?: string; section?: string; status?: string; query?: string; page?: number }) {
  const params = new URLSearchParams({ year: String(input.year), cutoff: input.cutoff });
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
  searchParams: Promise<{ year?: string; cutoff?: string; concept?: string; section?: string; status?: string; q?: string; page?: string }>;
}) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA, AppRole.DIRECTORA, AppRole.JEFE_DE_CUERDA, AppRole.MIEMBRO]);
  const params = await searchParams;
  const now = currentPeriod();
  const requestedYear = Number(params.year);
  const year = Number.isSafeInteger(requestedYear) && requestedYear >= 2020 && requestedYear <= 2100 ? requestedYear : Number(now.slice(0, 4));
  const cutoff = new RegExp(`^${year}-(0[1-9]|1[0-2])$`).test(params.cutoff ?? "") ? params.cutoff! : `${year}-${year === Number(now.slice(0, 4)) ? now.slice(5, 7) : "12"}`;
  const report = await getAnnualDuesReport({ access, year, cutoffPeriod: cutoff, conceptId: params.concept, sectionId: params.section, memberStatus: params.status, query: params.q, page: Number(params.page) });
  const exportParams = new URLSearchParams({ year: String(year), cutoff });
  exportParams.set("concept", report.filters.conceptId);
  if (report.filters.sectionId) exportParams.set("section", report.filters.sectionId);
  if (report.filters.memberStatus) exportParams.set("status", report.filters.memberStatus);
  if (report.filters.query) exportParams.set("q", report.filters.query);

  return (
    <div className="page page-wide">
      <header className="page-header"><div><p className="eyebrow">Personas únicas · cargos y aplicaciones operativas</p><h1>Matriz anual de cuotas</h1><p className="lede">La fecha del cobro y el mes cubierto son distintos. Enero no exigible, períodos futuros, celdas sin importar y revisiones pendientes nunca se convierten en mora.</p></div><a className="button button-secondary" href={`/api/export/annual-dues?${exportParams.toString()}`}>Exportar CSV</a></header>

      <section className="card filter-card"><form className="report-filters annual-filters"><div className="field"><label htmlFor="year">Año</label><input id="year" name="year" type="number" min="2020" max="2100" defaultValue={year}/></div><div className="field"><label htmlFor="cutoff">Corte</label><input id="cutoff" name="cutoff" type="month" defaultValue={cutoff}/></div><div className="field"><label htmlFor="concept">Concepto</label><select id="concept" name="concept" defaultValue={report.filters.conceptId}>{report.concepts.map((concept) => <option key={concept.id} value={concept.id}>{concept.name}</option>)}</select></div><div className="field"><label htmlFor="section">Cuerda</label><select id="section" name="section" defaultValue={report.filters.sectionId ?? ""}><option value="">Todas las autorizadas</option>{report.sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></div><div className="field"><label htmlFor="status">Vigencia</label><select id="status" name="status" defaultValue={report.filters.memberStatus ?? ""}><option value="">Todas</option><option value="ACTIVE">Activo</option><option value="PAUSED">Pausa</option><option value="RETIRED">Retirado</option><option value="REVIEW_REQUIRED">Revisión</option></select></div><div className="field filter-search"><label htmlFor="q">Buscar persona</label><input id="q" name="q" defaultValue={report.filters.query ?? ""} maxLength={100}/></div><button className="button">Aplicar filtros</button></form></section>

      <section className="section grid grid-4"><article className="card"><div className="metric-label">Personas en el filtro</div><div className="metric-value">{report.pagination.totalRows}</div><div className="metric-note">No usa contadores ni subtotales del Excel</div></article><article className="card"><div className="metric-label">Deuda anterior pendiente</div><div className="metric-value">{formatUsd(report.totals.priorDebtCents)}</div><div className="metric-note">No se registra como ingreso</div></article><article className="card"><div className="metric-label">Aplicado al corte</div><div className="metric-value">{formatUsd(report.totals.appliedAtCutoffCents)}</div><div className="metric-note">Corte {cutoff}</div></article><article className="card"><div className="metric-label">Pendiente al corte</div><div className="metric-value">{formatUsd(report.totals.pendingAtCutoffCents)}</div><div className="metric-note">Crédito {formatUsd(report.totals.creditCents)} · adelantos {formatUsd(report.totals.advanceCents)}</div></article></section>

      <AnnualDuesMatrix conceptName={report.selectedConcept.name} rows={report.rows.map((row) => ({
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

      <div className="actions section">{report.pagination.page > 1 ? <Link className="button button-secondary" href={reportUrl({ year, cutoff, concept: report.filters.conceptId, section: report.filters.sectionId, status: report.filters.memberStatus, query: report.filters.query, page: report.pagination.page - 1 })}>Anterior</Link> : null}<span className="small muted">Página {report.pagination.page} de {report.pagination.totalPages}</span>{report.pagination.page < report.pagination.totalPages ? <Link className="button button-secondary" href={reportUrl({ year, cutoff, concept: report.filters.conceptId, section: report.filters.sectionId, status: report.filters.memberStatus, query: report.filters.query, page: report.pagination.page + 1 })}>Siguiente</Link> : null}</div>
    </div>
  );
}
