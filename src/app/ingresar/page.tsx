import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">♪</span>
          <span className="brand-title">Voces de Esperanza</span>
        </div>
        <div className="divider" />
        <p className="eyebrow">Acceso individual</p>
        <h1>Ingresa a tu cuenta</h1>
        <p className="lede">No existe autorregistro público. Usa la cuenta creada por administración o tu invitación personal.</p>
        <div className="section">
          <Suspense fallback={<p className="muted">Cargando formulario…</p>}>
            <SignInForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
