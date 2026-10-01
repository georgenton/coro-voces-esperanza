import { AppRole } from "@/generated/prisma/client";
import { Notice } from "@/components/notice";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { isFinanceRole, isGlobalReadRole, requireAccess } from "@/lib/access";
import { formatLocalDate, formatLocalDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/money";
import { approveIncidentAction, proposeIncidentAction } from "./actions";

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA, AppRole.DIRECTORA, AppRole.JEFE_DE_CUERDA]);
  const params = await searchParams;
  const memberWhere = isGlobalReadRole(access) ? {} : { currentSectionId: { in: access.sectionIds } };
  const [members, sections, incidents] = await Promise.all([
    prisma.member.findMany({ where: memberWhere, orderBy: { displayName: "asc" } }),
    prisma.voiceSection.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.membershipIncident.findMany({ where: { member: memberWhere }, include: { member: true, author: { select: { name: true } } }, orderBy: { recordedAt: "desc" }, take: 100 }),
  ]);
  return <div className="page"><header className="page-header"><div><p className="eyebrow">Cambios con vigencia</p><h1>Incidencias</h1><p className="lede">Una incidencia retroactiva muestra su efecto antes de aprobarse. Las ausencias no cambian cuotas.</p></div></header><Notice success={params.success} error={params.error}/>
    <section className="card"><h2>Proponer incidencia</h2><form action={proposeIncidentAction} className="form-grid"><div className="field"><label>Miembro</label><select name="memberId" required><option value="">Seleccionar</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></div><div className="field"><label>Tipo</label><select name="type" required><option value="">Seleccionar</option>{["JOIN","PAUSE","REENTRY","RETIREMENT","SECTION_CHANGE","PARKING_START","PARKING_END","EXEMPTION","CORRECTION","OPERATIONAL_NOTE"].map((type) => <option key={type} value={type}>{type}</option>)}</select></div><div className="field"><label>Fecha efectiva confirmada</label><input name="effectiveOn" type="date" /></div><div className="field"><label>Período de efecto económico</label><input name="economicPeriod" type="month" /></div><div className="field"><label>Nueva cuerda, si aplica</label><select name="sectionId"><option value="">No aplica</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></div><div className="field"><label>Nota operativa visible</label><input name="publicNote" /></div><div className="field field-full"><label>Motivo privado, solo roles autorizados</label><textarea name="privateReason" /></div><SubmitButton>Simular y proponer</SubmitButton></form></section>
    <section className="section grid">{incidents.length ? incidents.map((incident) => {
      const simulation = incident.simulation as { affected?: number; paidOrPartial?: number; outstandingCents?: number; reviewRequired?: boolean; reason?: string } | null;
      return <article className="card" key={incident.id}><div className="section-header"><div><StatusPill value={incident.status}/> <strong>{incident.member.displayName} · {incident.type}</strong></div><span className="muted small">{formatLocalDateTime(incident.recordedAt)}</span></div><p className="small">Efectivo: {formatLocalDate(incident.effectiveOn)} · período: {incident.economicPeriod ?? "pendiente"} · autor: {incident.author.name}</p>{simulation ? <p className="notice notice-warning">{simulation.reviewRequired ? simulation.reason : `${simulation.affected ?? 0} cargo(s) afectados, ${simulation.paidOrPartial ?? 0} con pagos; saldo pendiente a ajustar ${formatUsd(simulation.outstandingCents ?? 0)}.`}</p> : null}{incident.publicNote ? <p>{incident.publicNote}</p> : null}{isFinanceRole(access) && incident.status === "PENDING" ? <form action={approveIncidentAction}><input type="hidden" name="incidentId" value={incident.id}/><SubmitButton>Aprobar efecto controlado</SubmitButton></form> : null}</article>;
    }) : <article className="card empty">No hay incidencias registradas.</article>}</section>
  </div>;
}
