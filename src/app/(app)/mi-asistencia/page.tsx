import { redirect } from "next/navigation";
import { StatusPill } from "@/components/status-pill";
import { requireAccess } from "@/lib/access";
import { formatLocalDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";

export default async function MyAttendancePage() {
  const access = await requireAccess();
  if (!access.memberId) redirect("/sin-acceso");
  const [records, invitationCount] = await Promise.all([
    prisma.attendance.findMany({ where: { memberId: access.memberId, rehearsal: { status: { in: ["CLOSED", "OPEN"] } } }, include: { rehearsal: true }, orderBy: { rehearsal: { startsAt: "desc" } } }),
    prisma.rehearsalInvitee.count({ where: { memberId: access.memberId, rehearsal: { status: "CLOSED" } } }),
  ]);
  const counted = records.filter(({ rehearsal, status }) => rehearsal.status === "CLOSED" && !["CANCELLED", "NOT_SUMMONED"].includes(status));
  const attended = counted.filter(({ status }) => ["PRESENT", "LATE"].includes(status)).length;
  const rate = invitationCount ? Math.round((attended / invitationCount) * 100) : null;
  return <div className="page"><header className="page-header"><div><p className="eyebrow">Consulta individual</p><h1>Mi asistencia</h1><p className="lede">Solo cuentan ensayos cerrados en los que constabas en la convocatoria. Los cancelados se excluyen.</p></div></header><section className="grid grid-2"><article className="card"><div className="metric-label">Ensayos cerrados convocados</div><div className="metric-value">{invitationCount}</div></article><article className="card"><div className="metric-label">Tasa de presencia y tardanza</div><div className="metric-value">{rate == null ? "Pendiente" : `${rate}%`}</div></article></section><section className="section table-wrap">{records.length ? <table><thead><tr><th>Ensayo</th><th>Fecha</th><th>Estado</th><th>Registro</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{record.rehearsal.title}</td><td>{formatLocalDateTime(record.rehearsal.startsAt)}</td><td><StatusPill value={record.status}/></td><td>{formatLocalDateTime(record.checkedInAt)}</td></tr>)}</tbody></table> : <p className="empty">No hay asistencias registradas.</p>}</section></div>;
}
