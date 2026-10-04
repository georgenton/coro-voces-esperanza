import { auth } from "../../src/lib/auth";
import { prisma } from "../../src/lib/db";
import { AppRole, ChargeStatus, MemberStatus, MovementDirection, MovementStatus, MovementType } from "../../src/generated/prisma/client";

export const E2E_PASSWORD = "Voces-E2E-2026!";
export const E2E_USERS = {
  admin: "tesoreria.e2e@example.test",
  head: "jefatura.e2e@example.test",
  member: "miembro.e2e@example.test",
} as const;

function assertDisposableDatabase() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  const disposableName = /(?:test|e2e)/i.test(url.pathname);
  if (process.env.NODE_ENV !== "test" || !local || !disposableName) {
    throw new Error("E2E se negó a limpiar la base: requiere NODE_ENV=test y una base local cuyo nombre contenga test o e2e.");
  }
}

async function resetApplicationTables() {
  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
  `;
  if (!tables.length) throw new Error("La base E2E no tiene tablas migradas.");
  const names = tables.map(({ table_name }) => `"${table_name.replaceAll('"', '""')}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
}

async function createUser(email: string, name: string, role: AppRole) {
  const result = await auth.api.signUpEmail({ body: { email, password: E2E_PASSWORD, name } });
  await prisma.user.update({ where: { id: result.user.id }, data: { emailVerified: true } });
  await prisma.userRole.create({ data: { userId: result.user.id, role } });
  return result.user;
}

export default async function globalSetup() {
  assertDisposableDatabase();
  await resetApplicationTables();

  const [soprano, tenor] = await Promise.all([
    prisma.voiceSection.create({ data: { name: "Soprano E2E", sortOrder: 1 } }),
    prisma.voiceSection.create({ data: { name: "Tenor E2E", sortOrder: 2 } }),
  ]);
  const [monthly, parking, account] = await Promise.all([
    prisma.billingConcept.create({ data: { systemKey: "MONTHLY_DUES", name: "Cuota mensual", defaultAmountCents: 500 } }),
    prisma.billingConcept.create({ data: { systemKey: "PARKING", name: "Parqueadero", defaultAmountCents: 200 } }),
    prisma.financialAccount.create({ data: { name: "Cuenta E2E", kind: "BANK" } }),
  ]);
  const [admin, head, memberUser] = await Promise.all([
    createUser(E2E_USERS.admin, "Tesorería E2E", AppRole.SUPERADMIN),
    createUser(E2E_USERS.head, "Jefatura E2E", AppRole.JEFE_DE_CUERDA),
    createUser(E2E_USERS.member, "Miembro E2E", AppRole.MIEMBRO),
  ]);
  await prisma.userSectionScope.create({ data: { userId: head.id, sectionId: soprano.id } });

  const members = await Promise.all([
    prisma.member.create({ data: { displayName: "Alba Sintética", originalName: "Alba Sintética", normalizedName: "alba sintetica", status: MemberStatus.ACTIVE, currentSectionId: soprano.id, authUserId: memberUser.id, joinedOn: new Date("2026-02-01T00:00:00Z"), sourceReference: "e2e:member:alba" } }),
    prisma.member.create({ data: { displayName: "Bruno Sintético", originalName: "Bruno Sintético", normalizedName: "bruno sintetico", status: MemberStatus.ACTIVE, currentSectionId: tenor.id, joinedOn: new Date("2026-02-01T00:00:00Z"), sourceReference: "e2e:member:bruno" } }),
    prisma.member.create({ data: { displayName: "Clara Sintética", originalName: "Clara Sintética", normalizedName: "clara sintetica", status: MemberStatus.ACTIVE, currentSectionId: soprano.id, joinedOn: new Date("2026-02-01T00:00:00Z"), sourceReference: "e2e:member:clara" } }),
  ]);
  await prisma.sectionAssignment.createMany({ data: members.map((member) => ({ memberId: member.id, sectionId: member.currentSectionId!, startsOn: new Date("2026-02-01T00:00:00Z"), source: "E2E_SYNTHETIC", sourceReference: `e2e:section:${member.id}` })) });

  const charges = new Map<string, string>();
  for (const member of members) {
    for (let month = 2; month <= 10; month += 1) {
      const period = `2026-${String(month).padStart(2, "0")}`;
      const charge = await prisma.charge.create({ data: {
        dedupeKey: `e2e:charge:${member.id}:${period}`,
        memberId: member.id,
        conceptId: monthly.id,
        period,
        dueOn: new Date(`${period}-10T00:00:00Z`),
        amountCents: 500,
        status: ChargeStatus.PENDING,
        source: "E2E_SYNTHETIC",
        sourceReference: `e2e:charge-source:${member.id}:${period}`,
      } });
      charges.set(`${member.id}:${period}`, charge.id);
    }
  }
  await prisma.charge.create({ data: { dedupeKey: `e2e:parking:${members[0].id}:2026-09`, memberId: members[0].id, conceptId: parking.id, period: "2026-09", dueOn: new Date("2026-09-10T00:00:00Z"), amountCents: 200, source: "E2E_SYNTHETIC" } });

  const opening = await prisma.moneyMovement.create({ data: {
    dedupeKey: "e2e:movement:opening", accountId: account.id, type: MovementType.OPENING_BALANCE, direction: MovementDirection.IN,
    status: MovementStatus.CONFIRMED, amountCents: 10000, occurredAt: new Date("2026-08-31T15:00:00-05:00"), description: "Apertura sintética E2E", source: "E2E_SYNTHETIC", confirmedAt: new Date("2026-08-31T15:00:00-05:00"), confirmedById: admin.id,
  } });
  void opening;
  const payment = await prisma.moneyMovement.create({ data: {
    dedupeKey: "e2e:movement:payment", accountId: account.id, type: MovementType.PAYMENT, direction: MovementDirection.IN,
    status: MovementStatus.CONFIRMED, amountCents: 750, occurredAt: new Date("2026-09-05T10:30:00-05:00"), description: "Pago coral sintético", externalReference: "E2E-ING-001", source: "E2E_SYNTHETIC", confirmedAt: new Date("2026-09-05T10:31:00-05:00"), confirmedById: admin.id,
  } });
  const albaPart = await prisma.paymentPart.create({ data: { movementId: payment.id, memberId: members[0].id, amountCents: 500, receivedAt: payment.occurredAt, source: "E2E_SYNTHETIC", sourceReference: "e2e:part:alba" } });
  const brunoPart = await prisma.paymentPart.create({ data: { movementId: payment.id, memberId: members[1].id, amountCents: 250, receivedAt: payment.occurredAt, source: "E2E_SYNTHETIC", sourceReference: "e2e:part:bruno" } });
  await prisma.allocation.createMany({ data: [
    { paymentPartId: albaPart.id, chargeId: charges.get(`${members[0].id}:2026-09`)!, amountCents: 500, appliedAt: payment.occurredAt },
    { paymentPartId: brunoPart.id, chargeId: charges.get(`${members[1].id}:2026-09`)!, amountCents: 250, appliedAt: payment.occurredAt },
  ] });
  await prisma.charge.update({ where: { id: charges.get(`${members[0].id}:2026-09`)! }, data: { status: ChargeStatus.PAID } });
  await prisma.charge.update({ where: { id: charges.get(`${members[1].id}:2026-09`)! }, data: { status: ChargeStatus.PARTIAL } });
  await prisma.moneyMovement.create({ data: {
    dedupeKey: "e2e:movement:expense", accountId: account.id, type: MovementType.EXPENSE, direction: MovementDirection.OUT,
    status: MovementStatus.CONFIRMED, amountCents: 325, occurredAt: new Date("2026-09-18T16:00:00-05:00"), description: "Partituras sintéticas", externalReference: "E2E-EGR-001", source: "E2E_SYNTHETIC", confirmedAt: new Date("2026-09-18T16:01:00-05:00"), confirmedById: admin.id,
  } });

  await prisma.$disconnect();
}
