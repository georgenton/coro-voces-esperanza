import { AppRole } from "@/generated/prisma/client";
import { Notice } from "@/components/notice";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { isFinanceRole, isGlobalReadRole, requireAccess } from "@/lib/access";
import { formatLocalDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/money";
import { generateChargesAction } from "./actions";

function defaultPeriod() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "America/Guayaquil" }).format(new Date()).slice(0, 7);
}

export default async function ChargesPage({ searchParams }: { searchParams: Promise<{ period?: string; success?: string; error?: string }> }) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA, AppRole.DIRECTORA, AppRole.JEFE_DE_CUERDA]);
  const params = await searchParams;
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.period ?? "") ? params.period! : defaultPeriod();
  const memberWhere = isGlobalReadRole(access) ? {} : { currentSectionId: { in: access.sectionIds } };
  const [charges, rules] = await Promise.all([
    prisma.charge.findMany({
      where: { period, member: memberWhere },
      include: { member: { include: { currentSection: true } }, concept: true, allocations: true, adjustments: true },
      orderBy: [{ member: { displayName: "asc" } }, { concept: { name: "asc" } }],
    }),
    prisma.chargeRule.findMany({ where: { active: true }, include: { concept: true }, orderBy: { startsPeriod: "asc" } }),
  ]);
  return (
    <div className="page">
      <header className="page-header">
        <div><p className="eyebrow">Obligaciones por período</p><h1>Cuotas</h1><p className="lede">Enero se excluye cuando la regla lo indica; junio de 2026 es una excepción fechada, no anual.</p></div>
        <div className="actions">
          <form className="actions"><label htmlFor="period-filter">Período</label><input id="period-filter" name="period" type="month" defaultValue={period} /><button className="button button-secondary">Ver</button></form>
          <a className="button button-secondary" href={`/api/export/charges?period=${period}`}>Exportar CSV</a>
        </div>
      </header>
      <Notice success={params.success} error={params.error} />
      {isFinanceRole(access) ? (
        <section className="card">
          <div className="section-header"><div><h2>Generación idempotente</h2><p className="muted small">Puede ejecutarse otra vez: la clave única impide duplicar el mismo cargo.</p></div>
            <form action={generateChargesAction} className="actions"><input type="hidden" name="period" value={period} /><SubmitButton pendingText="Generando…">Generar {period}</SubmitButton></form>
          </div>
          <p className="small muted">Reglas activas: {rules.length ? rules.map((rule) => `${rule.concept.name} ${formatUsd(rule.amountCents)}`).join(" · ") : "ninguna; configura conceptos antes de generar"}.</p>
        </section>
      ) : null}
      <section className="section table-wrap">
        {charges.length ? <table><thead><tr><th>Miembro</th><th>Cuerda</th><th>Concepto</th><th>Vencimiento</th><th className="numeric">Cargo</th><th className="numeric">Aplicado</th><th className="numeric">Saldo</th><th>Estado</th></tr></thead><tbody>
          {charges.map((charge) => {
            const amount = charge.amountCents + charge.adjustments.reduce((sum, item) => sum + item.amountCents, 0);
            const applied = charge.allocations.reduce((sum, item) => sum + item.amountCents, 0);
            return <tr key={charge.id}><td>{charge.member.displayName}</td><td>{charge.member.currentSection?.name ?? "Pendiente"}</td><td>{charge.concept.name}</td><td>{formatLocalDate(charge.dueOn)}</td><td className="numeric">{formatUsd(amount)}</td><td className="numeric">{formatUsd(applied)}</td><td className="numeric">{formatUsd(Math.max(0, amount - applied))}</td><td><StatusPill value={charge.status} /></td></tr>;
          })}
        </tbody></table> : <p className="empty">No hay cargos para este período. Si la vigencia está sin confirmar, el caso debe quedar en revisión, no como deuda.</p>}
      </section>
    </div>
  );
}
