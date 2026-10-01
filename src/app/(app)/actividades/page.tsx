import { AppRole } from "@/generated/prisma/client";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { isFinanceRole, requireAccess } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/money";
import { createActivityAction, enrollParticipantAction } from "./actions";

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA, AppRole.DIRECTORA, AppRole.JEFE_DE_CUERDA]);
  const params = await searchParams;
  const [activities, members] = await Promise.all([
    prisma.activity.findMany({ include: { participants: true, charges: { include: { allocations: true } }, expenses: true }, orderBy: { createdAt: "desc" } }),
    prisma.member.findMany({ where: { status: "ACTIVE" }, orderBy: { displayName: "asc" } }),
  ]);
  return <div className="page"><header className="page-header"><div><p className="eyebrow">Cobros extraordinarios</p><h1>Actividades</h1><p className="lede">Solo se cobra a participantes inscritos. La financiación interna no se duplica como ingreso externo.</p></div></header><Notice success={params.success} error={params.error}/>
    {isFinanceRole(access) ? <section className="card"><h2>Nueva actividad</h2><form action={createActivityAction} className="form-grid"><div className="field"><label>Nombre</label><input name="name" required minLength={3}/></div><div className="field"><label>Importe por participante USD, si aplica</label><input name="participantAmount" inputMode="decimal"/></div><div className="field field-full"><label>Descripción</label><textarea name="description"/></div><SubmitButton>Crear actividad</SubmitButton></form></section> : null}
    <section className="section grid grid-2">{activities.length ? activities.map((activity) => {
      const charged = activity.charges.reduce((sum, charge) => sum + charge.amountCents, 0);
      const applied = activity.charges.reduce((sum, charge) => sum + charge.allocations.reduce((value, allocation) => value + allocation.amountCents, 0), 0);
      const expenses = activity.expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
      return <article className="card" key={activity.id}><h2>{activity.name}</h2><p className="muted small">{activity.description ?? "Sin descripción"}</p><div className="grid grid-3"><div><span className="metric-label">Participantes</span><div className="metric-value">{activity.participants.length}</div></div><div><span className="metric-label">Aplicado</span><div className="metric-value">{formatUsd(applied)}</div></div><div><span className="metric-label">Resultado</span><div className="metric-value">{formatUsd(Math.max(0, applied - expenses))}</div></div></div><p className="small muted">Cargado {formatUsd(charged)} · gastos enlazados {formatUsd(expenses)}.</p>{isFinanceRole(access) ? <form action={enrollParticipantAction} className="form-grid"><input type="hidden" name="activityId" value={activity.id}/><div className="field"><label>Inscribir miembro</label><select name="memberId" required><option value="">Seleccionar</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></div><div className="field"><label>Período del cargo</label><input name="period" type="month"/></div><label className="field-full"><input name="createCharge" type="checkbox" style={{width:"auto",minHeight:"auto"}}/> Crear cargo explícito por {activity.participantAmountCents ? formatUsd(activity.participantAmountCents) : "importe pendiente"}</label><SubmitButton>Inscribir</SubmitButton></form> : null}</article>;
    }) : <article className="card empty">No hay actividades registradas.</article>}</section>
  </div>;
}
