import { StatusPill } from "@/components/status-pill";
import { formatLocalDate } from "@/lib/dates";
import { formatUsd } from "@/lib/money";

type MemberAccountProps = {
  member: {
    displayName: string;
    originalName: string | null;
    status: string;
    joinedOn: Date | null;
    leftOn: Date | null;
    currentSection: { name: string } | null;
    sectionAssignments: Array<{ id: string; startsOn: Date; endsOn: Date | null; section: { name: string } }>;
    charges: Array<{
      id: string;
      period: string;
      amountCents: number;
      status: string;
      dueOn: Date | null;
      concept: { name: string };
      allocations: Array<{ amountCents: number }>;
      adjustments: Array<{ amountCents: number }>;
    }>;
    incidents: Array<{ id: string; type: string; status: string; economicPeriod: string | null; publicNote: string | null }>;
  };
};

export function MemberAccount({ member }: MemberAccountProps) {
  const totalDue = member.charges.reduce((sum, charge) => sum + charge.amountCents + charge.adjustments.reduce((value, item) => value + item.amountCents, 0), 0);
  const totalApplied = member.charges.reduce((sum, charge) => sum + charge.allocations.reduce((value, item) => value + item.amountCents, 0), 0);
  const year = String(new Date().getUTCFullYear());
  const currentYearDue = member.charges.filter(({ period }) => period.startsWith(year)).reduce((sum, charge) => sum + charge.amountCents + charge.adjustments.reduce((value, item) => value + item.amountCents, 0) - charge.allocations.reduce((value, item) => value + item.amountCents, 0), 0);
  return (
    <>
      <section className="grid grid-3">
        <article className="card"><div className="metric-label">Saldo acumulado</div><div className="metric-value">{formatUsd(Math.max(0, totalDue - totalApplied))}</div><div className="metric-note">{totalDue - totalApplied === 0 ? "Sin deuda acumulada" : "Con saldo pendiente"}</div></article>
        <article className="card"><div className="metric-label">Estado del año</div><div className="metric-value">{currentYearDue <= 0 ? "Al día" : formatUsd(currentYearDue)}</div><div className="metric-note">Métrica independiente de deuda anterior</div></article>
        <article className="card"><div className="metric-label">Ficha</div><div className="metric-value"><StatusPill value={member.status} /></div><div className="metric-note">{member.currentSection?.name ?? "Cuerda pendiente"}</div></article>
      </section>
      <section className="section table-wrap">
        {member.charges.length ? <table><thead><tr><th>Período</th><th>Concepto</th><th>Vencimiento</th><th className="numeric">Cargo</th><th className="numeric">Aplicado</th><th className="numeric">Saldo</th><th>Estado</th></tr></thead><tbody>
          {member.charges.map((charge) => {
            const due = charge.amountCents + charge.adjustments.reduce((sum, item) => sum + item.amountCents, 0);
            const applied = charge.allocations.reduce((sum, item) => sum + item.amountCents, 0);
            return <tr key={charge.id}><td>{charge.period}</td><td>{charge.concept.name}</td><td>{formatLocalDate(charge.dueOn)}</td><td className="numeric">{formatUsd(due)}</td><td className="numeric">{formatUsd(applied)}</td><td className="numeric">{formatUsd(Math.max(0, due - applied))}</td><td><StatusPill value={charge.status} /></td></tr>;
          })}
        </tbody></table> : <p className="empty">No hay cargos publicados. Esto no significa saldo validado si existe una importación pendiente.</p>}
      </section>
      <section className="section grid grid-2">
        <article className="card"><h2>Historia de cuerdas</h2>{member.sectionAssignments.length ? member.sectionAssignments.map((assignment) => <p key={assignment.id}><strong>{assignment.section.name}</strong><br/><span className="muted small">Desde {formatLocalDate(assignment.startsOn)} · {assignment.endsOn ? `hasta ${formatLocalDate(assignment.endsOn)}` : "vigente"}</span></p>) : <p className="empty">Sin vigencias confirmadas.</p>}</article>
        <article className="card"><h2>Incidencias</h2>{member.incidents.length ? member.incidents.map((incident) => <p key={incident.id}><StatusPill value={incident.status} /> <strong>{incident.type}</strong><br/><span className="muted small">{incident.economicPeriod ?? "Efecto económico pendiente"}{incident.publicNote ? ` · ${incident.publicNote}` : ""}</span></p>) : <p className="empty">Sin incidencias registradas.</p>}</article>
      </section>
      {member.originalName && member.originalName !== member.displayName ? <p className="muted small">Nombre original de la fuente: {member.originalName}</p> : null}
    </>
  );
}
