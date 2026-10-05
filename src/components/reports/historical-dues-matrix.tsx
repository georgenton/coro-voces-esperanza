"use client";

import { Fragment, useState } from "react";
import { AlertTriangle, FileSpreadsheet } from "lucide-react";
import { DetailDialog } from "@/components/detail-dialog";

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const STATUS_LABELS: Record<string, string> = {
  NOT_DUE: "No exigible",
  AMOUNT: "Importe documentado",
  MARK: "Marca X · revisar",
  UNSPECIFIED: "Sin dato",
  REVIEW: "Texto · revisar",
};

function sectionHeading(row: HistoricalDuesRowView) {
  return row.sectionLabel || "Sin cuerda indicada en la fila";
}

export type HistoricalDuesRowView = {
  id: string;
  sheetName: string;
  rowNumber: number;
  reviewStatus: string;
  sourceNumber: string;
  displayName: string;
  sectionLabel: string;
  priorValue: string;
  priorReference: string | null;
  months: Array<{ period: string; label: string; value: string; amountCents: number | null; status: string; reference: string | null; formula: string | null; cachedValue: string | null }>;
};

export function HistoricalDuesMatrix({ rows, initialMonthIndex = 0 }: { rows: HistoricalDuesRowView[]; initialMonthIndex?: number }) {
  const [monthIndex, setMonthIndex] = useState(initialMonthIndex);
  const [selected, setSelected] = useState<{ row: HistoricalDuesRowView; cell: HistoricalDuesRowView["months"][number] } | null>(null);

  function selectMonth(index: number) {
    const next = Math.max(0, Math.min(11, index));
    setMonthIndex(next);
    const url = new URL(window.location.href);
    url.searchParams.set("month", String(next + 1));
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      <div className="matrix-toolbar section">
        <div className="matrix-legend" aria-label="Leyenda de la matriz histórica"><span><i className="legend-amount"/> Importe documentado</span><span><i className="legend-review"/> X o texto: revisar</span><span><i className="legend-empty"/> — no exigible · sin dato</span></div>
        <div className="mobile-month-nav" aria-label="Mes visible en móvil"><button className="button button-secondary button-small" type="button" disabled={monthIndex === 0} onClick={() => selectMonth(monthIndex - 1)}>← Anterior</button><strong>{MONTH_LABELS[monthIndex]}</strong><button className="button button-secondary button-small" type="button" disabled={monthIndex === 11} onClick={() => selectMonth(monthIndex + 1)}>Siguiente →</button></div>
      </div>
      <section className="section table-wrap annual-matrix historical-matrix">
        <table className="sticky-report"><thead><tr><th className="sticky-name">Nombre en la fuente</th><th className="matrix-support-column">Deuda anterior</th>{MONTH_LABELS.map((month, index) => <th className="month-column" data-mobile-active={index === monthIndex} key={month}>{month}</th>)}</tr></thead>
          <tbody>{rows.length ? rows.map((row, rowIndex) => <Fragment key={row.id}>{sectionHeading(row) !== (rows[rowIndex - 1] ? sectionHeading(rows[rowIndex - 1]) : null) ? <tr className="matrix-group-row"><th scope="rowgroup" colSpan={14}>{sectionHeading(row)}</th></tr> : null}<tr><td className="sticky-name"><strong>{row.displayName}</strong></td><td className="matrix-support-column source-prior-cell">{row.priorValue || "Sin dato"}</td>{row.months.map((cell, index) => <td key={cell.period} className={`month-column historical-cell source-${cell.status.toLowerCase().replaceAll("_", "-")}`} data-mobile-active={index === monthIndex}><button type="button" className="historical-cell-button" title={`${cell.period}: ${STATUS_LABELS[cell.status] ?? cell.status}`} aria-label={`${row.displayName}, ${cell.period}: ${STATUS_LABELS[cell.status] ?? cell.status}. Abrir procedencia.`} onClick={() => setSelected({ row, cell })}><span>{cell.status === "NOT_DUE" ? "—" : cell.value || "·"}</span>{cell.status === "MARK" || cell.status === "REVIEW" ? <AlertTriangle className="cell-review-icon" aria-hidden="true" size={11}/> : null}<span className="sr-only">{STATUS_LABELS[cell.status] ?? cell.status}</span></button></td>)}</tr></Fragment>) : <tr><td colSpan={14} className="empty">No hay filas de personas en esta matriz histórica.</td></tr>}</tbody>
        </table>
      </section>
      <DetailDialog open={Boolean(selected)} title={selected?.row.displayName ?? "Celda histórica"} eyebrow={selected ? `${selected.cell.period} · ${selected.row.sheetName}!${selected.cell.reference ?? "sin celda"}` : undefined} onClose={() => setSelected(null)}>
        {selected ? <div className="detail-stack"><div className="source-warning"><FileSpreadsheet aria-hidden="true" size={18}/><p><strong>Evidencia literal del Excel.</strong><br/>Una cantidad, X o vacío no se convierte automáticamente en pago, exención, mora ni fecha de recepción.</p></div><dl className="detail-list"><div><dt>Valor visible</dt><dd>{selected.cell.value || "Vacío"}</dd></div><div><dt>Interpretación segura</dt><dd>{STATUS_LABELS[selected.cell.status] ?? selected.cell.status}</dd></div><div><dt>Cuerda en fila</dt><dd>{selected.row.sectionLabel || "No indicada"}</dd></div><div><dt>Deuda anterior</dt><dd>{selected.row.priorValue || "Sin dato"}</dd></div><div><dt>Estado de fila</dt><dd>{selected.row.reviewStatus}</dd></div><div><dt>Procedencia</dt><dd className="mono">{selected.row.sheetName}!{selected.cell.reference ?? "—"} · fila {selected.row.rowNumber}</dd></div></dl>{selected.cell.formula ? <p className="small muted mono">Fórmula: {selected.cell.formula}{selected.cell.cachedValue ? ` · caché ${selected.cell.cachedValue}` : ""}</p> : null}</div> : null}
      </DetailDialog>
    </>
  );
}
