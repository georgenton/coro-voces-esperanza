import Link from "next/link";
import { AppRole } from "@/generated/prisma/client";
import { Notice } from "@/components/notice";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireAccess, isFinanceRole, isGlobalReadRole } from "@/lib/access";
import { prisma } from "@/lib/db";
import { createMemberAction } from "./actions";

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const access = await requireAccess([
    AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA, AppRole.DIRECTORA, AppRole.JEFE_DE_CUERDA,
  ]);
  const params = await searchParams;
  const where = isGlobalReadRole(access) ? {} : { currentSectionId: { in: access.sectionIds } };
  const [members, sections] = await Promise.all([
    prisma.member.findMany({ where, include: { currentSection: true }, orderBy: [{ currentSection: { sortOrder: "asc" } }, { displayName: "asc" }] }),
    prisma.voiceSection.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const canEdit = isFinanceRole(access);

  return (
    <div className="page">
      <header className="page-header"><div><p className="eyebrow">Catálogo e identidad</p><h1>Miembros</h1><p className="lede">Los nombres originales y normalizados se conservan sin fusionar personas por similitud.</p></div></header>
      <Notice success={params.success} error={params.error} />
      <section className="table-wrap">
        {members.length ? (
          <table>
            <thead><tr><th>Miembro</th><th>Cuerda actual</th><th>Estado</th><th>Cuenta</th></tr></thead>
            <tbody>{members.map((member) => (
              <tr key={member.id}>
                <td><Link href={`/miembros/${member.id}`}><strong>{member.displayName}</strong></Link></td>
                <td>{member.currentSection?.name ?? "Pendiente de asignar"}</td>
                <td><StatusPill value={member.status} /></td>
                <td>{member.authUserId ? "Vinculada" : "Sin invitación aceptada"}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p className="empty">No hay miembros visibles para tu alcance.</p>}
      </section>
      {canEdit ? (
        <section className="section card">
          <h2>Crear miembro</h2>
          <form action={createMemberAction} className="form-grid">
            <div className="field"><label htmlFor="displayName">Nombre</label><input id="displayName" name="displayName" required minLength={3} /></div>
            <div className="field"><label htmlFor="sectionId">Cuerda</label><select id="sectionId" name="sectionId"><option value="">Pendiente de asignar</option>{sections.map((section) => <option value={section.id} key={section.id}>{section.name}</option>)}</select></div>
            <div className="field"><label htmlFor="status">Estado</label><select id="status" name="status" defaultValue="REVIEW_REQUIRED"><option value="REVIEW_REQUIRED">Revisión pendiente</option><option value="ACTIVE">Activo</option><option value="PAUSED">Pausa</option><option value="RETIRED">Retirado</option></select></div>
            <div className="field"><label htmlFor="joinedOn">Fecha de ingreso, si está confirmada</label><input id="joinedOn" name="joinedOn" type="date" /></div>
            <div className="field field-full"><SubmitButton>Crear miembro</SubmitButton></div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
