import { createHash } from "node:crypto";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/db";
import { acceptInvitationAction } from "./actions";

export default async function InvitationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const query = await searchParams;
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash: createHash("sha256").update(token).digest("hex") } });
  const valid = invitation && !invitation.consumedAt && invitation.expiresAt > new Date();
  return <main className="login-shell"><section className="login-card"><p className="eyebrow">Invitación personal</p><h1>Activa tu cuenta</h1><Notice error={query.error}/>{valid ? <><p className="lede">Cuenta para {invitation.email}. Este enlace funciona una sola vez.</p><form action={acceptInvitationAction} className="grid section"><input type="hidden" name="token" value={token}/><div className="field"><label>Nombre visible</label><input name="name" required minLength={2}/></div><div className="field"><label>Contraseña</label><input name="password" type="password" required minLength={12} autoComplete="new-password"/></div><SubmitButton>Activar cuenta</SubmitButton></form></> : <Notice error="La invitación no existe, caducó o ya fue utilizada."/>}</section></main>;
}
