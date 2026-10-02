import "dotenv/config";
import { MemberStatus } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/db";
import { normalizeName } from "../src/lib/names";
import { createInitialAdmin, inspectInitialAdmin } from "../src/server/auth/initial-admin";
import { describeInitialAdminConflict } from "../src/server/auth/initial-admin-policy";

async function seedCatalogs() {
  const sectionNames = ["Soprano 1", "Soprano 2", "Contralto 1", "Contralto 2", "Tenor 1", "Tenor 2", "Bajo", "Barítono"];
  for (const [index, name] of sectionNames.entries()) {
    await prisma.voiceSection.upsert({ where: { name }, update: { sortOrder: index + 1, isActive: true }, create: { name, sortOrder: index + 1 } });
  }

  const dues = await prisma.billingConcept.upsert({
    where: { systemKey: "MONTHLY_DUES" },
    update: { name: "Cuota mensual", defaultAmountCents: 500 },
    create: { systemKey: "MONTHLY_DUES", name: "Cuota mensual", defaultAmountCents: 500 },
  });
  const parking = await prisma.billingConcept.upsert({
    where: { systemKey: "PARKING" },
    update: { name: "Parqueadero", defaultAmountCents: 200 },
    create: { systemKey: "PARKING", name: "Parqueadero", defaultAmountCents: 200 },
  });
  await prisma.billingConcept.upsert({
    where: { systemKey: "ACTIVITY" },
    update: { name: "Actividad", restrictedCredit: true },
    create: { systemKey: "ACTIVITY", name: "Actividad", defaultAmountCents: 0, restrictedCredit: true },
  });
  await prisma.billingConcept.upsert({
    where: { systemKey: "OPENING_DEBT" },
    update: { name: "Deuda anterior aprobada" },
    create: { systemKey: "OPENING_DEBT", name: "Deuda anterior aprobada", defaultAmountCents: 0 },
  });

  let duesRule = await prisma.chargeRule.findFirst({ where: { conceptId: dues.id, startsPeriod: "2026-02", endsPeriod: null } });
  duesRule ??= await prisma.chargeRule.create({ data: { conceptId: dues.id, startsPeriod: "2026-02", amountCents: 500, excludeJanuary: true } });
  const juneException = await prisma.chargeException.findFirst({ where: { ruleId: duesRule.id, memberId: null, period: "2026-06" } });
  if (!juneException) await prisma.chargeException.create({ data: { ruleId: duesRule.id, memberId: null, period: "2026-06", chargeable: false, reason: "Excepción histórica aprobada para cuotas de junio de 2026" } });
  const parkingRule = await prisma.chargeRule.findFirst({ where: { conceptId: parking.id, startsPeriod: "2026-02", endsPeriod: null } });
  if (!parkingRule) await prisma.chargeRule.create({ data: { conceptId: parking.id, startsPeriod: "2026-02", amountCents: 200, excludeJanuary: true, eligibility: "APPROVED_PARKING" } });

  for (const account of [{ name: "Cuenta operativa", kind: "BANK" }, { name: "Efectivo", kind: "CASH" }, { name: "Ahorro flexible", kind: "SAVINGS" }]) {
    await prisma.financialAccount.upsert({ where: { name: account.name }, update: { kind: account.kind, isActive: true }, create: account });
  }
}

async function seedSyntheticMembers() {
  if (process.env.SEED_SYNTHETIC_DATA !== "true") return;
  const fixtures = [
    { displayName: "Alba Ejemplo", section: "Soprano 1" },
    { displayName: "Bruno Demostración", section: "Tenor 1" },
    { displayName: "Clara Ficticia", section: "Contralto 1" },
    { displayName: "Diego Muestra", section: "Bajo" },
  ];
  for (const fixture of fixtures) {
    const normalizedName = normalizeName(fixture.displayName);
    const existing = await prisma.member.findFirst({ where: { normalizedName, originalName: fixture.displayName } });
    if (existing) continue;
    const section = await prisma.voiceSection.findUniqueOrThrow({ where: { name: fixture.section } });
    const joinedOn = new Date("2026-02-01T00:00:00Z");
    const member = await prisma.member.create({ data: { displayName: fixture.displayName, originalName: fixture.displayName, normalizedName, status: MemberStatus.ACTIVE, currentSectionId: section.id, joinedOn, parkingReviewStatus: "APPROVED" } });
    await prisma.sectionAssignment.create({ data: { memberId: member.id, sectionId: section.id, startsOn: joinedOn, source: "SYNTHETIC_SEED" } });
  }
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim();
  if (!email && !password && !name) {
    console.log("Catálogos listos. Define SEED_ADMIN_NAME, SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD para crear el acceso inicial.");
    return;
  }
  if (!email || !name) throw new Error("El acceso inicial requiere nombre y correo explícitos.");
  const state = await inspectInitialAdmin(email);
  if (state.kind === "ACTIVE") {
    console.log("La cuenta SUPERADMIN inicial ya estaba activa. No se modificaron contraseña ni sesiones.");
    return;
  }
  const conflict = describeInitialAdminConflict(state);
  if (conflict) throw new Error(conflict);
  if (!password) throw new Error("El acceso inicial nuevo requiere una contraseña explícita.");
  await createInitialAdmin({ email, password, name });
  console.log("Acceso inicial SUPERADMIN creado.");
}

async function main() {
  await seedCatalogs();
  await seedSyntheticMembers();
  await seedAdmin();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
