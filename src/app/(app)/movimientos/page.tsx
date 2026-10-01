import { randomUUID } from "node:crypto";
import { AppRole, MovementDirection, MovementStatus, MovementType } from "@/generated/prisma/client";
import { Notice } from "@/components/notice";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireAccess } from "@/lib/access";
import { formatLocalDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/money";
import { PaymentComposer } from "./payment-composer";
import { ExistingAllocationComposer } from "./existing-allocation-composer";
import { registerExpenseAction, registerInterestAction, registerTransferAction } from "./actions";

export default async function MovementsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  const params = await searchParams;
  const [accounts, members, movements, activities] = await Promise.all([
    prisma.financialAccount.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.member.findMany({
      where: { status: { not: "RETIRED" } },
      include: { charges: { where: { status: { in: ["PENDING", "PARTIAL"] } }, include: { concept: true, allocations: true, adjustments: true }, orderBy: { period: "asc" } } },
      orderBy: { displayName: "asc" },
    }),
    prisma.moneyMovement.findMany({ include: { account: true, paymentParts: true }, orderBy: { recordedAt: "desc" }, take: 80 }),
    prisma.activity.findMany({ where: { status: { in: ["DRAFT", "OPEN"] } }, orderBy: { name: "asc" } }),
  ]);
  const options = members.map((member) => ({ id: member.id, name: member.displayName, charges: member.charges.map((charge) => {
    const due = charge.amountCents + charge.adjustments.reduce((sum, item) => sum + item.amountCents, 0);
    const applied = charge.allocations.reduce((sum, item) => sum + item.amountCents, 0);
    return { id: charge.id, label: `${charge.period} · ${charge.concept.name}`, outstanding: formatUsd(Math.max(0, due - applied)) };
  }) }));
  const unmatchedMovements = movements.flatMap((movement) => {
    if (movement.type !== MovementType.PAYMENT || movement.direction !== MovementDirection.IN || movement.status !== MovementStatus.CONFIRMED) return [];
    const identified = movement.paymentParts.reduce((sum, part) => sum + part.amountCents, 0);
    const remaining = movement.amountCents - identified;
    if (remaining <= 0) return [];
    return [{ id: movement.id, label: `${formatLocalDateTime(movement.occurredAt ?? movement.recordedAt)} · ${formatUsd(remaining)} pendiente · ${movement.description ?? "sin descripción"}` }];
  });
  return (
    <div className="page">
      <header className="page-header"><div><p className="eyebrow">Caja por fecha real</p><h1>Movimientos</h1><p className="lede">Registrar dinero no equivale a generar un cargo. La fecha bancaria puede quedar pendiente.</p></div></header>
      <Notice success={params.success} error={params.error} />
      {!accounts.length ? <Notice warning="Crea al menos una cuenta financiera antes de registrar movimientos." /> : null}
      <section className="grid grid-2">
        <article className="card"><h2>Registrar pago</h2><PaymentComposer accounts={accounts.map(({ id, name }) => ({ id, name }))} members={options} /></article>
        <div className="grid">
          <article className="card"><h2>Registrar gasto</h2><form action={registerExpenseAction} className="form-grid"><input type="hidden" name="idempotencyKey" value={randomUUID()} /><div className="field"><label>Cuenta</label><select name="accountId" required><option value="">Seleccionar</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div><div className="field"><label>Importe USD</label><input name="amount" inputMode="decimal" required /></div><div className="field"><label>Fecha real</label><input name="occurredOn" type="date" /></div><div className="field"><label>Referencia</label><input name="externalReference" /></div><div className="field"><label>Actividad, si corresponde</label><select name="activityId"><option value="">Gasto general</option>{activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</select></div><div className="field field-full"><label>Descripción</label><input name="description" required minLength={3} /></div><SubmitButton>Registrar gasto</SubmitButton></form></article>
          <article className="card"><h2>Mover entre cuentas</h2><form action={registerTransferAction} className="form-grid"><input type="hidden" name="idempotencyKey" value={randomUUID()} /><div className="field"><label>Desde</label><select name="fromAccountId" required><option value="">Seleccionar</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div><div className="field"><label>Hacia</label><select name="toAccountId" required><option value="">Seleccionar</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div><div className="field"><label>Importe USD</label><input name="amount" inputMode="decimal" required /></div><div className="field"><label>Fecha real</label><input name="occurredOn" type="date" /></div><div className="field field-full"><label>Nota</label><input name="description" /></div><SubmitButton>Registrar transferencia</SubmitButton></form><p className="muted small">Se crean salida y entrada enlazadas; no afectan el flujo consolidado.</p></article>
          <article className="card"><h2>Registrar interés</h2><form action={registerInterestAction} className="form-grid"><input type="hidden" name="idempotencyKey" value={randomUUID()} /><div className="field"><label>Cuenta de ahorro</label><select name="accountId" required><option value="">Seleccionar</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div><div className="field"><label>Importe USD</label><input name="amount" inputMode="decimal" required /></div><div className="field"><label>Fecha bancaria</label><input name="occurredOn" type="date" /></div><div className="field field-full"><label>Descripción</label><input name="description" placeholder="Interés acreditado" /></div><SubmitButton>Registrar interés</SubmitButton></form></article>
        </div>
      </section>
      {unmatchedMovements.length ? <section className="section card"><h2>Distribuir una entrada existente</h2><p className="muted small">Para depósitos confirmados desde conciliación: asigna sin registrar otra entrada.</p><ExistingAllocationComposer movements={unmatchedMovements} members={options}/></section> : null}
      <section className="section table-wrap">{movements.length ? <table><thead><tr><th>Fecha</th><th>Cuenta</th><th>Tipo</th><th>Descripción</th><th className="numeric">Importe</th><th>Estado</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{formatLocalDateTime(movement.occurredAt ?? movement.recordedAt)}{!movement.occurredAt ? <><br/><span className="pill pill-warning">Fecha bancaria pendiente</span></> : null}</td><td>{movement.account.name}</td><td>{movement.type}</td><td>{movement.description ?? "Sin descripción"}<br/><span className="muted small">{movement.paymentParts.length} parte(s)</span></td><td className="numeric">{movement.direction === MovementDirection.OUT ? "−" : "+"}{formatUsd(movement.amountCents)}</td><td><StatusPill value={movement.status} /></td></tr>)}</tbody></table> : <p className="empty">No hay movimientos. No se presume un saldo inicial.</p>}</section>
    </div>
  );
}
