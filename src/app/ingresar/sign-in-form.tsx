"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const callbackURL = searchParams.get("callbackURL") || "/resumen";

  return (
    <form
      className="grid"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const form = new FormData(event.currentTarget);
        const result = await authClient.signIn.email({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          callbackURL,
        });
        if (result.error) {
          setError("Correo o contraseña incorrectos, o cuenta sin acceso.");
          setPending(false);
          return;
        }
        router.push(callbackURL.startsWith("/") ? callbackURL : "/resumen");
        router.refresh();
      }}
    >
      {error ? <div className="notice notice-error" role="alert">{error}</div> : null}
      <div className="field">
        <label htmlFor="email">Correo personal</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" minLength={12} required />
      </div>
      <button className="button" disabled={pending}>{pending ? "Ingresando…" : "Ingresar"}</button>
    </form>
  );
}
