import { AppRole } from "@/generated/prisma/client";
import { Notice } from "@/components/notice";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireAccess } from "@/lib/access";
import { formatLocalDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { suggestIdentityMatches } from "@/server/imports/mapping";
import type { PromotionPreview } from "@/server/imports/service";
import {
  approveBatchAction,
  createPromotionPreviewAction,
  promotePlanAction,
  resolveImportItemAction,
  saveRowMappingAction,
  uploadWorkbookAction,
} from "./actions";

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function fieldValue(record: Record<string, unknown>, name: string) {
  const value = record[name];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function promotionPreview(value: unknown): PromotionPreview | null {
  const record = jsonRecord(value);
  if (typeof record.scope !== "string" || typeof record.mappingHash !== "string" || !record.creates) return null;
  return value as PromotionPreview;
}

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ batch?: string; plan?: string; success?: string; error?: string }> }) {
  await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  const params = await searchParams;
  const [batches, selected, members, sections, concepts, accounts] = await Promise.all([
    prisma.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { _count: { select: { rows: true, sourceCells: true, issues: true, promotions: true } } } }),
    params.batch ? prisma.importBatch.findUnique({
      where: { id: params.batch },
      include: {
        issues: { orderBy: { createdAt: "asc" }, take: 50 },
        rows: { orderBy: [{ sheetName: "asc" }, { rowNumber: "asc" }], take: 50, include: { _count: { select: { publications: true } } } },
        promotions: { orderBy: { createdAt: "desc" }, take: 8, include: { _count: { select: { publications: true } } } },
        _count: { select: { rows: { where: { status: "PENDING" } }, sourceCells: true, issues: { where: { status: "PENDING" } } } },
      },
    }) : null,
    prisma.member.findMany({ orderBy: { displayName: "asc" }, select: { id: true, displayName: true, normalizedName: true } }),
    prisma.voiceSection.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.billingConcept.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, systemKey: true } }),
    prisma.financialAccount.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const activePlan = selected?.promotions.find(({ id }) => id === params.plan) ?? selected?.promotions[0] ?? null;
  const preview = activePlan ? promotionPreview(activePlan.preview) : null;

  return (
    <div className="page">
      <header className="page-header"><div><p className="eyebrow">Staging, revisión y publicación controlada</p><h1>Importar Excel</h1><p className="lede">El original queda inmutable. Mapear y aprobar no publica registros; la promoción usa otra confirmación, hash del mapeo y una transacción idempotente.</p></div></header>
      <Notice success={params.success} error={params.error} />
      <section className="card"><h2>Cargar libro inmutable</h2><form action={uploadWorkbookAction} className="form-grid"><div className="field field-full"><label htmlFor="workbook">Archivo XLSX</label><input id="workbook" name="workbook" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /></div><SubmitButton pendingText="Analizando…">Crear vista previa</SubmitButton></form><p className="muted small">No se ejecutan macros ni enlaces. Cargar un archivo nunca crea miembros, cargos, aplicaciones ni movimientos.</p></section>
      <section className="section grid grid-2">
        <article className="card"><h2>Lotes recientes</h2>{batches.length ? batches.map((batch) => <p key={batch.id}><a href={`/importar?batch=${batch.id}`}><strong>{batch.originalName}</strong></a><br/><StatusPill value={batch.status} /> <span className="muted small">v{batch.mappingVersion} · {batch.sheetCount} hojas · {batch._count.rows} filas · {batch._count.sourceCells} celdas · {batch._count.issues} incidencias · {batch._count.promotions} vista(s) · {formatLocalDateTime(batch.createdAt)}</span></p>) : <p className="empty">No hay archivos en staging.</p>}</article>
        <article className="card"><h2>Controles</h2><ul className="small muted"><li>Una edición invalida aprobación y vistas previas anteriores.</li><li>Identidades aproximadas solo aparecen como sugerencias.</li><li>Una aplicación LEGACY no crea movimiento ni saldo de caja.</li><li>Fecha desconocida permanece nula; un movimiento exige fecha aprobada.</li><li>Miembros y finanzas pueden promoverse como subconjuntos explícitos.</li></ul></article>
      </section>

      {selected ? <section className="section">
        <div className="card"><div className="section-header"><div><h2>{selected.originalName}</h2><p className="mono small muted">SHA-256 {selected.sha256}</p><p className="small muted">Mapeo v{selected.mappingVersion}{selected.mappingHash ? ` · ${selected.mappingHash.slice(0, 16)}…` : " · sin aprobación vigente"} · {selected._count.sourceCells} celdas preservadas</p></div><StatusPill value={selected.status} /></div><p>{selected._count.rows} fila(s) y {selected._count.issues} incidencia(s) siguen pendientes.</p><div className="actions"><a className="button button-secondary" href={`/reportes/historico?batch=${selected.id}`}>Ver histórico fuente</a><form action={approveBatchAction}><input type="hidden" name="batchId" value={selected.id} /><SubmitButton pendingText="Validando…">Aprobar mapeo resuelto</SubmitButton></form></div></div>

        <div className="grid grid-2 section">
          <article className="card"><h2>Incidencias</h2>{selected.issues.length ? selected.issues.map((issue) => <div key={issue.id} className="section"><StatusPill value={issue.status} /> <strong>{issue.code}</strong><p className="small">{issue.sheetName ? `${issue.sheetName}${issue.cellReference ? `!${issue.cellReference}` : ""}: ` : ""}{issue.message}</p>{issue.status === "PENDING" ? <div className="actions">{["APPROVED", "REJECTED"].map((status) => <form action={resolveImportItemAction} key={status}><input type="hidden" name="batchId" value={selected.id}/><input type="hidden" name="kind" value="issue"/><input type="hidden" name="id" value={issue.id}/><input type="hidden" name="status" value={status}/><button className="button button-secondary button-small">{status === "APPROVED" ? "Aceptar tratamiento" : "Rechazar"}</button></form>)}</div> : null}</div>) : <p className="empty">Sin incidencias.</p>}</article>
          <article className="card"><h2>Contrato del mapeo</h2><p className="small muted">Cada fila aprobada guarda tipo, JSON validado, hash, revisor y fecha. La promoción conserva archivo, hoja, fila, huella, versión, hash, aprobador y destino creado o enlazado.</p><p className="small"><strong>Fechas:</strong> “aplicado a” y “ocurrido en banco” son campos distintos. Para LEGACY, dejar “fecha aplicada” vacía no inventa recepción de dinero.</p></article>
        </div>

        <div className="section"><h2>Filas y propuestas</h2><p className="muted small">Se muestran las primeras 50 filas. Rechaza encabezados, subtotales e informes; solo aprueba una fila después de guardar un mapeo completo.</p>{selected.rows.length ? selected.rows.map((row) => {
          const mapped = jsonRecord(row.transformed);
          const suggestions = suggestIdentityMatches(row.rawText ?? "", members);
          return <article className="card section" key={row.id}>
            <div className="section-header"><div><StatusPill value={row.status} /> <strong>{row.sheetName} · fila {row.rowNumber}</strong></div><span className="small muted">{row._count.publications ? `${row._count.publications} destino(s) publicado(s)` : "sin publicar"}</span></div>
            <p className="small">{row.rawText}</p>
            {suggestions.length ? <p className="small muted">Coincidencias propuestas: {suggestions.map((item) => `${item.displayName} (${item.kind === "EXACT" ? "exacta" : `${Math.round(item.score * 100)}%`})`).join(" · ")}. Debes elegir explícitamente.</p> : null}
            <details><summary>Editar mapeo operativo</summary><form action={saveRowMappingAction} className="form-grid section">
              <input type="hidden" name="batchId" value={selected.id}/><input type="hidden" name="rowId" value={row.id}/>
              <div className="field field-full"><label>Tipo</label><select name="proposedType" defaultValue={row.proposedType ?? ""} required><option value="">Seleccionar</option><option value="MEMBER_CREATE">Crear miembro</option><option value="IDENTITY_LINK">Enlazar identidad existente</option><option value="SECTION_ASSIGNMENT">Asignación de cuerda</option><option value="CHARGE">Cargo histórico</option><option value="LEGACY_ALLOCATION">Aplicación LEGACY sin caja</option><option value="MONEY_MOVEMENT">Movimiento verificado</option><option value="OPENING_BALANCE">Saldo de apertura aprobado</option></select></div>
              <div className="field"><label>Nombre visible (crear)</label><input name="displayName" defaultValue={fieldValue(mapped, "displayName")}/></div>
              <div className="field"><label>Nombre original / fuente</label><input name="sourceName" defaultValue={fieldValue(mapped, "sourceName") || fieldValue(mapped, "originalName") || (row.rawText?.split("|")[0]?.trim() ?? "")}/></div>
              <div className="field"><label>Miembro existente</label><select name="memberId" defaultValue={fieldValue(mapped, "memberId")}><option value="">Seleccionar</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}</select></div>
              <div className="field"><label>Cuerda</label><select name="sectionId" defaultValue={fieldValue(mapped, "sectionId")}><option value="">Seleccionar</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></div>
              <div className="field"><label>Estado de miembro</label><select name="memberStatus" defaultValue={fieldValue(mapped, "status") || "ACTIVE"}><option value="ACTIVE">Activo</option><option value="PAUSED">Pausa</option><option value="RETIRED">Retirado</option></select></div>
              <div className="field"><label>Vigencia desde</label><input type="date" name="startsOn" defaultValue={fieldValue(mapped, "startsOn")}/></div>
              <div className="field"><label>Vigencia hasta (opcional)</label><input type="date" name="endsOn" defaultValue={fieldValue(mapped, "endsOn")}/></div>
              <div className="field"><label>Concepto</label><select name="conceptId" defaultValue={fieldValue(mapped, "conceptId")}><option value="">Seleccionar</option>{concepts.map((concept) => <option key={concept.id} value={concept.id}>{concept.name} · {concept.systemKey}</option>)}</select></div>
              <div className="field"><label>Período contable</label><input name="period" placeholder="2026-02" pattern="\d{4}-(0[1-9]|1[0-2])" defaultValue={fieldValue(mapped, "period")}/></div>
              <div className="field"><label>Importe (centavos)</label><input type="number" min="1" name="amountCents" defaultValue={fieldValue(mapped, "amountCents")}/></div>
              <div className="field"><label>Cargo total para LEGACY</label><input type="number" min="1" name="chargeAmountCents" defaultValue={fieldValue(mapped, "chargeAmountCents")}/></div>
              <div className="field"><label>Aplicado LEGACY (centavos)</label><input type="number" min="1" name="appliedAmountCents" defaultValue={fieldValue(mapped, "appliedAmountCents")}/></div>
              <div className="field"><label>Vencimiento (opcional)</label><input type="date" name="dueOn" defaultValue={fieldValue(mapped, "dueOn")}/></div>
              <div className="field"><label>Fecha aplicada LEGACY (opcional)</label><input type="date" name="appliedOn" defaultValue={fieldValue(mapped, "appliedOn")}/></div>
              <div className="field"><label>Cuenta financiera</label><select name="accountId" defaultValue={fieldValue(mapped, "accountId")}><option value="">Seleccionar</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div>
              <div className="field"><label>Tipo de movimiento</label><select name="movementType" defaultValue={fieldValue(mapped, "movementType") || "PAYMENT"}><option value="PAYMENT">Pago</option><option value="EXPENSE">Gasto</option><option value="INTEREST">Interés</option></select></div>
              <div className="field"><label>Dirección</label><select name="direction" defaultValue={fieldValue(mapped, "direction") || "IN"}><option value="IN">Entrada</option><option value="OUT">Salida</option></select></div>
              <div className="field"><label>Fecha real del movimiento</label><input type="date" name="occurredOn" defaultValue={fieldValue(mapped, "occurredOn")}/></div>
              <div className="field"><label>Fecha de corte de apertura</label><input type="date" name="cutoffOn" defaultValue={fieldValue(mapped, "cutoffOn")}/></div>
              <div className="field"><label>Referencia externa</label><input name="externalReference" defaultValue={fieldValue(mapped, "externalReference")}/></div>
              <div className="field field-full"><label>Descripción / evidencia de aprobación</label><input name="description" defaultValue={fieldValue(mapped, "description")}/></div>
              <SubmitButton pendingText="Validando…">Guardar mapeo e invalidar aprobación previa</SubmitButton>
            </form></details>
            <div className="actions section">{row.transformed && row.status === "PENDING" ? <form action={resolveImportItemAction}><input type="hidden" name="batchId" value={selected.id}/><input type="hidden" name="kind" value="row"/><input type="hidden" name="id" value={row.id}/><input type="hidden" name="status" value="APPROVED"/><button className="button button-secondary button-small">Aprobar transformación</button></form> : null}{row.status === "PENDING" ? <form action={resolveImportItemAction}><input type="hidden" name="batchId" value={selected.id}/><input type="hidden" name="kind" value="row"/><input type="hidden" name="id" value={row.id}/><input type="hidden" name="status" value="REJECTED"/><button className="button button-secondary button-small">Excluir fila</button></form> : null}</div>
          </article>;
        }) : <p className="empty">Sin filas guardadas.</p>}</div>

        {selected.status === "APPROVED" ? <section className="card section"><h2>Preparar promoción</h2><p className="small muted">Cada alcance se publica completo o no publica nada. Usa “Miembros y cuerdas” antes de volver a mapear filas financieras que dependan de identidades nuevas.</p><form action={createPromotionPreviewAction} className="form-grid"><input type="hidden" name="batchId" value={selected.id}/><div className="field"><label>Alcance atómico</label><select name="scope" defaultValue="ALL_APPROVED"><option value="ALL_APPROVED">Todo lo aprobado</option><option value="MEMBERS">Miembros y cuerdas</option><option value="FINANCE">Cargos, aplicaciones, movimientos y aperturas</option></select></div><SubmitButton pendingText="Calculando…">Generar vista previa</SubmitButton></form></section> : null}

        {activePlan && preview ? <section className="card section"><div className="section-header"><div><h2>Vista previa de promoción</h2><p className="small muted">{preview.scope} · mapeo v{preview.mappingVersion} · {preview.mappingHash.slice(0, 16)}…</p></div><StatusPill value={activePlan.status}/></div><div className="metrics"><div className="metric"><span>Filas</span><strong>{preview.rows}</strong></div><div className="metric"><span>Miembros</span><strong>{preview.creates.members}</strong></div><div className="metric"><span>Cuerdas</span><strong>{preview.creates.sectionAssignments}</strong></div><div className="metric"><span>Cargos</span><strong>{preview.creates.charges}</strong></div><div className="metric"><span>Aplicaciones LEGACY</span><strong>{preview.creates.legacyAllocations}</strong></div><div className="metric"><span>Movimientos</span><strong>{preview.creates.movements}</strong></div><div className="metric"><span>Aperturas</span><strong>{preview.creates.openingBalances}</strong></div><div className="metric"><span>Duplicados</span><strong>{preview.duplicates}</strong></div></div>{preview.differences.length ? <><h3>Diferencias</h3><ul>{preview.differences.map((item) => <li key={item}>{item}</li>)}</ul></> : null}{preview.blockingIssues.length ? <><h3>Bloqueos</h3><ul>{preview.blockingIssues.map((item) => <li key={item}>{item}</li>)}</ul></> : <p className="pill pill-success">Sin bloqueos detectados en esta vista previa.</p>}<p className="small muted">Publicaciones ya existentes: {activePlan._count.publications}. Reintentar una promoción completada devuelve el mismo resultado.</p>{activePlan.status === "PREVIEWED" && !preview.blockingIssues.length ? <form action={promotePlanAction}><input type="hidden" name="batchId" value={selected.id}/><input type="hidden" name="planId" value={activePlan.id}/><SubmitButton pendingText="Publicando transacción…">Promover este alcance</SubmitButton></form> : null}</section> : null}
      </section> : null}
    </div>
  );
}
