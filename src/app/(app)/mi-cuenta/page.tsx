import { redirect } from "next/navigation";
import { MemberAccount } from "@/components/member-account";
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/db";

export default async function MyAccountPage() {
  const access = await requireAccess();
  if (!access.memberId) redirect("/sin-acceso");
  const member = await prisma.member.findUniqueOrThrow({
    where: { id: access.memberId },
    include: {
      currentSection: true,
      sectionAssignments: { include: { section: true }, orderBy: { startsOn: "desc" } },
      charges: { include: { concept: true, allocations: true, adjustments: true }, orderBy: [{ period: "desc" }, { concept: { name: "asc" } }] },
      incidents: { where: { privateReason: null }, orderBy: { recordedAt: "desc" } },
    },
  });
  return <div className="page"><header className="page-header"><div><p className="eyebrow">Consulta individual</p><h1>Mi cuenta</h1><p className="lede">Solo tú y los roles autorizados pueden consultar este detalle.</p></div></header><MemberAccount member={member} /></div>;
}
