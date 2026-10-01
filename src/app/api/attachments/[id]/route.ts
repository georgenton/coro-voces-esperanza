import { AppRole } from "@/generated/prisma/client";
import { getAccessContext } from "@/lib/access";
import { prisma } from "@/lib/db";
import { readPrivateFile } from "@/server/files/private-storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAccessContext();
  if (!access) return Response.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) return Response.json({ error: "No encontrado" }, { status: 404 });
  const finance = new Set<AppRole>([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  if (attachment.uploadedById !== access.userId && !access.roles.some((role) => finance.has(role))) {
    return Response.json({ error: "Sin permiso" }, { status: 403 });
  }
  const bytes = await readPrivateFile(attachment.storageKey);
  return new Response(bytes, { headers: {
    "Content-Type": attachment.contentType,
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
