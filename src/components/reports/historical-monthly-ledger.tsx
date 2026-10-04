"use client";

import { useState } from "react";
import { FileSpreadsheet, Search } from "lucide-react";
import { DetailDialog } from "@/components/detail-dialog";

export type HistoricalMonthlyRowView = {
  id: string;
  sheetName: string;
  rowNumber: number;
  reviewStatus: string;
  occurredOn: string;
  incomeDetail: string;
  incomeAmount: string;
  incomeCents: number | null;
  expenseDetail: string;
  expenseAmount: string;
  expenseCents: number | null;
  observation: string;
  cells: Array<{ reference: string; displayValue: string | null; formula: string | null; cachedValue: string | null; originalDate: string | null }>;
};

export function HistoricalMonthlyLedger({ rows }: { rows: HistoricalMonthlyRowView[] }) {
  const [selected, setSelected] = useState<HistoricalMonthlyRowView | null>(null);

  return (
    <>
      <section className="section table-wrap ledger-table" aria-label="Filas documentadas en la hoja mensual">
        <table className="sticky-report source-ledger">
          <thead>
            <tr><th rowSpan={2} className="source-date-header">Fecha original</th><th colSpan={2} className="source-income-header">Ingresos documentados</th><th colSpan={2} className="source-expense-header">Egresos documentados</th><th rowSpan={2} className="source-note-header">Observaciones</th><th rowSpan={2}>Origen</th></tr>
            <tr><th className="source-income-header">Detalle</th><th className="source-income-header numeric">Monto</th><th className="source-expense-header">Detalle</th><th className="source-expense-header numeric">Monto</th></tr>
          </thead>
          <tbody>{rows.length ? rows.map((row) => <tr key={row.id} className="interactive-row" tabIndex={0} onClick={() => setSelected(row)} onKeyDown={(event) => { if (event.key === "Enter") setSelected(row); }}>
            <td className="source-date-cell">{row.occurredOn || "Fecha no indicada"}</td>
            <td className="source-income-cell">{row.incomeDetail}</td>
            <td className="source-income-cell numeric">{row.incomeAmount}</td>
            <td className="source-expense-cell">{row.expenseDetail}</td>
            <td className="source-expense-cell numeric">{row.expenseAmount}</td>
            <td>{row.observation}</td>
            <td className="source-origin-cell"><strong>{row.sheetName}</strong><small>fila {row.rowNumber}</small></td>
          </tr>) : <tr><td colSpan={7} className="empty"><Search aria-hidden="true" size={20}/> No hay filas de movimiento candidatas para este filtro.</td></tr>}</tbody>
        </table>
      </section>

      <DetailDialog open={Boolean(selected)} title={selected?.observation || selected?.incomeDetail || selected?.expenseDetail || "Fila histórica"} eyebrow={selected ? `${selected.sheetName} · fila ${selected.rowNumber}` : undefined} onClose={() => setSelected(null)}>
        {selected ? <div className="detail-stack">
          <div className="source-warning"><FileSpreadsheet aria-hidden="true" size={18}/><p><strong>Fuente histórica, no operación validada.</strong><br/>Esta fila conserva evidencia del Excel y no crea por sí sola un movimiento, pago ni saldo.</p></div>
          <dl className="detail-list">
            <div><dt>Fecha original</dt><dd>{selected.occurredOn || "No indicada"}</dd></div>
            <div><dt>Ingreso</dt><dd>{selected.incomeDetail || "—"} {selected.incomeAmount ? `· ${selected.incomeAmount}` : ""}</dd></div>
            <div><dt>Egreso</dt><dd>{selected.expenseDetail || "—"} {selected.expenseAmount ? `· ${selected.expenseAmount}` : ""}</dd></div>
            <div><dt>Revisión</dt><dd>{selected.reviewStatus}</dd></div>
          </dl>
          <section><h3>Procedencia por celda</h3>{selected.cells.map((cell) => <article className="detail-item" key={cell.reference}><div className="section-header"><strong className="mono">{selected.sheetName}!{cell.reference}</strong><span>{cell.displayValue || "vacío"}</span></div>{cell.formula ? <p className="small muted mono">Fórmula: {cell.formula}{cell.cachedValue ? ` · caché ${cell.cachedValue}` : ""}</p> : null}{cell.originalDate ? <p className="small muted">Fecha conservada: {cell.originalDate}</p> : null}</article>)}</section>
        </div> : null}
      </DetailDialog>
    </>
  );
}
