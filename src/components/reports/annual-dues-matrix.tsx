"use client";

import { useState } from "react";
import { DetailDialog } from "@/components/detail-dialog";
import { formatUsd } from "@/lib/money";

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const STATUS_LABELS: Record<string, string> = {
  PAID: "Pagado",
  PARTIAL: "Parcial",
  PENDING: "Pendiente",
  NOT_DUE: "No exigible",
  FUTURE: "Futuro",
  ADVANCE: "Adelanto",
  REVIEW: "Revisión",
  NOT_IMPORTED: "Sin dato",
};

type ChargeDetail = {
  id: string;
  amountCents: number;
  dueOn: string | null;
  source: string;
  sourceReference: string | null;
  adjustmentsCents: number;
  allocationsCents: number;
};

export type AnnualDuesRowView = {
  id: string;
  displayName: string;
  status: string;
  sectionName: string;
  priorDebtCents: number;
  pendingAtCutoffCents: number;
  creditCents: number;
  advanceCents: number;
  months: Array<{
    period: string;
    dueCents: number;
    appliedCents: number;
    pendingCents: number;
    status: string;
    charges: ChargeDetail[];
  }>;
};

function cellText(cell: AnnualDuesRowView["months"][number]) {
  if (cell.status === "PAID" || cell.status === "ADVANCE") return formatUsd(cell.appliedCents);
  if (cell.status === "PARTIAL") return `${formatUsd(cell.appliedCents)} / ${formatUsd(cell.dueCents)}`;
  if (cell.status === "PENDING") return formatUsd(cell.pendingCents);
  return STATUS_LABELS[cell.status] ?? cell.status;
}

export function AnnualDuesMatrix({ rows, conceptName, initialMonthIndex = 0 }: { rows: AnnualDuesRowView[]; conceptName: string; initialMonthIndex?: number }) {
  const [monthIndex, setMonthIndex] = useState(initialMonthIndex);
  const [selected, setSelected] = useState<{ row: AnnualDuesRowView; cell: AnnualDuesRowView["months"][number] } | null>(null);

  function selectMonth(index: number) {
    const next = Math.max(0, Math.min(11, index));
    setMonthIndex(next);
    const url = new URL(window.location.href);
    url.searchParams.set("month", String(next + 1));
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      <div className="mobile-month-nav section" aria-label="Mes visible en móvil">
        <button className="button button-secondary button-small" type="button" disabled={monthIndex === 0} onClick={() => selectMonth(monthIndex - 1)}>← Anterior</button>
        <strong>{MONTH_LABELS[monthIndex]}</strong>
        <button className="button button-secondary button-small" type="button" disabled={monthIndex === 11} onClick={() => selectMonth(monthIndex + 1)}>Siguiente →</button>
      </div>
      <section className="section table-wrap annual-matrix">
        <table className="sticky-report">
          <thead><tr><th className="sticky-name">Persona</th><th className="sticky-section">Cuerda</th><th className="matrix-support-column">Deuda anterior</th>{MONTH_LABELS.map((month, index) => <th className="month-column" data-mobile-active={index === monthIndex} key={month}>{month}</th>)}<th className="matrix-support-column">Pendiente al corte</th><th className="matrix-support-column">Crédito</th><th className="matrix-support-column">Adelantos</th></tr></thead>
          <tbody>
            {rows.length ? rows.map((row) => <tr key={row.id}>
              <td className="sticky-name"><strong>{row.displayName}</strong><br/><span className="small muted">{row.status.replaceAll("_", " ")}</span></td>
              <td className="sticky-section">{row.sectionName}</td>
              <td className="numeric matrix-support-column">{formatUsd(row.priorDebtCents)}</td>
              {row.months.map((cell, index) => <td
                key={cell.period}
                className={`month-column matrix-cell matrix-${cell.status.toLowerCase().replaceAll("_", "-")} interactive-cell`}
                data-mobile-active={index === monthIndex}
                title={`${cell.period}: ${STATUS_LABELS[cell.status] ?? cell.status}`}
                tabIndex={0}
                aria-label={`${row.displayName}, ${cell.period}: ${STATUS_LABELS[cell.status] ?? cell.status}. Abrir detalle.`}
                onClick={() => setSelected({ row, cell })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    setSelected({ row, cell });
                  }
                }}
              ><span>{cellText(cell)}</span><small>{cell.status === "PAID" ? "✓" : cell.status === "PENDING" ? "!" : "◌"} {STATUS_LABELS[cell.status] ?? cell.status}</small></td>)}
              <td className="numeric matrix-support-column"><strong>{formatUsd(row.pendingAtCutoffCents)}</strong></td><td className="numeric matrix-support-column">{formatUsd(row.creditCents)}</td><td className="numeric matrix-support-column">{formatUsd(row.advanceCents)}</td>
            </tr>) : <tr><td colSpan={18} className="empty">No hay personas operativas para estos filtros. La ausencia de datos no significa que estén al día.</td></tr>}
          </tbody>
        </table>
      </section>

      <DetailDialog
        open={Boolean(selected)}
        title={selected ? selected.row.displayName : "Detalle de cuota"}
        eyebrow={selected ? `${conceptName} · ${selected.cell.period}` : undefined}
        onClose={() => setSelected(null)}
      >
        {selected ? <div className="detail-stack">
          <dl className="detail-list">
            <div><dt>Estado</dt><dd>{selected.cell.status === "PAID" ? "✓" : selected.cell.status === "PENDING" ? "!" : "◌"} {STATUS_LABELS[selected.cell.status] ?? selected.cell.status}</dd></div>
            <div><dt>Exigible</dt><dd>{formatUsd(selected.cell.dueCents)}</dd></div>
            <div><dt>Aplicado</dt><dd className="amount-income">{formatUsd(selected.cell.appliedCents)}</dd></div>
            <div><dt>Pendiente</dt><dd className="amount-expense">{formatUsd(selected.cell.pendingCents)}</dd></div>
          </dl>
          <section><h3>Cargos que forman la celda</h3>
            {selected.cell.charges.length ? selected.cell.charges.map((charge) => <article className="detail-item" key={charge.id}>
              <div className="section-header"><strong>{formatUsd(charge.amountCents + charge.adjustmentsCents)}</strong><span className="pill">{charge.source}</span></div>
              <p className="small muted">Vence: {charge.dueOn ?? "sin fecha"} · aplicado {formatUsd(charge.allocationsCents)}{charge.sourceReference ? ` · ref. ${charge.sourceReference}` : ""}</p>
            </article>) : <p className="empty compact-empty">No existe un cargo operativo para esta celda.</p>}
          </section>
        </div> : null}
      </DetailDialog>
    </>
  );
}
