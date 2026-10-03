import Link from "next/link";
import { AppRole } from "@/generated/prisma/client";
import { Notice } from "@/components/notice";
import { StatusPill } from "@/components/status-pill";
import { requireAccess } from "@/lib/access";
import { formatLocalDate, formatLocalDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getHistoricalSourceView } from "@/server/imports/source";
import type { SourceDiffStatus } from "@/server/imports/comparison";

const differenceLabel: Record<SourceDiffStatus, string> = {
  NEW: "Nuevo",
  MATCHING: "Coincidente",
  MODIFIED: "Modificado",
  AMBIGUOUS: "Ambiguo",
  ABSENT: "Ausente en la nueva versión",
  ALREADY_IMPORTED: "Ya importado",
};

function pageUrl(input: { batchId: string; sheet?: string; query?: string; page?: number }) {
  const params = new URLSearchParams({ batch: input.batchId });
  if (input.sheet) params.set("sheet", input.sheet);
  if (input.query) params.set("q", input.query);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  return `/reportes/historico?${params.toString()}`;
}

function sourceCells(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("cells" in value) || !Array.isArray(value.cells)) return [];
  return value.cells.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const cell = item as Record<string, unknown>;
    return [{
      reference: typeof cell.cellReference === "string" ? cell.cellReference : "",
      value: typeof cell.displayValue === "string" ? cell.displayValue : "",
      formula: typeof cell.formula === "string" ? cell.formula : "",
      cached: typeof cell.cachedValue === "string" ? cell.cachedValue : "",
    }];
  });
}

export default async function HistoricalSourcePage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string; sheet?: string; q?: string; page?: string }>;
}) {
  await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  const params = await searchParams;
  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, originalName: true, sha256: true, createdAt: true, sourceVersion: true, status: true },
  });
  const batchId = batches.some(({ id }) => id === params.batch) ? params.batch! : batches[0]?.id;

  if (!batchId) return (
    <div className="page">
      <header className="page-header"><div><p className="eyebrow">Staging privado</p><h1>Histórico fuente</h1><p className="lede">Aquí se consulta el Excel original sin mezclarlo con registros operativos.</p></div></header>
      <Notice warning="Todavía no hay libros en staging. Cargar un Excel no crea miembros, cargos ni movimientos." />
      <Link className="button" href="/importar">Ir a Importar Excel</Link>
    </div>
  );

  const data = await getHistoricalSourceView({
    batchId,
    sheetName: params.sheet,
    query: params.q,
    page: Number(params.page),
  });
  const currentBatch = batches.find(({ id }) => id === batchId)!;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Fuente histórica privada · no suma con la operación</p>
          <h1>Histórico fuente</h1>
          <p className="lede">Vista de staging con procedencia por hoja, fila y celda. Ningún valor de esta pantalla es un saldo operativo hasta que una transformación específica sea revisada, aprobada y promovida.</p>
        </div>
        <Link className="button button-secondary" href={`/importar?batch=${batchId}`}>Revisar mapeo</Link>
      </header>

      <Notice warning="Octubre de 2026 es parcial al corte declarado. Las fechas contradictorias permanecen pendientes y no se corrigen silenciosamente." />

      <section className="card">
        <form className="form-grid">
          <div className="field"><label htmlFor="batch">Versión del archivo</label><select id="batch" name="batch" defaultValue={batchId}>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.sourceVersion ?? batch.sha256.slice(0, 12)} · {formatLocalDateTime(batch.createdAt)}</option>)}</select></div>
          <div className="field"><label htmlFor="sheet">Pestaña</label><select id="sheet" name="sheet" defaultValue={params.sheet ?? ""}><option value="">Todas</option>{data.sheets.map((sheet) => <option key={sheet.id} value={sheet.name}>{sheet.nominalPeriod ? `${sheet.nominalPeriod} · ` : ""}{sheet.name}{sheet.coverageStatus === "PARTIAL" ? " · parcial" : ""}</option>)}</select></div>
          <div className="field field-full"><label htmlFor="q">Buscar en el texto original</label><input id="q" name="q" defaultValue={params.q ?? ""} maxLength={100} /></div>
          <button className="button">Aplicar filtros</button>
        </form>
      </section>

      <section className="section grid grid-4" aria-label="Cobertura del archivo">
        <article className="card"><div className="metric-label">Hojas</div><div className="metric-value">{data.batch.sheetCount}</div><div className="metric-note">30 esperadas</div></article>
        <article className="card"><div className="metric-label">Filas conservadas</div><div className="metric-value">{data.batch._count.rows}</div><div className="metric-note">Sin usar fila como identidad permanente</div></article>
        <article className="card"><div className="metric-label">Celdas con evidencia</div><div className="metric-value">{data.batch._count.sourceCells}</div><div className="metric-note">Valores, fórmulas y anotaciones</div></article>
        <article className="card"><div className="metric-label">Corte declarado</div><div className="metric-value metric-date">{formatLocalDate(data.batch.declaredCutoff)}</div><div className="metric-note">{data.batch.cutoffTimezone ?? "Zona pendiente"}</div></article>
      </section>

      <section className="section card">
        <div className="section-header"><div><h2>Comparación con la versión anterior</h2><p className="small muted">El hash identifica el archivo. Las filas se comparan por contenido y claves semánticas conservadoras; duplicados plausibles quedan ambiguos.</p></div>{data.comparison.previousBatch ? <span className="small muted">Anterior: {data.comparison.previousBatch.sha256.slice(0, 12)}…</span> : <span className="small muted">Sin versión anterior</span>}</div>
        <div className="metrics metrics-6">{Object.entries(data.comparison.counts).map(([status, count]) => <div className="metric" key={status}><span>{differenceLabel[status as SourceDiffStatus]}</span><strong>{count}</strong></div>)}</div>
      </section>

      <section className="section grid grid-2">
        <article className="card"><h2>Pestañas y bloques</h2><div className="source-sheet-list">{data.sheets.map((sheet) => <Link key={sheet.id} className="source-sheet" href={pageUrl({ batchId, sheet: sheet.name })}><span><strong>{sheet.name}</strong><small>{sheet.kind.replaceAll("_", " ")}{sheet.nominalPeriod ? ` · ${sheet.nominalPeriod}` : ""}</small></span><StatusPill value={sheet.coverageStatus} /></Link>)}</div></article>
        <article className="card"><h2>Bandeja de incidencias</h2>{data.batch.issues.length ? data.batch.issues.map((issue) => <details key={issue.id} className="issue"><summary><StatusPill value={issue.status} /> <strong>{issue.code}</strong> <span className="small">{issue.sheetName}{issue.cellReference ? `!${issue.cellReference}` : ""}</span></summary><p>{issue.message}</p>{issue.evidence ? <p className="small"><strong>Evidencia:</strong> {issue.evidence}</p> : null}{issue.proposal ? <p className="small"><strong>Propuesta:</strong> {issue.proposal}</p> : null}{issue.decisionNeeded ? <p className="small"><strong>Decisión necesaria:</strong> {issue.decisionNeeded}</p> : null}</details>) : <p className="empty">No hay incidencias registradas.</p>}</article>
      </section>

      <section className="section">
        <div className="section-header"><div><h2>Filas de la fuente</h2><p className="small muted">{data.pagination.totalRows} resultado(s). Los agregados, aperturas y cierres están identificados como contexto, no como transacciones.</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>Origen</th><th>Tipo fuente</th><th>Comparación</th><th>Valor original</th><th>Fórmula / caché</th><th>Estado de revisión</th></tr></thead><tbody>{data.rows.map((row) => {
          const cells = sourceCells(row.sourceData);
          const formulaCells = cells.filter(({ formula }) => formula);
          return <tr key={row.id}><td className="source-origin"><strong>{row.sheetName}</strong><br/><span className="mono small">fila {row.rowNumber} · {row.firstCellReference ?? "?"}:{row.lastCellReference ?? "?"}</span></td><td>{row.sourceKind.replaceAll("_", " ")}{row.nominalPeriod ? <><br/><span className="small muted">{row.nominalPeriod}</span></> : null}{row.isAggregate ? <><br/><span className="pill pill-warning">No transacción</span></> : null}</td><td><span className={`pill ${row.comparisonStatus === "AMBIGUOUS" || row.comparisonStatus === "MODIFIED" ? "pill-warning" : row.comparisonStatus === "ALREADY_IMPORTED" ? "pill-success" : "pill-info"}`}>{differenceLabel[row.comparisonStatus]}</span></td><td>{row.rawText}</td><td>{formulaCells.length ? formulaCells.map((cell) => <div key={cell.reference} className="mono small">{cell.reference}: {cell.formula}{cell.cached ? ` → ${cell.cached}` : ""}</div>) : <span className="muted small">Sin fórmula en la fila</span>}</td><td><StatusPill value={row.status} /></td></tr>;
        })}</tbody></table></div>
        <div className="actions section">{data.pagination.page > 1 ? <Link className="button button-secondary" href={pageUrl({ batchId, sheet: params.sheet, query: params.q, page: data.pagination.page - 1 })}>Anterior</Link> : null}<span className="small muted">Página {data.pagination.page} de {data.pagination.totalPages}</span>{data.pagination.page < data.pagination.totalPages ? <Link className="button button-secondary" href={pageUrl({ batchId, sheet: params.sheet, query: params.q, page: data.pagination.page + 1 })}>Siguiente</Link> : null}</div>
      </section>

      <p className="small muted section">Archivo: {currentBatch.originalName}. SHA-256 {currentBatch.sha256}. Esta vista conserva la historia aunque una fila desaparezca en una versión posterior.</p>
    </div>
  );
}
