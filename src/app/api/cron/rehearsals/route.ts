import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { generateRecurringRehearsals } from "@/server/attendance/recurrence";

export async function POST(request: Request) {
  const expected = `Bearer ${getServerEnv().CRON_SECRET}`;
  if (request.headers.get("authorization") !== expected) return Response.json({ error: "No autorizado" }, { status: 401 });
  const superadmin = await prisma.userRole.findFirst({ where: { role: "SUPERADMIN" }, select: { userId: true } });
  if (!superadmin) return Response.json({ error: "No existe SUPERADMIN para auditar la tarea" }, { status: 503 });
  return Response.json(await generateRecurringRehearsals(superadmin.userId), { headers: { "Cache-Control": "no-store" } });
}
