import Link from "next/link";
import { AlertTriangle, Database, FileSpreadsheet, Rows3 } from "lucide-react";
import { formatUsd } from "@/lib/money";

type HistoricalDashboardData = {
  period: string;
  candidateRows: number;
  matrixRows: number;
  pendingIssues: number;
  periodSummary: { incomeCents: number; expenseCents: number; rows: number; status: string };
  monthlyTrend: Array<{ period: string; incomeCents: number; expenseCents: number; rows: number; status: string }>;
  batch: {
    id: string;
    sha256: string;
    declaredCutoff: Date | null;
    cutoffTimezone: string | null;
    _count: { rows: number; sourceCells: number; issues: number };
  };
};

export function HistoricalDashboardSummary({ data }: { data: HistoricalDashboardData }) {
  const maxTrend = Math.max(1, ...data.monthlyTrend.flatMap((item) => [item.incomeCents, item.expenseCents]));
  return (
    <>
      <section className="grid grid-4" aria-label="Cobertura de la fuente histórica">
        <article className="card metric-card"><div className="metric-icon"><Database aria-hidden="true" size={18}/></div><div className="metric-label">Filas preservadas</div><div className="metric-value">{data.batch._count.rows}</div><div className="metric-note">Staging inmutable; no son operaciones</div></article>
        <article className="card metric-card"><div className="metric-icon"><FileSpreadsheet aria-hidden="true" size={18}/></div><div className="metric-label">Celdas con evidencia</div><div className="metric-value">{data.batch._count.sourceCells}</div><div className="metric-note">Literal, fórmula, caché y procedencia</div></article>
        <article className="card metric-card"><div className="metric-icon"><Rows3 aria-hidden="true" size={18}/></div><div className="metric-label">Filas mensuales candidatas</div><div className="metric-value">{data.candidateRows}</div><div className="metric-note">Sin promover como movimiento</div></article>
        <article className="card metric-card"><div className="metric-icon metric-icon-warning"><AlertTriangle aria-hidden="true" size={18}/></div><div className="metric-label">Incidencias pendientes</div><div className="metric-value">{data.pendingIssues}</div><div className="metric-note">Exigen decisión administrativa</div><Link className="card-link" href={`/reportes/historico?batch=${data.batch.id}`}>Abrir bandeja →</Link></article>
      </section>

      <section className="section grid grid-2">
        <article className="card"><div className="section-header"><div><p className="eyebrow">Datos documentados · no conciliados</p><h2>Tendencia de seis meses</h2></div><Link className="card-link" href={`/reportes/movimientos?period=${data.period}&source=historical`}>Abrir {data.period} →</Link></div>
          <div className="trend-chart" aria-label="Importes documentados en hojas mensuales">{data.monthlyTrend.map((item) => <Link className="trend-group" href={`/reportes/movimientos?period=${item.period}&source=historical`} key={item.period} title={`Abrir fuente de ${item.period}`}><span className="trend-bars"><span className="trend-bar trend-income source-bar" style={{ height: item.incomeCents ? `${Math.max(3, item.incomeCents / maxTrend * 100)}%` : 0 }} aria-label={`Ingresos documentados ${formatUsd(item.incomeCents)}`}/><span className="trend-bar trend-expense source-bar" style={{ height: item.expenseCents ? `${Math.max(3, item.expenseCents / maxTrend * 100)}%` : 0 }} aria-label={`Egresos documentados ${formatUsd(item.expenseCents)}`}/></span><small>{item.period.slice(5)}</small></Link>)}</div>
          <div className="chart-legend"><span><i className="legend-income"/> Ingresos fuente</span><span><i className="legend-expense"/> Egresos fuente</span></div>
        </article>
        <article className="card"><p className="eyebrow">Hoja {data.period}</p><h2>Lectura del período</h2><div className="grid grid-2"><div><div className="metric-label">Ingresos documentados</div><div className="metric-value amount-income">{formatUsd(data.periodSummary.incomeCents)}</div></div><div><div className="metric-label">Egresos documentados</div><div className="metric-value amount-expense">{formatUsd(data.periodSummary.expenseCents)}</div></div></div><p className="muted small">{data.periodSummary.rows} fila(s) candidatas. Totales calculados solo desde columnas C y E; excluyen aperturas y agregados. No equivalen a saldo bancario ni cierre conciliado.</p></article>
      </section>

      <section className="section grid grid-2">
        <article className="card"><p className="eyebrow">Matriz histórica</p><h2>Personas documentadas</h2><div className="metric-value">{data.matrixRows}</div><p className="muted small">Filas conservadas entre las matrices de 2025 y 2026; pueden repetir personas entre años y no constituyen identidades operativas.</p><Link className="card-link" href={`/reportes/cuotas?year=${data.period.slice(0, 4)}&source=historical`}>Ver matriz fuente →</Link></article>
        <article className="card"><p className="eyebrow">Separación contable</p><h2>Qué no hace esta vista</h2><ul className="source-rules"><li>No convierte una X, un vacío o un color en estado de cuota.</li><li>No usa saldos de apertura como ingresos del mes.</li><li>No duplica pagos entre matriz, hojas mensuales e informes.</li><li>No asigna identidades ni fechas sin revisión.</li></ul></article>
      </section>
    </>
  );
}
