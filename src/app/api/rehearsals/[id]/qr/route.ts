import QRCode from "qrcode";
import { AppRole } from "@/generated/prisma/client";
import { getAccessContext } from "@/lib/access";
import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { createAttendanceToken } from "@/server/attendance/tokens";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAccessContext();
  if (!access) return Response.json({ error: "No autenticado" }, { status: 401 });
  const allowed = new Set<AppRole>([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.DIRECTORA]);
  if (!access.roles.some((role) => allowed.has(role))) return Response.json({ error: "Sin permiso" }, { status: 403 });
  const { id } = await params;
  const rehearsal = await prisma.rehearsal.findUnique({ where: { id } });
  if (!rehearsal || rehearsal.status !== "OPEN") return Response.json({ error: "Ensayo no abierto" }, { status: 409 });
  const token = createAttendanceToken(rehearsal.id, rehearsal.tokenTtlSeconds);
  const url = new URL("/asistencia/check-in", getServerEnv().APP_BASE_URL);
  url.searchParams.set("token", token);
  const dataUrl = await QRCode.toDataURL(url.toString(), { width: 512, margin: 2, errorCorrectionLevel: "M" });
  return Response.json({ dataUrl, expiresIn: rehearsal.tokenTtlSeconds }, { headers: { "Cache-Control": "no-store, private" } });
}
