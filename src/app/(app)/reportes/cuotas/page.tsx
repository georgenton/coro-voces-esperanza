import Link from "next/link";
import { AppRole } from "@/generated/prisma/client";
import { requireAccess } from "@/lib/access";
import { formatUsd } from "@/lib/money";
import { getAnnualDuesReport, type AnnualDuesCellStatus } from "@/server/reports/annual-dues";

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const STATUS_LABELS: Record<AnnualDuesCellStatus, string> = {
  PAID: "Pagado",
  PARTIAL: "Parcial",
  PENDING: "Pendiente",
  NOT_DUE: "No exigible",
  FUTURE: "Futuro",
  ADVANCE: "Adelanto",
  REVIEW: "Revisión",
  NOT_IMPORTED: "Sin dato",
};

function currentPeriod() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "America/Guayaquil" }).format(new Date()).slice(0, 7);
}

function reportUrl(input: { year: number; cutoff: string; section?: string; status?: string; query?: string; page?: number }) {
  const params = new URLSearchParams({ year: String(input.year), cutoff: input.cutoff });
  if (input.section) params.set("section", input.section);
  if (input.status) params.set("status", input.status);
  if (input.query) params.set("q", input.query);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  return `/reportes/cuotas?${params.toString()}`;
}

function cellText(cell: { status: AnnualDuesCellStatus; dueCents: number; appliedCents: number; pendingCents: number }) {
  if (cell.status === "PAID") return formatUsd(cell.appliedCents);
  if (cell.status === "PARTIAL") return `${formatUsd(cell.appliedCents)} / ${formatUsd(cell.dueCents)}`;
  if (cell.status === "PENDING") return formatUsd(cell.pendingCents);
  if (cell.status === "ADVANCE") return formatUsd(cell.appliedCents);
  return STATUS_LABELS[cell.status];
}

export default async function AnnualDuesReport({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; cutoff?: string; section?: string; status?: string; q?: string; page?: string }>;
}) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA, AppRole.DIRECTORA, AppRole.JEFE_DE_CUERDA]);
  const params = await searchParams;
  const now = currentPeriod();
  const requestedYear = Number(params.year);
  const year = Number.isSafeInteger(requestedYear) && requestedYear >= 2020 && requestedYear <= 2100 ? requestedYear : Number(now.slice(0, 4));
  const cutoff = new RegExp(`^${year}-(0[1-9]|1[0-2])$`).test(params.cutoff ?? "") ? params.cutoff! : `${year}-${year === Number(now.slice(0, 4)) ? now.slice(5, 7) : "12"}`;
  const report = await getAnnualDuesReport({ access, year, cutoffPeriod: cutoff, sectionId: params.section, memberStatus: params.status, query: params.q, page: Number(params.page) });
  const exportParams = new URLSearchParams({ year: String(year), cutoff });
  if (report.filters.sectionId) exportParams.set("section", report.filters.sectionId);
  if (report.filters.memberStatus) exportParams.set("status", report.filters.memberStatus);
  if (report.filters.query) exportParams.set("q", report.filters.query);

  return (
    <div className="page page-wide">
      <header className="page-header"><div><p className="eyebrow">Personas únicas · cargos y aplicaciones operativas</p><h1>Matriz anual de cuotas</h1><p className="lede">La fecha del cobro y el mes cubierto son distintos. Enero no exigible, períodos futuros, celdas sin importar y revisiones pendientes nunca se convierten en mora.</p></div><a className="button button-secondary" href={`/api/export/annual-dues?${exportParams.toString()}`}>Exportar CSV</a></header>

      <section className="card"><form className="form-grid"><div className="field"><label htmlFor="year">Año</label><input id="year" name="year" type="number" min="2020" max="2100" defaultValue={year}/></div><div className="field"><label htmlFor="cutoff">Corte</label><input id="cutoff" name="cutoff" type="month" defaultValue={cutoff}/></div><div className="field"><label htmlFor="section">Cuerda</label><select id="section" name="section" defaultValue={report.filters.sectionId ?? ""}><option value="">Todas las autorizadas</option>{report.sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></div><div className="field"><label htmlFor="status">Vigencia</label><select id="status" name="status" defaultValue={report.filters.memberStatus ?? ""}><option value="">Todas</option><option value="ACTIVE">Activo</option><option value="PAUSED">Pausa</option><option value="RETIRED">Retirado</option><option value="REVIEW_REQUIRED">Revisión</option></select></div><div className="field field-full"><label htmlFor="q">Buscar persona</label><input id="q" name="q" defaultValue={report.filters.query ?? ""} maxLength={100}/></div><button className="button">Aplicar filtros</button></form></section>

      <section className="section grid grid-4"><article className="card"><div className="metric-label">Personas en el filtro</div><div className="metric-value">{report.pagination.totalRows}</div><div className="metric-note">No usa contadores ni subtotales del Excel</div></article><article className="card"><div className="metric-label">Deuda anterior pendiente</div><div className="metric-value">{formatUsd(report.totals.priorDebtCents)}</div><div className="metric-note">No se registra como ingreso</div></article><article className="card"><div className="metric-label">Aplicado al corte</div><div className="metric-value">{formatUsd(report.totals.appliedAtCutoffCents)}</div><div className="metric-note">Corte {cutoff}</div></article><article className="card"><div className="metric-label">Pendiente al corte</div><div className="metric-value">{formatUsd(report.totals.pendingAtCutoffCents)}</div><div className="metric-note">Crédito {formatUsd(report.totals.creditCents)} · adelantos {formatUsd(report.totals.advanceCents)}</div></article></section>

      <section className="section table-wrap annual-matrix"><table className="sticky-report"><thead><tr><th className="sticky-name">Persona</th><th className="sticky-section">Cuerda</th><th>Deuda anterior</th>{MONTH_LABELS.map((month) => <th key={month}>{month}</th>)}<th>Pendiente al corte</th><th>Crédito</th><th>Adelantos</th></tr></thead><tbody>{report.rows.length ? report.rows.map((row) => <tr key={row.id}><td className="sticky-name"><Link href={`/miembros/${row.id}`}><strong>{row.displayName}</strong></Link><br/><span className="small muted">{row.status.replaceAll("_", " ")}</span></td><td className="sticky-section">{row.section?.name ?? "Administración / pendiente"}</td><td className="numeric">{formatUsd(row.priorDebtCents)}</td>{row.months.map((cell) => <td key={cell.period} className={`matrix-cell matrix-${cell.status.toLowerCase().replaceAll("_", "-")}`} title={`${cell.period}: ${STATUS_LABELS[cell.status]}`}><span>{cellText(cell)}</span><small>{STATUS_LABELS[cell.status]}</small></td>)}<td className="numeric"><strong>{formatUsd(row.pendingAtCutoffCents)}</strong></td><td className="numeric">{formatUsd(row.creditCents)}</td><td className="numeric">{formatUsd(row.advanceCents)}</td></tr>) : <tr><td colSpan={18} className="empty">No hay personas operativas para estos filtros. La ausencia de datos no significa que estén al día.</td></tr>}</tbody></table></section>

      <div className="actions section">{report.pagination.page > 1 ? <Link className="button button-secondary" href={reportUrl({ year, cutoff, section: report.filters.sectionId, status: report.filters.memberStatus, query: report.filters.query, page: report.pagination.page - 1 })}>Anterior</Link> : null}<span className="small muted">Página {report.pagination.page} de {report.pagination.totalPages}</span>{report.pagination.page < report.pagination.totalPages ? <Link className="button button-secondary" href={reportUrl({ year, cutoff, section: report.filters.sectionId, status: report.filters.memberStatus, query: report.filters.query, page: report.pagination.page + 1 })}>Siguiente</Link> : null}</div>
    </div>
  );
}
