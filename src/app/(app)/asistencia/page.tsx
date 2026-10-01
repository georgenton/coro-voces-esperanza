import { AppRole } from "@/generated/prisma/client";
import { Notice } from "@/components/notice";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { isGlobalReadRole, requireAccess } from "@/lib/access";
import { formatLocalDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { generateRecurringRehearsals } from "@/server/attendance/recurrence";
import { createRehearsalAction, manualAttendanceAction, setRehearsalStatusAction } from "./actions";
import { QrDisplay } from "./qr-display";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA, AppRole.DIRECTORA, AppRole.JEFE_DE_CUERDA]);
  const params = await searchParams;
  const managerRoles = new Set<AppRole>([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.DIRECTORA]);
  const canManage = access.roles.some((role) => managerRoles.has(role));
  if (canManage) await generateRecurringRehearsals(access.userId);
  const globalRead = isGlobalReadRole(access);
  const memberScope = globalRead ? {} : { currentSectionId: { in: access.sectionIds } };
  const memberWhere = { status: "ACTIVE" as const, ...memberScope };
  const [rehearsals, sections, members] = await Promise.all([
    prisma.rehearsal.findMany({
      where: globalRead ? {} : { invitees: { some: { member: memberScope } } },
      include: {
        attendances: { where: globalRead ? {} : { member: memberScope } },
        _count: { select: { invitees: { where: globalRead ? {} : { member: memberScope } } } },
      },
      orderBy: { startsAt: "desc" },
      take: 30,
    }),
    prisma.voiceSection.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.member.findMany({ where: memberWhere, orderBy: { displayName: "asc" } }),
  ]);
  const open = rehearsals.find(({ status }) => status === "OPEN");
  return <div className="page"><header className="page-header"><div><p className="eyebrow">Identidad individual</p><h1>Asistencia</h1><p className="lede">El QR rota, no contiene nombres y nunca registra por GET. Una sesión personal confirma una sola asistencia.</p></div></header><Notice success={params.success} error={params.error}/>
    {open && canManage ? <section className="card"><div className="section-header"><div><h2>{open.title}</h2><p className="muted small">Ventana hasta {formatLocalDateTime(open.checkInClosesAt)} · {open._count.invitees} convocados</p></div><StatusPill value={open.status}/></div><QrDisplay rehearsalId={open.id}/></section> : open ? <Notice warning="Hay un ensayo abierto. El QR solo puede proyectarlo Dirección o Administración."/> : <Notice warning="No hay un ensayo abierto. El QR no está disponible."/>}
    {canManage ? <section className="section card"><h2>Crear ensayo y convocatoria</h2><form action={createRehearsalAction} className="form-grid"><div className="field"><label>Título</label><input name="title" required minLength={3}/></div><div className="field"><label>Convocatoria</label><select name="sectionId"><option value="">Todos los miembros activos</option>{sections.map((section) => <option key={section.id} value={section.id}>Solo {section.name}</option>)}</select></div><div className="field"><label>Inicio</label><input name="startsAt" type="datetime-local" required/></div><div className="field"><label>Fin</label><input name="endsAt" type="datetime-local" required/></div><div className="field"><label>Abrir registro</label><input name="opensAt" type="datetime-local" required/></div><div className="field"><label>Cerrar registro</label><input name="closesAt" type="datetime-local" required/></div><div className="field"><label>Tardanza después de minutos</label><input name="lateAfterMinutes" type="number" min="0" max="180" defaultValue="15"/></div><SubmitButton>Crear ensayo</SubmitButton></form></section> : null}
    <section className="section table-wrap">{rehearsals.length ? <table><thead><tr><th>Ensayo</th><th>Horario</th><th>Convocados</th><th>Registrados</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{rehearsals.map((rehearsal) => <tr key={rehearsal.id}><td><strong>{rehearsal.title}</strong></td><td>{formatLocalDateTime(rehearsal.startsAt)}</td><td>{rehearsal._count.invitees}</td><td>{rehearsal.attendances.length}</td><td><StatusPill value={rehearsal.status}/></td><td>{canManage ? <div className="actions">{rehearsal.status === "SCHEDULED" ? <form action={setRehearsalStatusAction}><input type="hidden" name="rehearsalId" value={rehearsal.id}/><input type="hidden" name="status" value="OPEN"/><button className="button button-small">Abrir</button></form> : null}{rehearsal.status === "OPEN" ? <form action={setRehearsalStatusAction}><input type="hidden" name="rehearsalId" value={rehearsal.id}/><input type="hidden" name="status" value="CLOSED"/><button className="button button-small">Cerrar</button></form> : null}</div> : "Consulta"}</td></tr>)}</tbody></table> : <p className="empty">No hay ensayos creados. La recurrencia no se inventa: configúrala o crea una sesión.</p>}</section>
    <section className="section card"><h2>Registro o corrección manual</h2><form action={manualAttendanceAction} className="form-grid"><div className="field"><label>Ensayo</label><select name="rehearsalId" required><option value="">Seleccionar</option>{rehearsals.map((rehearsal) => <option key={rehearsal.id} value={rehearsal.id}>{rehearsal.title} · {formatLocalDateTime(rehearsal.startsAt)}</option>)}</select></div><div className="field"><label>Miembro de tu alcance</label><select name="memberId" required><option value="">Seleccionar</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></div><div className="field"><label>Estado</label><select name="status" required><option value="PRESENT">Presente</option><option value="LATE">Tardanza</option><option value="EXCUSED">Justificada</option><option value="ABSENT">Ausente</option></select></div><div className="field"><label>Motivo obligatorio</label><input name="note" required minLength={5}/></div><SubmitButton>Guardar con auditoría</SubmitButton></form></section>
  </div>;
}
