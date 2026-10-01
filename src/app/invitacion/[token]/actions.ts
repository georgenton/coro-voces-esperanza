"use server";

import { redirect } from "next/navigation";
import { consumeInvitation } from "@/server/auth/invitations";

export async function acceptInvitationAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  let target = `/invitacion/${encodeURIComponent(token)}`;
  try {
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    await consumeInvitation({ token, password, name });
    target = "/ingresar?success=Cuenta activada";
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0,180) : "No se pudo activar la cuenta.";
    target += `?error=${encodeURIComponent(message)}`;
  }
  redirect(target);
}
