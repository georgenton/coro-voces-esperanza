import { notFound } from "next/navigation";
import { Notice } from "@/components/notice";
import { MemberAccount } from "@/components/member-account";
import { assertCanAccessMember, requireAccess } from "@/lib/access";
import { prisma } from "@/lib/db";

export default async function MemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const access = await requireAccess();
  const { id } = await params;
  const query = await searchParams;
  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      currentSection: true,
      sectionAssignments: { include: { section: true }, orderBy: { startsOn: "desc" } },
      charges: { include: { concept: true, allocations: true, adjustments: true }, orderBy: [{ period: "desc" }, { concept: { name: "asc" } }] },
      incidents: { orderBy: { recordedAt: "desc" } },
    },
  });
  if (!member) notFound();
  assertCanAccessMember(access, member);
  return <div className="page"><header className="page-header"><div><p className="eyebrow">Estado de cuenta</p><h1>{member.displayName}</h1><p className="lede">Obligaciones, aplicaciones e incidencias con trazabilidad separada.</p></div></header><Notice success={query.success} error={query.error} /><MemberAccount member={member} /></div>;
}
