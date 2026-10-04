"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { DetailDialog } from "@/components/detail-dialog";

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const STATUS_LABELS: Record<string, string> = {
  NOT_DUE: "No exigible",
  AMOUNT: "Importe documentado",
  MARK: "Marca X · revisar",
  UNSPECIFIED: "Sin dato",
  REVIEW: "Texto · revisar",
};

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

export function HistoricalDuesMatrix({ rows }: { rows: HistoricalDuesRowView[] }) {
  const [monthIndex, setMonthIndex] = useState(0);
  const [selected, setSelected] = useState<{ row: HistoricalDuesRowView; cell: HistoricalDuesRowView["months"][number] } | null>(null);
  return (
    <>
      <div className="mobile-month-nav section" aria-label="Mes visible en móvil"><button className="button button-secondary button-small" type="button" disabled={monthIndex === 0} onClick={() => setMonthIndex((value) => Math.max(0, value - 1))}>← Anterior</button><strong>{MONTH_LABELS[monthIndex]}</strong><button className="button button-secondary button-small" type="button" disabled={monthIndex === 11} onClick={() => setMonthIndex((value) => Math.min(11, value + 1))}>Siguiente →</button></div>
      <section className="section table-wrap annual-matrix historical-matrix">
        <table className="sticky-report"><thead><tr><th className="sticky-name">Nombre en la fuente</th><th className="sticky-section">Cuerda en fila</th><th className="matrix-support-column">Deuda anterior</th>{MONTH_LABELS.map((month, index) => <th className="month-column" data-mobile-active={index === monthIndex} key={month}>{month}</th>)}</tr></thead>
          <tbody>{rows.length ? rows.map((row) => <tr key={row.id}><td className="sticky-name"><strong>{row.displayName}</strong><small className="source-row-reference">{row.sheetName} · fila {row.rowNumber}</small></td><td className="sticky-section">{row.sectionLabel || "No indicada en esta fila"}</td><td className="matrix-support-column source-prior-cell">{row.priorValue || "Sin dato"}{row.priorReference ? <small>{row.priorReference}</small> : null}</td>{row.months.map((cell, index) => <td key={cell.period} className={`month-column historical-cell source-${cell.status.toLowerCase().replaceAll("_", "-")} interactive-cell`} data-mobile-active={index === monthIndex} tabIndex={0} title={`${cell.period}: ${STATUS_LABELS[cell.status] ?? cell.status}`} onClick={() => setSelected({ row, cell })} onKeyDown={(event) => { if (event.key === "Enter") setSelected({ row, cell }); }}><span>{cell.status === "NOT_DUE" ? "—" : cell.value || "·"}</span><small>{STATUS_LABELS[cell.status] ?? cell.status}</small></td>)}</tr>) : <tr><td colSpan={15} className="empty">No hay filas de personas en esta matriz histórica.</td></tr>}</tbody>
        </table>
      </section>
      <DetailDialog open={Boolean(selected)} title={selected?.row.displayName ?? "Celda histórica"} eyebrow={selected ? `${selected.cell.period} · ${selected.row.sheetName}!${selected.cell.reference ?? "sin celda"}` : undefined} onClose={() => setSelected(null)}>
        {selected ? <div className="detail-stack"><div className="source-warning"><FileSpreadsheet aria-hidden="true" size={18}/><p><strong>Evidencia literal del Excel.</strong><br/>Una cantidad, X o vacío no se convierte automáticamente en pago, exención, mora ni fecha de recepción.</p></div><dl className="detail-list"><div><dt>Valor visible</dt><dd>{selected.cell.value || "Vacío"}</dd></div><div><dt>Interpretación segura</dt><dd>{STATUS_LABELS[selected.cell.status] ?? selected.cell.status}</dd></div><div><dt>Estado de fila</dt><dd>{selected.row.reviewStatus}</dd></div><div><dt>Procedencia</dt><dd className="mono">{selected.row.sheetName}!{selected.cell.reference ?? "—"}</dd></div></dl>{selected.cell.formula ? <p className="small muted mono">Fórmula: {selected.cell.formula}{selected.cell.cachedValue ? ` · caché ${selected.cell.cachedValue}` : ""}</p> : null}</div> : null}
      </DetailDialog>
    </>
  );
}
