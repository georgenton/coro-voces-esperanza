"use client";

import { useState } from "react";
import { DetailDialog } from "@/components/detail-dialog";
import { formatUsd } from "@/lib/money";

export type MonthlyMovementView = {
  id: string;
  occurredOn: string;
  direction: "IN" | "OUT";
  amountCents: number;
  detail: string;
  accountName: string;
  type: string;
  externalReference: string | null;
  source: string;
  reconciliationStatus: string | null;
  paymentParts: Array<{
    id: string;
    memberName: string;
    amountCents: number;
    note: string | null;
    allocations: Array<{ id: string; period: string; conceptName: string; amountCents: number }>;
  }>;
};

const TYPE_LABELS: Record<string, string> = {
  PAYMENT: "Pago",
  EXPENSE: "Gasto",
  INTEREST: "Interés",
  INTERNAL_TRANSFER: "Transferencia interna",
  OPENING_BALANCE: "Saldo de apertura",
  REVERSAL: "Reversión",
};

export function MonthlyLedger({ movements }: { movements: MonthlyMovementView[] }) {
  const [selected, setSelected] = useState<MonthlyMovementView | null>(null);

  function openMovement(movement: MonthlyMovementView) {
    setSelected(movement);
  }

  return (
    <>
      <section className="section table-wrap ledger-table" aria-label="Movimientos del período">
        <table className="sticky-report">
          <thead><tr><th>Fecha</th><th>Ingreso: detalle</th><th className="numeric">Monto ingreso</th><th>Egreso: detalle</th><th className="numeric">Monto egreso</th><th>Cuenta y estado</th></tr></thead>
          <tbody>
            {movements.length ? movements.map((movement) => (
              <tr
                key={movement.id}
                className="interactive-row"
                tabIndex={0}
                aria-label={`Abrir detalle de ${movement.detail}`}
                onClick={() => openMovement(movement)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    openMovement(movement);
                  }
                }}
              >
                <td>{movement.occurredOn}</td>
                <td>{movement.direction === "IN" ? movement.detail : ""}</td>
                <td className="numeric amount-income">{movement.direction === "IN" ? formatUsd(movement.amountCents) : ""}</td>
                <td>{movement.direction === "OUT" ? movement.detail : ""}</td>
                <td className="numeric amount-expense">{movement.direction === "OUT" ? formatUsd(movement.amountCents) : ""}</td>
                <td><strong>{movement.accountName}</strong><br/><span className="small muted">{TYPE_LABELS[movement.type] ?? movement.type} · {movement.reconciliationStatus === "CONFIRMED" ? "✓ Conciliado" : "◌ Sin cierre"}</span></td>
              </tr>
            )) : <tr><td colSpan={6} className="empty">No hay movimientos operativos para este filtro. Un mes sin datos no se presenta como conciliado.</td></tr>}
          </tbody>
        </table>
      </section>

      <DetailDialog
        open={Boolean(selected)}
        title={selected?.detail ?? "Detalle del movimiento"}
        eyebrow={selected ? `${selected.occurredOn} · ${TYPE_LABELS[selected.type] ?? selected.type}` : undefined}
        onClose={() => setSelected(null)}
      >
        {selected ? <div className="detail-stack">
          <dl className="detail-list">
            <div><dt>Monto</dt><dd className={selected.direction === "IN" ? "amount-income" : "amount-expense"}>{selected.direction === "IN" ? "+" : "−"}{formatUsd(selected.amountCents)}</dd></div>
            <div><dt>Cuenta</dt><dd>{selected.accountName}</dd></div>
            <div><dt>Referencia</dt><dd>{selected.externalReference ?? "No registrada"}</dd></div>
            <div><dt>Origen</dt><dd>{selected.source}</dd></div>
            <div><dt>Conciliación</dt><dd>{selected.reconciliationStatus === "CONFIRMED" ? "✓ Confirmada" : "◌ Sin cierre confirmado"}</dd></div>
          </dl>
          <section>
            <h3>Distribución del pago</h3>
            {selected.paymentParts.length ? selected.paymentParts.map((part) => <article className="detail-item" key={part.id}>
              <div className="section-header"><strong>{part.memberName}</strong><strong>{formatUsd(part.amountCents)}</strong></div>
              {part.note ? <p className="small muted">{part.note}</p> : null}
              {part.allocations.length ? <ul className="plain-list">{part.allocations.map((allocation) => <li key={allocation.id}><span>{allocation.conceptName} · {allocation.period}</span><strong>{formatUsd(allocation.amountCents)}</strong></li>)}</ul> : <p className="small muted">Sin aplicaciones a cargos.</p>}
            </article>) : <p className="empty compact-empty">Este movimiento no tiene distribuciones a miembros.</p>}
          </section>
        </div> : null}
      </DetailDialog>
    </>
  );
}
