import { AppRole } from "@/generated/prisma/client";
import { Notice } from "@/components/notice";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireAccess } from "@/lib/access";
import { formatLocalDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatUsd } from "@/lib/money";
import { confirmCandidateAction, createBatchAction, extractCandidateAction, reviewCandidateAction, uploadEvidenceAction } from "./actions";

export default async function ReconciliationPage({ searchParams }: { searchParams: Promise<{ batch?: string; success?: string; error?: string }> }) {
  await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  const params = await searchParams;
  const [batches, selected, accounts] = await Promise.all([
    prisma.reconciliationBatch.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { _count: { select: { candidates: true } } } }),
    params.batch ? prisma.reconciliationBatch.findUnique({ where: { id: params.batch }, include: { candidates: { include: { attachments: { include: { attachment: true } } }, orderBy: { createdAt: "desc" } } } }) : null,
    prisma.financialAccount.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="page">
      <header className="page-header"><div><p className="eyebrow">Revisión quincenal</p><h1>Conciliar</h1><p className="lede">La evidencia recibida no reduce deuda. Solo una persona autorizada confirma el movimiento y su distribución.</p></div></header>
      <Notice success={params.success} error={params.error} />
      <section className="grid grid-2">
        <article className="card"><h2>Crear lote</h2><form action={createBatchAction} className="form-grid"><div className="field field-full"><label htmlFor="batch-name">Nombre</label><input id="batch-name" name="name" placeholder="Revisión primera quincena" required minLength={3} /></div><SubmitButton>Crear lote</SubmitButton></form></article>
        <article className="card"><h2>Lotes recientes</h2>{batches.length ? batches.map((batch) => <p key={batch.id}><a href={`/conciliar?batch=${batch.id}`}><strong>{batch.name}</strong></a><br/><StatusPill value={batch.status} /> <span className="muted small">{batch._count.candidates} candidato(s) · {formatLocalDateTime(batch.createdAt)}</span></p>) : <p className="empty">No hay lotes.</p>}</article>
      </section>
      {selected ? <section className="section">
        <article className="card"><div className="section-header"><div><h2>{selected.name}</h2><p className="muted small">Acepta PNG, JPEG, WebP y CSV. SVG/HTML no se admiten.</p></div><StatusPill value={selected.status} /></div><form action={uploadEvidenceAction} className="form-grid"><input type="hidden" name="batchId" value={selected.id}/><div className="field field-full"><label htmlFor="evidence">Comprobantes o CSV bancario</label><input id="evidence" name="evidence" type="file" accept="image/png,image/jpeg,image/webp,text/csv,.csv" required /></div><SubmitButton pendingText="Cargando…">Añadir evidencia</SubmitButton></form></article>
        <div className="grid section">
          {selected.candidates.length ? selected.candidates.map((candidate) => <article className="card" key={candidate.id}>
            <div className="section-header"><div><StatusPill value={candidate.status} /> <strong>{candidate.payerName ?? "Pagador pendiente"}</strong></div><strong>{candidate.amountCents ? formatUsd(candidate.amountCents) : "Importe pendiente"}</strong></div>
            <p className="small muted">{candidate.occurredAt ? formatLocalDateTime(candidate.occurredAt) : "Fecha bancaria pendiente"} · Ref. {candidate.externalReference ?? "pendiente"} · {candidate.attachments.length} respaldo(s)</p>
            {candidate.reviewNote ? <p className="notice notice-warning">{candidate.reviewNote}</p> : null}
            <form action={reviewCandidateAction} className="form-grid"><input type="hidden" name="batchId" value={selected.id}/><input type="hidden" name="candidateId" value={candidate.id}/><div className="field"><label>Dirección</label><select name="direction" defaultValue={candidate.direction ?? ""}><option value="">Pendiente</option><option value="IN">Entrada</option><option value="OUT">Salida</option></select></div><div className="field"><label>Importe USD</label><input name="amount" defaultValue={candidate.amountCents ? (candidate.amountCents / 100).toFixed(2) : ""} inputMode="decimal" /></div><div className="field"><label>Fecha real</label><input name="occurredOn" type="date" defaultValue={candidate.occurredAt?.toISOString().slice(0,10) ?? ""}/></div><div className="field"><label>Referencia</label><input name="externalReference" defaultValue={candidate.externalReference ?? ""}/></div><div className="field"><label>Nombre del ordenante</label><input name="payerName" defaultValue={candidate.payerName ?? ""}/></div><div className="field"><label>Nota de revisión</label><input name="reviewNote" defaultValue={candidate.reviewNote ?? ""}/></div><SubmitButton>Guardar revisión</SubmitButton></form>
            <div className="actions section">
              {candidate.attachments.some(({ attachment }) => attachment.contentType.startsWith("image/")) && candidate.status !== "CONFIRMED" ? <form action={extractCandidateAction}><input type="hidden" name="batchId" value={selected.id}/><input type="hidden" name="candidateId" value={candidate.id}/><SubmitButton className="button-secondary">Leer imagen opcionalmente</SubmitButton></form> : null}
              {candidate.status === "READY" ? <form action={confirmCandidateAction} className="actions"><input type="hidden" name="batchId" value={selected.id}/><input type="hidden" name="candidateId" value={candidate.id}/><select name="accountId" required><option value="">Cuenta receptora</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><SubmitButton>Confirmar como importe sin identificar</SubmitButton></form> : null}
            </div>
          </article>) : <article className="card empty">Carga evidencia para comenzar la revisión.</article>}
        </div>
      </section> : null}
    </div>
  );
}
