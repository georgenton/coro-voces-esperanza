import { AppRole } from "@/generated/prisma/client";
import { isGlobalReadRole, requireAccess } from "@/lib/access";
import { prisma } from "@/lib/db";
import { chargeAmounts } from "@/server/reports/definitions";
import { csvCell } from "@/server/reports/csv";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await requireAccess([
    AppRole.SUPERADMIN,
    AppRole.ADMIN,
    AppRole.TESORERIA,
    AppRole.DIRECTORA,
    AppRole.JEFE_DE_CUERDA,
  ]);
  const period = new URL(request.url).searchParams.get("period") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    return Response.json({ error: "El período debe tener formato AAAA-MM." }, { status: 400 });
  }

  const charges = await prisma.charge.findMany({
    where: {
      period,
      member: isGlobalReadRole(access) ? {} : { currentSectionId: { in: access.sectionIds } },
    },
    include: {
      member: { include: { currentSection: true } },
      concept: true,
      allocations: true,
      adjustments: true,
    },
    orderBy: [{ member: { displayName: "asc" } }, { concept: { name: "asc" } }],
  });

  const header = ["Miembro", "Cuerda", "Período", "Concepto", "Cargo USD", "Aplicado USD", "Saldo USD", "Estado"];
  const rows = charges.map((charge) => {
    const { dueCents: amount, appliedCents: applied } = chargeAmounts(charge);
    return [
      charge.member.displayName,
      charge.member.currentSection?.name ?? "Pendiente",
      charge.period,
      charge.concept.name,
      (amount / 100).toFixed(2),
      (applied / 100).toFixed(2),
      (Math.max(0, amount - applied) / 100).toFixed(2),
      charge.status,
    ];
  });
  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuotas-${period}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
