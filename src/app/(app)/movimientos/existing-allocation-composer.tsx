"use client";

import { useMemo, useState } from "react";
import { allocateExistingPaymentAction } from "./actions";

type ChargeOption = { id: string; label: string; outstanding: string };
type MemberOption = { id: string; name: string; charges: ChargeOption[] };

export function ExistingAllocationComposer({
  movements,
  members,
}: {
  movements: Array<{ id: string; label: string }>;
  members: MemberOption[];
}) {
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [allocations, setAllocations] = useState<Array<{ chargeId: string; amount: string }>>([]);
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const member = members.find((item) => item.id === memberId);
  const plan = [{ memberId, amount, note, allocations }];

  return <form action={allocateExistingPaymentAction} className="grid">
    <input type="hidden" name="idempotencyKey" value={idempotencyKey}/>
    <input type="hidden" name="plan" value={JSON.stringify(plan)}/>
    <div className="form-grid">
      <div className="field"><label>Entrada por distribuir</label><select name="movementId" required><option value="">Seleccionar</option>{movements.map((movement) => <option key={movement.id} value={movement.id}>{movement.label}</option>)}</select></div>
      <div className="field"><label>Miembro</label><select value={memberId} onChange={(event) => { setMemberId(event.target.value); setAllocations([]); }} required><option value="">Seleccionar</option>{members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="field"><label>Importe identificado USD</label><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required/></div>
      <div className="field"><label>Nota opcional</label><input value={note} onChange={(event) => setNote(event.target.value)}/></div>
    </div>
    <div className="section-header"><strong className="small">Aplicaciones a cargos</strong><button type="button" className="button button-secondary button-small" disabled={!member?.charges.length} onClick={() => setAllocations((items) => [...items, { chargeId: "", amount: "" }])}>Añadir aplicación</button></div>
    {allocations.map((allocation, index) => <div className="form-grid" key={index}>
      <div className="field"><label>Cargo</label><select value={allocation.chargeId} onChange={(event) => setAllocations((items) => items.map((item, position) => position === index ? { ...item, chargeId: event.target.value } : item))} required><option value="">Seleccionar</option>{member?.charges.map((charge) => <option key={charge.id} value={charge.id}>{charge.label} · saldo {charge.outstanding}</option>)}</select></div>
      <div className="field"><label>Aplicar USD</label><input value={allocation.amount} onChange={(event) => setAllocations((items) => items.map((item, position) => position === index ? { ...item, amount: event.target.value } : item))} inputMode="decimal" required/></div>
    </div>)}
    <p className="small muted">Puede identificar una parte y dejar el resto visible. No se crea un segundo movimiento de caja.</p>
    <button className="button" type="submit">Guardar distribución</button>
  </form>;
}
