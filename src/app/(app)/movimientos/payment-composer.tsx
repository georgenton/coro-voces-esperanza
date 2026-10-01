"use client";

import { useMemo, useState } from "react";
import { registerPaymentAction } from "./actions";

type ChargeOption = { id: string; label: string; outstanding: string };
type MemberOption = { id: string; name: string; charges: ChargeOption[] };
type DraftAllocation = { chargeId: string; amount: string };
type DraftPart = { memberId: string; amount: string; note: string; allocations: DraftAllocation[] };

const blankPart = (): DraftPart => ({ memberId: "", amount: "", note: "", allocations: [] });

export function PaymentComposer({ accounts, members }: { accounts: Array<{ id: string; name: string }>; members: MemberOption[] }) {
  const [parts, setParts] = useState<DraftPart[]>([blankPart()]);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const updatePart = (index: number, patch: Partial<DraftPart>) => setParts((current) => current.map((part, position) => position === index ? { ...part, ...patch } : part));

  return (
    <form action={registerPaymentAction} className="grid">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="plan" value={JSON.stringify(parts)} />
      <div className="form-grid">
        <div className="field"><label htmlFor="payment-account">Cuenta receptora</label><select id="payment-account" name="accountId" required><option value="">Seleccionar</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div>
        <div className="field"><label htmlFor="payment-amount">Importe total USD</label><input id="payment-amount" name="amount" inputMode="decimal" placeholder="12.00" required /></div>
        <div className="field"><label htmlFor="payment-date">Fecha bancaria, si está confirmada</label><input id="payment-date" name="occurredOn" type="date" /></div>
        <div className="field"><label htmlFor="payment-ref">Referencia bancaria</label><input id="payment-ref" name="externalReference" /></div>
        <div className="field field-full"><label htmlFor="payment-description">Descripción</label><input id="payment-description" name="description" placeholder="Origen o nota, sin inventar destino" /></div>
      </div>
      <div className="divider" />
      <div className="section-header"><h3>Partes por miembro</h3><button className="button button-secondary button-small" type="button" onClick={() => setParts((current) => [...current, blankPart()])}>Añadir miembro</button></div>
      {parts.map((part, partIndex) => {
        const selected = members.find((member) => member.id === part.memberId);
        return (
          <fieldset className="card" key={partIndex}>
            <legend className="small"><strong>Parte {partIndex + 1}</strong></legend>
            <div className="form-grid">
              <div className="field"><label>Miembro</label><select value={part.memberId} onChange={(event) => updatePart(partIndex, { memberId: event.target.value, allocations: [] })} required><option value="">Seleccionar</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
              <div className="field"><label>Importe asignado USD</label><input value={part.amount} onChange={(event) => updatePart(partIndex, { amount: event.target.value })} inputMode="decimal" placeholder="5.00" required /></div>
              <div className="field field-full"><label>Nota opcional</label><input value={part.note} onChange={(event) => updatePart(partIndex, { note: event.target.value })} /></div>
            </div>
            <div className="section-header section"><span className="small"><strong>Aplicaciones a cargos</strong></span><button type="button" className="button button-secondary button-small" disabled={!selected?.charges.length} onClick={() => updatePart(partIndex, { allocations: [...part.allocations, { chargeId: "", amount: "" }] })}>Añadir aplicación</button></div>
            {part.allocations.map((allocation, allocationIndex) => (
              <div className="form-grid" key={allocationIndex}>
                <div className="field"><label>Cargo</label><select value={allocation.chargeId} onChange={(event) => updatePart(partIndex, { allocations: part.allocations.map((item, index) => index === allocationIndex ? { ...item, chargeId: event.target.value } : item) })} required><option value="">Seleccionar</option>{selected?.charges.map((charge) => <option key={charge.id} value={charge.id}>{charge.label} · saldo {charge.outstanding}</option>)}</select></div>
                <div className="field"><label>Aplicar USD</label><input value={allocation.amount} onChange={(event) => updatePart(partIndex, { allocations: part.allocations.map((item, index) => index === allocationIndex ? { ...item, amount: event.target.value } : item) })} inputMode="decimal" required /></div>
              </div>
            ))}
            {parts.length > 1 ? <button type="button" className="button button-secondary button-small" onClick={() => setParts((current) => current.filter((_, index) => index !== partIndex))}>Quitar parte</button> : null}
          </fieldset>
        );
      })}
      <p className="muted small">La suma de partes no puede exceder el depósito. Lo no aplicado queda como crédito del miembro; lo no identificado permanece visible.</p>
      <button className="button" type="submit">Confirmar pago y distribución</button>
    </form>
  );
}
