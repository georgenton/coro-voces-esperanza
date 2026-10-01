"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppRole } from "@/generated/prisma/client";
import { requireAccess } from "@/lib/access";
import { generateChargesForPeriod } from "@/server/finance/charges";

export async function generateChargesAction(formData: FormData) {
  const access = await requireAccess([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  const period = String(formData.get("period") ?? "");
  let target: string;
  try {
    const result = await generateChargesForPeriod(period, access.userId);
    target = `/cuotas?period=${period}&success=${encodeURIComponent(`${result.created} cargo(s) creados; ${result.reviewRequired} caso(s) quedaron en revisión.`)}`;
    revalidatePath("/cuotas");
    revalidatePath("/resumen");
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron generar los cargos.";
    target = `/cuotas?period=${encodeURIComponent(period)}&error=${encodeURIComponent(message.slice(0, 180))}`;
  }
  redirect(target);
}
