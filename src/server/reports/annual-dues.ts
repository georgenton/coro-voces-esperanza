import { AppRole, ChargeStatus, MemberStatus, Prisma } from "@/generated/prisma/client";
import { isGlobalReadRole, type AccessContext } from "@/lib/access";
import { prisma } from "@/lib/db";
import { chargeAmounts } from "@/server/reports/definitions";

const PAGE_SIZE = 30;
const MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));

export type AnnualDuesCellStatus = "PAID" | "PARTIAL" | "PENDING" | "NOT_DUE" | "FUTURE" | "ADVANCE" | "REVIEW" | "NOT_IMPORTED";

export function annualDuesCellStatus(input: {
  period: string;
  cutoffPeriod: string;
  memberStatus: MemberStatus;
  chargeCount: number;
  dueCents: number;
  appliedCents: number;
  pendingCents: number;
  conceptSystemKey?: string;
}): AnnualDuesCellStatus {
  if (input.period > input.cutoffPeriod) return input.appliedCents > 0 ? "ADVANCE" : "FUTURE";
  if ((input.conceptSystemKey ?? "MONTHLY_DUES") === "MONTHLY_DUES" && input.period.endsWith("-01") && input.chargeCount === 0) return "NOT_DUE";
  if (input.memberStatus === MemberStatus.REVIEW_REQUIRED) return "REVIEW";
  if (input.chargeCount === 0) return "NOT_IMPORTED";
  if (input.pendingCents === 0) return "PAID";
  if (input.appliedCents > 0) return "PARTIAL";
  return "PENDING";
}

export async function getAnnualDuesReport(input: {
  access: AccessContext;
  year: number;
  cutoffPeriod: string;
  conceptId?: string;
  sectionId?: string;
  memberStatus?: string;
  query?: string;
  page?: number;
  paginate?: boolean;
}) {
  if (!Number.isSafeInteger(input.year) || input.year < 2020 || input.year > 2100) throw new Error("Año inválido.");
  if (!new RegExp(`^${input.year}-(0[1-9]|1[0-2])$`).test(input.cutoffPeriod)) throw new Error("El corte debe pertenecer al año consultado.");
  const global = isGlobalReadRole(input.access);
  const requestedSection = input.sectionId?.trim() || undefined;
  const allowedSection = global ? requestedSection : requestedSection && input.access.sectionIds.includes(requestedSection) ? requestedSection : undefined;
  const status = Object.values(MemberStatus).includes(input.memberStatus as MemberStatus) ? input.memberStatus as MemberStatus : undefined;
  const query = input.query?.trim().slice(0, 100) || undefined;
  const page = Number.isSafeInteger(input.page) && input.page && input.page > 0 ? Math.min(input.page, 10_000) : 1;
  const concepts = await prisma.billingConcept.findMany({
    where: { active: true, systemKey: { not: "OPENING_DEBT" } },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, systemKey: true },
  });
  const selectedConcept = concepts.find(({ id }) => id === input.conceptId)
    ?? concepts.find(({ systemKey }) => systemKey === "MONTHLY_DUES")
    ?? concepts[0];
  if (!selectedConcept) throw new Error("No hay conceptos de cobro activos para construir la matriz.");
  const scope: Prisma.MemberWhereInput = global
    ? {}
    : input.access.roles.includes(AppRole.JEFE_DE_CUERDA)
      ? { currentSectionId: { in: allowedSection ? [allowedSection] : input.access.sectionIds } }
      : input.access.memberId
        ? { id: input.access.memberId }
        : { id: { in: [] } };
  const where: Prisma.MemberWhereInput = {
    ...scope,
    ...(global && allowedSection ? { currentSectionId: allowedSection } : {}),
    ...(status ? { status } : {}),
    ...(query ? { OR: [
      { displayName: { contains: query, mode: "insensitive" } },
      { originalName: { contains: query, mode: "insensitive" } },
    ] } : {}),
  };

  const [members, sections] = await Promise.all([
    prisma.member.findMany({
      where,
      include: {
        currentSection: true,
        charges: {
          where: {
            status: { not: ChargeStatus.VOIDED },
            conceptId: { in: [selectedConcept.id] },
            period: { lte: `${input.year}-12` },
          },
          include: { concept: true, allocations: true, adjustments: true },
        },
        paymentParts: {
          where: { OR: [{ movement: { status: "CONFIRMED" } }, { isLegacy: true, cashEffect: false }] },
          include: { allocations: { select: { amountCents: true, charge: { select: { period: true, conceptId: true } } } } },
        },
      },
      orderBy: [{ currentSection: { sortOrder: "asc" } }, { displayName: "asc" }],
    }),
    prisma.voiceSection.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  const rows = members.map((member) => {
    const monthlyCharges = member.charges.filter((charge) => charge.conceptId === selectedConcept.id && charge.period.startsWith(`${input.year}-`));
    const priorCharges = member.charges.filter((charge) => charge.conceptId === selectedConcept.id && charge.period < `${input.year}-01`);
    const priorDebtCents = priorCharges.reduce((sum, charge) => sum + chargeAmounts(charge).pendingCents, 0);
    const creditCents = member.paymentParts.reduce((sum, part) => {
      const applied = part.allocations.reduce((value, allocation) => value + allocation.amountCents, 0);
      return sum + Math.max(0, part.amountCents - applied);
    }, 0);
    const advanceCents = member.paymentParts.reduce((sum, part) => sum + part.allocations
      .filter(({ charge }) => charge.conceptId === selectedConcept.id && charge.period > input.cutoffPeriod)
      .reduce((value, allocation) => value + allocation.amountCents, 0), 0);
    const months = MONTHS.map((month) => {
      const period = `${input.year}-${month}`;
      const charges = monthlyCharges.filter((charge) => charge.period === period);
      const amounts = charges.reduce((summary, charge) => {
        const value = chargeAmounts(charge);
        summary.dueCents += value.dueCents;
        summary.appliedCents += value.appliedCents;
        summary.pendingCents += value.pendingCents;
        return summary;
      }, { dueCents: 0, appliedCents: 0, pendingCents: 0 });
      const cellStatus = annualDuesCellStatus({
        period,
        cutoffPeriod: input.cutoffPeriod,
        memberStatus: member.status,
        chargeCount: charges.length,
        conceptSystemKey: selectedConcept.systemKey,
        ...amounts,
      });
      return {
        period,
        ...amounts,
        status: cellStatus,
        charges: charges.map((charge) => ({
          id: charge.id,
          amountCents: charge.amountCents,
          dueOn: charge.dueOn?.toISOString() ?? null,
          source: charge.source,
          sourceReference: charge.sourceReference,
          adjustmentsCents: charge.adjustments.reduce((sum, adjustment) => sum + adjustment.amountCents, 0),
          allocationsCents: charge.allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0),
        })),
      };
    });
    const dueAtCutoffCents = months.filter(({ period }) => period <= input.cutoffPeriod).reduce((sum, month) => sum + month.dueCents, 0);
    const appliedAtCutoffCents = months.filter(({ period }) => period <= input.cutoffPeriod).reduce((sum, month) => sum + month.appliedCents, 0);
    const pendingAtCutoffCents = priorDebtCents + months.filter(({ period }) => period <= input.cutoffPeriod).reduce((sum, month) => sum + month.pendingCents, 0);
    return {
      id: member.id,
      displayName: member.displayName,
      status: member.status,
      section: member.currentSection ? { id: member.currentSection.id, name: member.currentSection.name } : null,
      priorDebtCents,
      dueAtCutoffCents,
      appliedAtCutoffCents,
      pendingAtCutoffCents,
      creditCents,
      advanceCents,
      months,
    };
  });
  const totals = rows.reduce((summary, row) => {
    summary.priorDebtCents += row.priorDebtCents;
    summary.dueAtCutoffCents += row.dueAtCutoffCents;
    summary.appliedAtCutoffCents += row.appliedAtCutoffCents;
    summary.pendingAtCutoffCents += row.pendingAtCutoffCents;
    summary.creditCents += row.creditCents;
    summary.advanceCents += row.advanceCents;
    return summary;
  }, { priorDebtCents: 0, dueAtCutoffCents: 0, appliedAtCutoffCents: 0, pendingAtCutoffCents: 0, creditCents: 0, advanceCents: 0 });
  const paginate = input.paginate !== false;
  const visibleRows = paginate ? rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : rows;

  return {
    year: input.year,
    cutoffPeriod: input.cutoffPeriod,
    filters: { conceptId: selectedConcept.id, sectionId: allowedSection, memberStatus: status, query },
    concepts,
    selectedConcept,
    sections: global ? sections : sections.filter(({ id }) => input.access.sectionIds.includes(id)),
    rows: visibleRows,
    totals,
    pagination: { page, pageSize: paginate ? PAGE_SIZE : rows.length || 1, totalRows: rows.length, totalPages: paginate ? Math.max(1, Math.ceil(rows.length / PAGE_SIZE)) : 1 },
  };
}
