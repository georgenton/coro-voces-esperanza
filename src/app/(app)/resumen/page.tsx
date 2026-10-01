import { AppRole } from "@/generated/prisma/client";
import { Notice } from "@/components/notice";
import { formatUsd } from "@/lib/money";
import { requireAccess, isFinanceRole } from "@/lib/access";
import { getDashboard } from "@/server/finance/dashboard";

function currentPeriod() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "America/Guayaquil",
  }).format(new Date()).slice(0, 7);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; success?: string; error?: string }>;
}) {
  const access = await requireAccess();
  const params = await searchParams;
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.period ?? "") ? params.period! : currentPeriod();
  const data = await getDashboard(access, period);
  const finance = isFinanceRole(access);
  const memberOnly = access.roles.length === 1 && access.roles.includes(AppRole.MIEMBRO);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Corte {period}</p>
          <h1>{memberOnly ? "Mi cuenta" : "Resumen del coro"}</h1>
          <p className="lede">Los cargos, aplicaciones y movimientos se calculan por separado. Un pendiente de importación nunca se muestra como saldo cero validado.</p>
        </div>
        <form className="actions">
          <label htmlFor="period">Período de corte</label>
          <input id="period" name="period" type="month" defaultValue={period} />
          <button className="button button-secondary">Aplicar</button>
        </form>
      </header>
      <Notice success={params.success} error={params.error} />
      {finance && data.pendingImports ? <Notice warning={`${data.pendingImports} importación(es) requieren revisión. Los saldos derivados del Excel siguen pendientes de validar.`} /> : null}

      <section className="grid grid-4" aria-label="Indicadores de obligaciones">
        <article className="card"><div className="metric-label">Deuda exigible bruta</div><div className="metric-value">{formatUsd(data.grossDueCents)}</div><div className="metric-note">Antes de restar aplicaciones</div></article>
        <article className="card"><div className="metric-label">Aplicado a cargos</div><div className="metric-value">{formatUsd(data.appliedCents)}</div><div className="metric-note">Solo pagos confirmados y legados aprobados</div></article>
        <article className="card"><div className="metric-label">Pendiente</div><div className="metric-value">{formatUsd(data.pendingCents)}</div><div className="metric-note">Vencido: {formatUsd(data.overdueCents)}</div></article>
        <article className="card"><div className="metric-label">Crédito no aplicado</div><div className="metric-value">{formatUsd(data.memberCreditCents)}</div><div className="metric-note">No reduce otra deuda silenciosamente</div></article>
      </section>

      <section className={`section grid ${finance ? "grid-3" : ""}`}>
        <article className="card"><h2>Adelantos asignados</h2><div className="metric-value">{formatUsd(data.advanceCents)}</div><p className="muted small">Aplicados a períodos posteriores al corte.</p></article>
        {finance ? <><article className="card"><h2>Importe sin identificar</h2><div className="metric-value">{formatUsd(data.unidentifiedCents)}</div><p className="muted small">Entradas confirmadas aún no vinculadas a miembros.</p></article>
        <article className="card"><h2>Revisión operativa</h2><div className="metric-value">{data.pendingCandidates}</div><p className="muted small">Candidatos de conciliación pendientes.</p></article></> : null}
      </section>

      {finance ? (
        <section className="section grid grid-2">
          <article className="card">
            <h2>Flujo externo confirmado</h2>
            <div className="grid grid-2">
              <div><div className="metric-label">Ingresos</div><div className="metric-value">{formatUsd(data.externalIncomeCents)}</div></div>
              <div><div className="metric-label">Egresos</div><div className="metric-value">{formatUsd(data.externalExpenseCents)}</div></div>
            </div>
            <p className="muted small">Excluye aperturas y transferencias internas del consolidado.</p>
          </article>
          <article className="card">
            <h2>Saldos calculados por cuenta</h2>
            {data.accountBalances.length ? data.accountBalances.map((account) => (
              <div className="section-header" key={account.id}><span>{account.name}</span><strong>{formatUsd(account.cents)}</strong></div>
            )) : <p className="empty">Aún no hay cuentas configuradas.</p>}
          </article>
        </section>
      ) : null}
    </div>
  );
}
