"use server";

import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { checkInWithToken } from "@/server/attendance/service";

export async function checkInAction(formData: FormData) {
  const access = await requireAccess();
  const token = String(formData.get("token") ?? "");
  let target = "/asistencia/check-in";
  try {
    const result = await checkInWithToken(token, access.userId);
    target += `?success=${encodeURIComponent(result.duplicate ? "Tu asistencia ya estaba registrada; conservamos la primera hora." : "Tu asistencia quedó registrada.")}`;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 180) : "No se registró la asistencia.";
    target += `?error=${encodeURIComponent(message)}`;
  }
  redirect(target);
}
