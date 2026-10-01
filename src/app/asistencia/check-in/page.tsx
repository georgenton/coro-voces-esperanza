import { redirect } from "next/navigation";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { getAccessContext } from "@/lib/access";
import { checkInAction } from "./actions";

export default async function CheckInPage({ searchParams }: { searchParams: Promise<{ token?: string; success?: string; error?: string }> }) {
  const params = await searchParams;
  const access = await getAccessContext();
  if (!access) {
    const callback = `/asistencia/check-in${params.token ? `?token=${encodeURIComponent(params.token)}` : ""}`;
    redirect(`/ingresar?callbackURL=${encodeURIComponent(callback)}`);
  }
  return <main className="login-shell"><section className="login-card"><p className="eyebrow">Ensayo</p><h1>Confirmar mi asistencia</h1><p className="lede">Ingresaste como {access.name}. No puedes elegir otra identidad.</p><div className="section"><Notice success={params.success} error={params.error}/>{params.token ? <form action={checkInAction}><input type="hidden" name="token" value={params.token}/><SubmitButton>Confirmar asistencia</SubmitButton></form> : params.success ? null : <Notice warning="Escanea el QR vigente del ensayo."/>}</div><p className="muted small">El QR reduce fricción, pero no prueba presencia física absoluta. La ventana y rotación limitan reenvíos.</p></section></main>;
}
