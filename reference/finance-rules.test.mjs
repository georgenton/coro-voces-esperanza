import test from 'node:test';
import assert from 'node:assert/strict';
import {
  usdToCents, classifyLegacyCell, chargeForPeriod, accountStatus,
  validateAllocationPlan, suggestMember, bankReferenceKey, externalNetFlow,
} from './finance-rules.mjs';

test('5.00 USD son 500 centavos', () => assert.equal(usdToCents('5.00'), 500));
test('acepta coma decimal y un decimal', () => assert.equal(usdToCents('2,5'), 250));
test('rechaza precisión mayor a dos decimales', () => assert.throws(() => usdToCents('5.001')));
test('rechaza negativos y valores no textuales', () => {
  assert.throws(() => usdToCents('-1')); assert.throws(() => usdToCents(5));
});
test('rechaza entero monetario fuera del rango seguro', () => {
  assert.throws(() => usdToCents('999999999999999999999'));
});
test('vacío no es deuda ni pago', () => {
  assert.deepEqual(classifyLegacyCell(null), {kind:'UNSPECIFIED',amountCents:null});
});
test('X mensual propone exención histórica', () => {
  assert.equal(classifyLegacyCell(' x ').kind,'EXEMPT_MARKER');
});
test('X en deuda anterior no significa pausa', () => {
  assert.equal(classifyLegacyCell('X','OPENING_DEBT').kind,'NO_NUMERIC_OPENING_DEBT');
});
test('5 histórico de parqueadero se conserva en 500', () => {
  assert.equal(classifyLegacyCell(5).amountCents,500);
});
test('cero registrado no es un pago positivo', () => {
  assert.equal(classifyLegacyCell(0).kind,'RECORDED_ZERO');
});
test('texto no monetario se rechaza para revisión', () => {
  assert.throws(() => classifyLegacyCell('pendiente'));
});
test('febrero activo genera 500', () => {
  assert.equal(chargeForPeriod({period:'2026-02',feeCents:500}).amountCents,500);
});
test('enero se excluye', () => {
  assert.equal(chargeForPeriod({period:'2027-01',feeCents:500}).amountCents,0);
});
test('junio 2026 exento no exime junio 2027', () => {
  const common={feeCents:500,exemptPeriods:['2026-06']};
  assert.equal(chargeForPeriod({...common,period:'2026-06'}).amountCents,0);
  assert.equal(chargeForPeriod({...common,period:'2027-06'}).amountCents,500);
});
test('pausa aprobada no genera cargo', () => {
  assert.equal(chargeForPeriod({period:'2026-05',feeCents:500,eligible:false}).amountCents,0);
});
test('vigencia desconocida queda pendiente', () => {
  assert.equal(chargeForPeriod({period:'2026-05',feeCents:500,eligibilityConfirmed:false}).status,'REVIEW_REQUIRED');
});
test('período inválido se rechaza', () => {
  assert.throws(() => chargeForPeriod({period:'2026-13',feeCents:500}));
});
test('al día este año puede tener deuda acumulada', () => {
  assert.deepEqual(accountStatus({previousDebtCents:1500,currentDebtCents:0}),
    {currentYearUpToDate:true,noAccumulatedDebt:false,totalDebtCents:1500});
});
test('deudas se suman pero no se convierten en ingresos', () => {
  assert.equal(accountStatus({previousDebtCents:15500,currentDebtCents:29500}).totalDebtCents,45000);
});
const charges=[
  {id:'q1',memberId:'a',outstandingCents:500},
  {id:'q2',memberId:'b',outstandingCents:500},
  {id:'p2',memberId:'b',outstandingCents:200},
];
test('un depósito 12 admite cuotas 5+5 y parqueadero 2', () => {
  const result=validateAllocationPlan({totalCents:1200,charges,parts:[
    {memberId:'a',amountCents:500,allocations:[{chargeId:'q1',amountCents:500}]},
    {memberId:'b',amountCents:700,allocations:[{chargeId:'q2',amountCents:500},{chargeId:'p2',amountCents:200}]},
  ]});
  assert.equal(result.unidentifiedCents,0);
  assert.equal(result.memberCredits.reduce((sum,p)=>sum+p.creditCents,0),0);
});
test('remanente no identificado queda explícito', () => {
  assert.equal(validateAllocationPlan({totalCents:1000,charges,parts:[
    {memberId:'a',amountCents:500,allocations:[{chargeId:'q1',amountCents:500}]},
  ]}).unidentifiedCents,500);
});
test('remanente identificado queda como crédito', () => {
  const result=validateAllocationPlan({totalCents:1000,charges,parts:[
    {memberId:'a',amountCents:1000,allocations:[{chargeId:'q1',amountCents:500}]},
  ]});
  assert.equal(result.memberCredits[0].creditCents,500);
});
test('no repartir más que el depósito', () => {
  assert.throws(()=>validateAllocationPlan({totalCents:500,parts:[
    {memberId:'a',amountCents:600},
  ]}));
});
test('no aplicar a otro miembro', () => {
  assert.throws(()=>validateAllocationPlan({totalCents:500,charges,parts:[
    {memberId:'a',amountCents:500,allocations:[{chargeId:'q2',amountCents:500}]},
  ]}));
});
test('suma de partes no puede sobreaplicar un cargo', () => {
  assert.throws(()=>validateAllocationPlan({totalCents:800,charges,parts:[
    {memberId:'a',amountCents:400,allocations:[{chargeId:'q1',amountCents:400}]},
    {memberId:'a',amountCents:400,allocations:[{chargeId:'q1',amountCents:400}]},
  ]}));
});
test('no aplicar más que la parte aun con saldo de cargo suficiente', () => {
  assert.throws(()=>validateAllocationPlan({totalCents:500,charges,parts:[
    {memberId:'a',amountCents:300,allocations:[{chargeId:'q1',amountCents:400}]},
  ]}));
});
const members=[{id:'a',name:'Persona Álvarez'},{id:'b',name:'Persona Bravo'}];
test('tildes y espacios permiten solo propuesta inequívoca', () => {
  assert.deepEqual(suggestMember(' persona alvarez ',members),{status:'SUGGESTED_ONLY',memberIds:['a']});
});
test('nombre aproximado no asigna automáticamente', () => {
  assert.equal(suggestMember('Alvarez',members).status,'REVIEW_REQUIRED');
});
test('alias no aprobado no identifica', () => {
  assert.equal(suggestMember('Familia A',members,[{value:'Familia A',memberId:'a',approved:false}]).status,'REVIEW_REQUIRED');
});
test('alias aprobado sugiere, no confirma pago', () => {
  assert.equal(suggestMember('Familia A',members,[{value:'Familia A',memberId:'a',approved:true}]).status,'SUGGESTED_ONLY');
});
test('dos identidades exactas quedan ambiguas', () => {
  assert.equal(suggestMember('Persona Álvarez',[...members,{id:'c',name:'Persona Alvarez'}]).status,'REVIEW_REQUIRED');
});
test('misma referencia y cuenta generan clave estable', () => {
  const input={bank:'Banco Demo',accountId:'cuenta-demo',externalRef:'1234'};
  assert.equal(bankReferenceKey(input),bankReferenceKey({...input}));
});
test('misma referencia en cuentas distintas no se confunde', () => {
  const input={bank:'Banco Demo',accountId:'a',externalRef:'1234'};
  assert.notEqual(bankReferenceKey(input),bankReferenceKey({...input,accountId:'b'}));
});
test('sin referencia no hay bloqueo duro por monto o fecha', () => {
  assert.equal(bankReferenceKey({bank:'Banco Demo',accountId:'a',externalRef:null}),null);
});
test('transferencia interna no afecta flujo externo e interés sí', () => {
  assert.equal(externalNetFlow([
    {kind:'INTERNAL_TRANSFER',direction:'OUT',amountCents:10000,status:'CONFIRMED'},
    {kind:'INTERNAL_TRANSFER',direction:'IN',amountCents:10000,status:'CONFIRMED'},
    {kind:'INTEREST',direction:'IN',amountCents:100,status:'CONFIRMED'},
  ]),100);
});
test('evidencia pendiente no se cuenta como dinero confirmado', () => {
  assert.equal(externalNetFlow([{kind:'PAYMENT',direction:'IN',amountCents:500,status:'PENDING'}]),0);
});
test('entrada 10 menos gasto 4 producen flujo externo 6', () => {
  assert.equal(externalNetFlow([
    {kind:'PAYMENT',direction:'IN',amountCents:1000,status:'CONFIRMED'},
    {kind:'EXPENSE',direction:'OUT',amountCents:400,status:'CONFIRMED'},
  ]),600);
});
