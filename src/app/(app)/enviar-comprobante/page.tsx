import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/db";
import { submitMemberReceiptAction } from "./actions";

export default async function SendReceiptPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const access = await requireAccess();
  const params = await searchParams;
  const recent = await prisma.attachment.findMany({ where: { uploadedById: access.userId }, orderBy: { createdAt: "desc" }, take: 10 });
  return <div className="page"><header className="page-header"><div><p className="eyebrow">Evidencia pendiente</p><h1>Enviar comprobante</h1><p className="lede">La carga no acredita tu pago. Tesorería verificará el movimiento y su distribución.</p></div></header><Notice success={params.success} error={params.error}/><section className="card"><form action={submitMemberReceiptAction} className="form-grid"><div className="field field-full"><label>Imagen PNG, JPEG o WebP</label><input name="evidence" type="file" accept="image/png,image/jpeg,image/webp" capture="environment" required/></div><div className="field field-full"><label>Destino declarado, si lo conoces</label><input name="destination" placeholder="Ej.: cuota de marzo; no se usa como confirmación automática"/></div><SubmitButton pendingText="Enviando…">Enviar para revisión</SubmitButton></form></section><section className="section card"><h2>Envíos recientes</h2>{recent.length ? recent.map((item) => <p key={item.id}><strong>{item.originalName}</strong> <span className="pill">{item.status}</span></p>) : <p className="empty">Aún no has enviado comprobantes.</p>}</section></div>;
}
