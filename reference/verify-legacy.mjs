/**
 * Verifica el staging local. No certifica movimientos bancarios ni deuda real.
 * No imprime nombres u otros datos personales.
 */
import {existsSync, readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {classifyLegacyCell, chargeForPeriod, accountStatus} from './finance-rules.mjs';

const file = new URL('../private/cuotas-2026-staging.json', import.meta.url);
if (!existsSync(file)) {
  console.log('OMITIDO: no existe el staging privado; solo se verificaron las reglas públicas.');
  process.exit(0);
}
const data = JSON.parse(readFileSync(file,'utf8'));
assert.equal(data.schemaVersion,1);
assert.equal(data.members.length,37);
const totals={all:0,toAug:0,future:0,previousDebt:0,currentDebt:0,totalDebt:0,currentDebtors:0,totalDebtors:0};
for (const member of data.members) {
  assert.equal(member.approvalStatus,'REVIEW_REQUIRED');
  let paidToAug=0,expectedToAug=0;
  for(const month of member.months) {
    const cell=classifyLegacyCell(month.raw);
    const payment=cell.amountCents ?? 0;
    totals.all+=payment;
    if(month.period<='2026-08') {
      paidToAug+=payment;totals.toAug+=payment;
      expectedToAug+=chargeForPeriod({
        period:month.period,feeCents:500,eligible:cell.kind!=='EXEMPT_MARKER',
        exemptPeriods:['2026-06']
      }).amountCents;
    } else totals.future+=payment;
  }
  const currentDebt=Math.max(0,expectedToAug-paidToAug);
  const state=accountStatus({previousDebtCents:member.openingDebt2025Cents,currentDebtCents:currentDebt});
  assert.equal(expectedToAug,member.expectedToAugustCents);
  assert.equal(paidToAug,member.paymentsToAugustCents);
  assert.equal(currentDebt,member.provisionalDebt2026Cents);
  assert.equal(state.totalDebtCents,member.provisionalTotalDebtCents);
  totals.previousDebt+=member.openingDebt2025Cents;
  totals.currentDebt+=currentDebt;
  totals.totalDebt+=state.totalDebtCents;
  if(!state.currentYearUpToDate)totals.currentDebtors++;
  if(!state.noAccumulatedDebt)totals.totalDebtors++;
}
assert.deepEqual(totals,{all:88000,toAug:73000,future:15000,previousDebt:15500,currentDebt:29500,totalDebt:45000,currentDebtors:13,totalDebtors:14});
console.log('OK: 37 filas de staging verificadas, sin publicar datos personales.');
console.log('OK: 880 = 730 + 150; deuda provisional 155 + 295 = 450 USD.');
console.log('OK: 13 pendientes del año frente a 14 con deuda acumulada.');
console.log('ADVERTENCIA: hipótesis del informe; NO conciliación bancaria ni aprobación de saldos.');
