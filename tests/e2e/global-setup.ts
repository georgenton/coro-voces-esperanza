import { auth } from "../../src/lib/auth";
import { prisma } from "../../src/lib/db";
import { AppRole, ChargeStatus, ImportStatus, MemberStatus, MovementDirection, MovementStatus, MovementType, ReviewStatus } from "../../src/generated/prisma/client";

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

function sourceCell(input: {
  batchId: string;
  sheetName: string;
  reference: string;
  row: number;
  column: number;
  value: string;
  originalDate?: string;
  formula?: string;
  cachedValue?: string;
}) {
  return {
    batchId: input.batchId,
    sheetName: input.sheetName,
    cellReference: input.reference,
    rowNumber: input.row,
    columnNumber: input.column,
    valueType: input.formula ? "formula" : input.originalDate ? "date" : /^\d+(?:\.\d+)?$/.test(input.value) ? "number" : "text",
    literalValue: input.formula ? null : input.value,
    formula: input.formula ?? null,
    cachedValue: input.cachedValue ?? null,
    displayValue: input.value,
    originalDate: input.originalDate ?? null,
  };
}

async function createSyntheticHistoricalSource(actorId: string) {
  const batch = await prisma.importBatch.create({
    data: {
      sha256: "e".repeat(64),
      originalName: "fuente-historica-sintetica-e2e.xlsx",
      storageKey: "e2e/fuente-historica-sintetica-e2e.xlsx",
      sizeBytes: 4096,
      status: ImportStatus.REVIEW_REQUIRED,
      sheetCount: 3,
      importedById: actorId,
      declaredCutoff: new Date("2026-10-01T05:00:00.000Z"),
      cutoffTimezone: "America/Guayaquil",
      sourceVersion: "e2e-visual-2026-10",
      summary: { synthetic: true, purpose: "visual-e2e" },
    },
  });

  await prisma.importSheet.createMany({ data: [
    { batchId: batch.id, name: "SEPTIEMBRE 2026", physicalOrder: 1, kind: "MONTHLY_MOVEMENTS", nominalPeriod: "2026-09", coverageStatus: "DOCUMENTED", rowCount: 6, columnCount: 7, declaredRange: "A1:G6", blockYears: [2026] },
    { batchId: batch.id, name: "OCTUBRE 2026", physicalOrder: 2, kind: "MONTHLY_MOVEMENTS", nominalPeriod: "2026-10", coverageStatus: "PARTIAL", rowCount: 5, columnCount: 7, declaredRange: "A1:G5", blockYears: [2026] },
    { batchId: batch.id, name: "1.a SOLO CUOTAS 2026", physicalOrder: 3, kind: "DUES_MATRIX", coverageStatus: "DOCUMENTED", rowCount: 9, columnCount: 15, declaredRange: "A1:O9", blockYears: [2026] },
  ] });

  const monthlyRows = [
    { sheetName: "SEPTIEMBRE 2026", rowNumber: 2, sourceKind: "MONTHLY_OPENING_CONTEXT", nominalPeriod: "2026-09", rawText: "31/08/2026 | Saldo anterior sintético | 100.00" },
    { sheetName: "SEPTIEMBRE 2026", rowNumber: 3, sourceKind: "MONTHLY_MOVEMENT_CANDIDATE", nominalPeriod: "2026-09", rawText: "05/09/2026 | Aporte coral sintético | 15.00 | Observación breve" },
    { sheetName: "SEPTIEMBRE 2026", rowNumber: 4, sourceKind: "MONTHLY_MOVEMENT_CANDIDATE", nominalPeriod: "2026-09", rawText: "18/09/2026 | Material musical sintético | 7.25 | Observación extensa" },
    { sheetName: "OCTUBRE 2026", rowNumber: 3, sourceKind: "MONTHLY_MOVEMENT_CANDIDATE", nominalPeriod: "2026-10", rawText: "01/10/2026 | Aporte parcial sintético | 5.00 | Mes parcial" },
  ];
  const matrixRows = [
    { rowNumber: 4, section: "Dirección", number: "1", name: "Directora Sintética" },
    { rowNumber: 5, section: "Soprano E2E", number: "2", name: "Alba Sintética" },
    { rowNumber: 6, section: "Soprano E2E", number: "3", name: "Nombre Sintético Deliberadamente Extenso" },
    { rowNumber: 7, section: "Tenor E2E", number: "4", name: "Bruno Sintético" },
    { rowNumber: 8, section: "", number: "", name: "Candidata Sintética Sin Cuerda" },
  ];
  await prisma.importRow.createMany({ data: [
    ...monthlyRows.map((row) => ({
      batchId: batch.id,
      ...row,
      recordFingerprint: `e2e:${row.sheetName}:${row.rowNumber}`,
      contentFingerprint: `e2e-content:${row.sheetName}:${row.rowNumber}`,
      semanticKey: `e2e-semantic:${row.sheetName}:${row.rowNumber}`,
      firstCellReference: `A${row.rowNumber}`,
      lastCellReference: `G${row.rowNumber}`,
      status: ReviewStatus.PENDING,
    })),
    ...matrixRows.map((row) => ({
      batchId: batch.id,
      sheetName: "1.a SOLO CUOTAS 2026",
      rowNumber: row.rowNumber,
      rawText: `${row.section} | ${row.number} | ${row.name}`,
      recordFingerprint: `e2e:matrix:${row.rowNumber}`,
      contentFingerprint: `e2e-content:matrix:${row.rowNumber}`,
      semanticKey: `e2e-semantic:matrix:${row.rowNumber}`,
      sourceKind: "MATRIX_PERSON_CANDIDATE",
      firstCellReference: `A${row.rowNumber}`,
      lastCellReference: `O${row.rowNumber}`,
      status: ReviewStatus.PENDING,
    })),
  ] });

  const cells = [
    sourceCell({ batchId: batch.id, sheetName: "SEPTIEMBRE 2026", reference: "A2", row: 2, column: 1, value: "31/08/2026", originalDate: "2026-08-31" }),
    sourceCell({ batchId: batch.id, sheetName: "SEPTIEMBRE 2026", reference: "B2", row: 2, column: 2, value: "Saldo anterior sintético" }),
    sourceCell({ batchId: batch.id, sheetName: "SEPTIEMBRE 2026", reference: "G2", row: 2, column: 7, value: "100.00" }),
    sourceCell({ batchId: batch.id, sheetName: "SEPTIEMBRE 2026", reference: "A3", row: 3, column: 1, value: "05/09/2026", originalDate: "2026-09-05" }),
    sourceCell({ batchId: batch.id, sheetName: "SEPTIEMBRE 2026", reference: "B3", row: 3, column: 2, value: "Aporte coral sintético" }),
    sourceCell({ batchId: batch.id, sheetName: "SEPTIEMBRE 2026", reference: "C3", row: 3, column: 3, value: "15.00" }),
    sourceCell({ batchId: batch.id, sheetName: "SEPTIEMBRE 2026", reference: "F3", row: 3, column: 6, value: "Observación breve" }),
    sourceCell({ batchId: batch.id, sheetName: "SEPTIEMBRE 2026", reference: "A4", row: 4, column: 1, value: "18/09/2026", originalDate: "2026-09-18" }),
    sourceCell({ batchId: batch.id, sheetName: "SEPTIEMBRE 2026", reference: "D4", row: 4, column: 4, value: "Material musical sintético" }),
    sourceCell({ batchId: batch.id, sheetName: "SEPTIEMBRE 2026", reference: "E4", row: 4, column: 5, value: "7.25" }),
    sourceCell({ batchId: batch.id, sheetName: "SEPTIEMBRE 2026", reference: "F4", row: 4, column: 6, value: "Observación sintética extensa para comprobar expansión sin añadir una columna técnica permanente de procedencia." }),
    sourceCell({ batchId: batch.id, sheetName: "OCTUBRE 2026", reference: "A3", row: 3, column: 1, value: "01/10/2026", originalDate: "2026-10-01" }),
    sourceCell({ batchId: batch.id, sheetName: "OCTUBRE 2026", reference: "B3", row: 3, column: 2, value: "Aporte parcial sintético" }),
    sourceCell({ batchId: batch.id, sheetName: "OCTUBRE 2026", reference: "C3", row: 3, column: 3, value: "5.00" }),
    sourceCell({ batchId: batch.id, sheetName: "OCTUBRE 2026", reference: "F3", row: 3, column: 6, value: "Cobertura parcial sintética" }),
  ];
  const matrixValues = ["5.00", "5.00", "X", "", "5.00", "texto", "5.00", "5.00", "", "5.00", "5.00"];
  for (const row of matrixRows) {
    const rowValues = [row.section, row.number, row.name, row.rowNumber === 5 ? "10.00" : ""];
    rowValues.forEach((value, index) => {
      if (value) cells.push(sourceCell({ batchId: batch.id, sheetName: "1.a SOLO CUOTAS 2026", reference: `${String.fromCharCode(65 + index)}${row.rowNumber}`, row: row.rowNumber, column: index + 1, value }));
    });
    matrixValues.forEach((baseValue, index) => {
      const column = index + 5;
      const value = row.rowNumber === 6 && index === 4 ? "X" : row.rowNumber === 7 && index === 6 ? "" : baseValue;
      if (!value) return;
      const reference = `${String.fromCharCode(65 + column - 1)}${row.rowNumber}`;
      cells.push(sourceCell({ batchId: batch.id, sheetName: "1.a SOLO CUOTAS 2026", reference, row: row.rowNumber, column, value, ...(row.rowNumber === 4 && index === 10 ? { formula: "SUM(E4:O4)", cachedValue: "50.00" } : {}) }));
    });
  }
  await prisma.importCell.createMany({ data: cells });
  await prisma.importIssue.createMany({ data: [
    { batchId: batch.id, code: "E2E_PARTIAL_MONTH", sheetName: "OCTUBRE 2026", message: "Mes sintético parcial para prueba visual.", decisionNeeded: "Mantener como pendiente." },
    { batchId: batch.id, code: "E2E_MARK_REVIEW", sheetName: "1.a SOLO CUOTAS 2026", cellReference: "G5", message: "Marca sintética pendiente de interpretación.", decisionNeeded: "No convertir en pago." },
  ] });
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

  await createSyntheticHistoricalSource(admin.id);

  await prisma.$disconnect();
}
