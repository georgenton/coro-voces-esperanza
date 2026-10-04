import Link from "next/link";
import { formatUsd } from "@/lib/money";

type DashboardData = {
  grossDueCents: number;
  appliedCents: number;
  pendingCents: number;
  overdueCents: number;
  memberCreditCents: number;
  advanceCents: number;
  unidentifiedCents: number;
  externalIncomeCents: number;
  externalExpenseCents: number;
  pendingCandidates: number;
  accountBalances: Array<{ id: string; name: string; cents: number }>;
  monthlyTrend: Array<{ period: string; incomeCents: number; expenseCents: number }>;
  sectionSummary: Array<{ id: string | null; name: string; memberCount: number; dueCents: number; appliedCents: number; pendingCents: number }>;
};

function annualUrl(period: string, sectionId?: string | null) {
  const params = new URLSearchParams({ year: period.slice(0, 4), cutoff: period });
  if (sectionId) params.set("section", sectionId);
  return `/reportes/cuotas?${params.toString()}`;
}

export function DashboardSummary({
  data,
  period,
  finance,
  memberOnly,
  canFilterSection,
}: {
  data: DashboardData;
  period: string;
  finance: boolean;
  memberOnly: boolean;
  canFilterSection: boolean;
}) {
  const maxTrend = Math.max(1, ...data.monthlyTrend.flatMap((item) => [item.incomeCents, item.expenseCents]));
  const maxSection = Math.max(1, ...data.sectionSummary.map((item) => item.pendingCents));

  return (
    <>
      <section className="grid grid-4" aria-label="Indicadores de obligaciones">
        <article className="card metric-card"><div className="metric-label">Deuda exigible bruta</div><div className="metric-value">{formatUsd(data.grossDueCents)}</div><div className="metric-note">Antes de restar aplicaciones</div></article>
        <article className="card metric-card"><div className="metric-label">Aplicado a cargos</div><div className="metric-value amount-income">{formatUsd(data.appliedCents)}</div><div className="metric-note">Solo pagos confirmados y legados aprobados</div></article>
        <article className="card metric-card"><div className="metric-label">Pendiente</div><div className="metric-value amount-expense">{formatUsd(data.pendingCents)}</div><div className="metric-note">Vencido: {formatUsd(data.overdueCents)}</div><Link className="card-link" href={annualUrl(period)}>Ver matriz al mismo corte →</Link></article>
        <article className="card metric-card"><div className="metric-label">Crédito no aplicado</div><div className="metric-value">{formatUsd(data.memberCreditCents)}</div><div className="metric-note">No reduce otra deuda silenciosamente</div></article>
      </section>

      <section className={`section grid ${finance ? "grid-3" : "grid-2"}`}>
        <article className="card"><h2>Adelantos asignados</h2><div className="metric-value">{formatUsd(data.advanceCents)}</div><p className="muted small">Aplicados a períodos posteriores al corte.</p></article>
        {finance ? <><article className="card"><h2>Importe sin identificar</h2><div className="metric-value">{formatUsd(data.unidentifiedCents)}</div><p className="muted small">Entradas de {period} aún no vinculadas a miembros.</p></article><article className="card"><h2>Revisión operativa</h2><div className="metric-value">{data.pendingCandidates}</div><p className="muted small">Candidatos de conciliación pendientes.</p></article></> : <article className="card"><h2>Vista autorizada</h2><p className="muted">{memberOnly ? "Solo se muestran tus obligaciones y aplicaciones." : "Solo se muestran las personas de tus cuerdas asignadas."}</p></article>}
      </section>

      {finance ? <section className="section grid grid-2">
        <article className="card"><div className="section-header"><div><p className="eyebrow">Flujo confirmado</p><h2>Tendencia de seis meses</h2></div><Link className="card-link" href={`/reportes/movimientos?period=${period}`}>Abrir {period} →</Link></div>
          <div className="trend-chart" aria-label="Ingresos y egresos de los últimos seis meses">{data.monthlyTrend.map((item) => <Link className="trend-group" href={`/reportes/movimientos?period=${item.period}`} key={item.period} title={`Abrir reporte de ${item.period}`}>
            <span className="trend-bars"><span className="trend-bar trend-income" style={{ height: item.incomeCents ? `${Math.max(3, item.incomeCents / maxTrend * 100)}%` : 0 }} aria-label={`Ingresos ${formatUsd(item.incomeCents)}`} /><span className="trend-bar trend-expense" style={{ height: item.expenseCents ? `${Math.max(3, item.expenseCents / maxTrend * 100)}%` : 0 }} aria-label={`Egresos ${formatUsd(item.expenseCents)}`} /></span><small>{item.period.slice(5)}</small>
          </Link>)}</div>
          <div className="chart-legend"><span><i className="legend-income"/> Ingresos</span><span><i className="legend-expense"/> Egresos</span></div>
        </article>
        <article className="card"><p className="eyebrow">Corte {period}</p><h2>Flujo externo del mes</h2><div className="grid grid-2"><div><div className="metric-label">Ingresos</div><div className="metric-value amount-income">{formatUsd(data.externalIncomeCents)}</div></div><div><div className="metric-label">Egresos</div><div className="metric-value amount-expense">{formatUsd(data.externalExpenseCents)}</div></div></div><p className="muted small">Excluye aperturas y transferencias internas del consolidado.</p></article>
      </section> : null}

      <section className="section grid grid-2">
        <article className="card"><p className="eyebrow">Obligaciones autorizadas</p><h2>Pendiente por cuerda</h2>
          <div className="section-bars">{data.sectionSummary.length ? data.sectionSummary.map((section) => {
            const content = <><div className="section-bar-label"><span>{section.name} · {section.memberCount}</span><strong>{formatUsd(section.pendingCents)}</strong></div><span className="section-bar-track"><span style={{ width: `${section.pendingCents / maxSection * 100}%` }} /></span></>;
            return canFilterSection && section.id ? <Link className="section-bar" href={annualUrl(period, section.id)} key={section.id}>{content}</Link> : <div className="section-bar" key={section.id ?? section.name}>{content}</div>;
          }) : <p className="empty compact-empty">No hay personas dentro del alcance autorizado.</p>}</div>
        </article>
        {finance ? <article className="card"><p className="eyebrow">Calculado al corte</p><h2>Saldos por cuenta</h2>{data.accountBalances.length ? data.accountBalances.map((account) => <div className="account-balance" key={account.id}><span>{account.name}</span><strong>{formatUsd(account.cents)}</strong></div>) : <p className="empty compact-empty">Aún no hay cuentas configuradas.</p>}</article> : <article className="card"><p className="eyebrow">Alcance exacto</p><h2>{memberOnly ? "Tu información" : "Tus cuerdas"}</h2><p className="muted">Los enlaces conservan el corte {period}; el servidor vuelve a aplicar tu rol y alcance antes de mostrar cualquier detalle.</p></article>}
      </section>
    </>
  );
}
