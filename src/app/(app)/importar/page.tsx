import { AppRole } from "@/generated/prisma/client";
import { Notice } from "@/components/notice";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireAccess } from "@/lib/access";
import { formatLocalDateTime } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { approveBatchAction, resolveImportItemAction, uploadWorkbookAction } from "./actions";

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ batch?: string; success?: string; error?: string }> }) {
  await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  const params = await searchParams;
  const [batches, selected] = await Promise.all([
    prisma.importBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { _count: { select: { rows: true, issues: true } } },
    }),
    params.batch
      ? prisma.importBatch.findUnique({
          where: { id: params.batch },
          include: {
            issues: { orderBy: { createdAt: "asc" }, take: 30 },
            rows: { orderBy: [{ sheetName: "asc" }, { rowNumber: "asc" }], take: 30 },
            _count: {
              select: {
                rows: { where: { status: "PENDING" } },
                issues: { where: { status: "PENDING" } },
              },
            },
          },
        })
      : null,
  ]);
  return (
    <div className="page">
      <header className="page-header"><div><p className="eyebrow">Staging e idempotencia</p><h1>Importar Excel</h1><p className="lede">La vista previa conserva hash, hoja, fila y texto original. Cargar un libro no publica deudas ni crea movimientos.</p></div></header>
      <Notice success={params.success} error={params.error} />
      <section className="card"><h2>Cargar libro inmutable</h2><form action={uploadWorkbookAction} className="form-grid"><div className="field field-full"><label htmlFor="workbook">Archivo XLSX</label><input id="workbook" name="workbook" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /></div><SubmitButton pendingText="Analizando…">Crear vista previa</SubmitButton></form><p className="muted small">No se ejecutan macros ni enlaces. Límite configurable de tamaño, 50 hojas y 250.000 celdas de vista previa.</p></section>
      <section className="section grid grid-2">
        <article className="card"><h2>Lotes recientes</h2>{batches.length ? batches.map((batch) => <p key={batch.id}><a href={`/importar?batch=${batch.id}`}><strong>{batch.originalName}</strong></a><br/><StatusPill value={batch.status} /> <span className="muted small">{batch.sheetCount} hojas · {batch._count.rows} filas · {batch._count.issues} incidencias · {formatLocalDateTime(batch.createdAt)}</span></p>) : <p className="empty">No hay archivos en staging.</p>}</article>
        <article className="card"><h2>Reglas de seguridad</h2><ul className="small muted"><li>Una X mensual no se convierte en pausa sin aprobación.</li><li>Una celda por mes no inventa fecha bancaria.</li><li>Subtotales e informes no crean ingresos.</li><li>Un segundo archivo modificado se compara como un lote nuevo.</li></ul></article>
      </section>
      {selected ? <section className="section">
        <div className="card"><div className="section-header"><div><h2>{selected.originalName}</h2><p className="mono small muted">SHA-256 {selected.sha256}</p></div><StatusPill value={selected.status} /></div><p>{selected._count.rows} fila(s) y {selected._count.issues} incidencia(s) siguen pendientes.</p><form action={approveBatchAction}><input type="hidden" name="batchId" value={selected.id} /><SubmitButton>Aprobar staging resuelto</SubmitButton></form></div>
        <div className="grid grid-2 section">
          <article className="card"><h2>Incidencias visibles</h2>{selected.issues.length ? selected.issues.map((issue) => <div key={issue.id} className="section"><StatusPill value={issue.status} /> <strong>{issue.code}</strong><p className="small">{issue.sheetName ? `${issue.sheetName}${issue.cellReference ? `!${issue.cellReference}` : ""}: ` : ""}{issue.message}</p>{issue.status === "PENDING" ? <div className="actions">{["APPROVED", "REJECTED"].map((status) => <form action={resolveImportItemAction} key={status}><input type="hidden" name="batchId" value={selected.id}/><input type="hidden" name="kind" value="issue"/><input type="hidden" name="id" value={issue.id}/><input type="hidden" name="status" value={status}/><button className="button button-secondary button-small">{status === "APPROVED" ? "Aceptar tratamiento" : "Rechazar"}</button></form>)}</div> : null}</div>) : <p className="empty">Sin incidencias.</p>}</article>
          <article className="card"><h2>Primeras filas</h2><p className="muted small">La revisión completa permanece en la base privada; aquí se limita la vista.</p>{selected.rows.length ? selected.rows.map((row) => <div key={row.id} className="section"><StatusPill value={row.status} /> <strong>{row.sheetName} · fila {row.rowNumber}</strong><p className="small">{row.rawText}</p>{row.status === "PENDING" ? <div className="actions">{["APPROVED", "REJECTED"].map((status) => <form action={resolveImportItemAction} key={status}><input type="hidden" name="batchId" value={selected.id}/><input type="hidden" name="kind" value="row"/><input type="hidden" name="id" value={row.id}/><input type="hidden" name="status" value={status}/><button className="button button-secondary button-small">{status === "APPROVED" ? "Aprobar transformación" : "Excluir fila"}</button></form>)}</div> : null}</div>) : <p className="empty">Sin filas guardadas.</p>}</article>
        </div>
      </section> : null}
    </div>
  );
}
