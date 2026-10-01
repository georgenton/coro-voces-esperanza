/**
 * Reglas puras de referencia para Codex. No es una aplicación ni un sistema
 * de autorización, persistencia, firma QR o contabilidad completo.
 * Todos los importes internos están expresados en centavos enteros.
 */
import { createHash } from 'node:crypto';

function integerCents(value, label, allowZero = true) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new TypeError(`${label}: se requiere un entero de centavos válido`);
  }
  return value;
}
function safeSum(values) {
  const result = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(result)) throw new RangeError('Suma fuera del rango seguro');
  return result;
}

/** Texto decimal sin separadores de miles; no aritmética binaria de dólares. */
export function usdToCents(text) {
  if (typeof text !== 'string' || !/^\d+(?:[.,]\d{1,2})?$/.test(text.trim())) {
    throw new TypeError('Importe inválido; usar por ejemplo "5.00"');
  }
  const [whole, fraction = ''] = text.trim().replace(',', '.').split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Importe excesivo');
  return Number(result);
}

/** La semántica de X depende de la columna, no del texto aislado. */
export function classifyLegacyCell(value, context = 'MONTH') {
  if (!['MONTH', 'OPENING_DEBT'].includes(context)) throw new TypeError('Contexto inválido');
  if (value === null || value === undefined || String(value).trim() === '') {
    return { kind: 'UNSPECIFIED', amountCents: null };
  }
  if (String(value).trim().toUpperCase() === 'X') {
    return context === 'MONTH'
      ? { kind: 'EXEMPT_MARKER', amountCents: null }
      : { kind: 'NO_NUMERIC_OPENING_DEBT', amountCents: null };
  }
  const amountCents = usdToCents(String(value));
  return { kind: context === 'MONTH'
    ? (amountCents === 0 ? 'RECORDED_ZERO' : 'RECORDED_PAYMENT')
    : 'RECORDED_OPENING_DEBT', amountCents };
}

/** Vigencia, exenciones e importe se suministran después de validación humana. */
export function chargeForPeriod({
  period, feeCents, eligibilityConfirmed = true, eligible = true,
  exemptMonths = [1], exemptPeriods = []
}) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period ?? '')) {
    throw new TypeError('Período inválido: usar YYYY-MM');
  }
  integerCents(feeCents, 'Tarifa');
  if (!eligibilityConfirmed) return { status: 'REVIEW_REQUIRED', amountCents: null };
  if (exemptMonths.includes(Number(period.slice(-2)))) {
    return { status: 'NOT_CHARGEABLE', amountCents: 0, reason: 'EXEMPT_MONTH' };
  }
  if (exemptPeriods.includes(period)) {
    return { status: 'NOT_CHARGEABLE', amountCents: 0, reason: 'EXEMPT_PERIOD' };
  }
  if (!eligible) return { status: 'NOT_CHARGEABLE', amountCents: 0, reason: 'NOT_ELIGIBLE' };
  return { status: 'CHARGEABLE', amountCents: feeCents };
}

export function accountStatus({ previousDebtCents, currentDebtCents }) {
  integerCents(previousDebtCents, 'Deuda anterior');
  integerCents(currentDebtCents, 'Deuda actual');
  const totalDebtCents = safeSum([previousDebtCents, currentDebtCents]);
  return {
    currentYearUpToDate: currentDebtCents === 0,
    noAccumulatedDebt: totalDebtCents === 0,
    totalDebtCents,
  };
}

/**
 * Valida un plan contra saldos AUTORITATIVOS suministrados por el servidor.
 * En la app debe repetirse dentro de una transacción con bloqueo/concurrencia.
 */
export function validateAllocationPlan({ totalCents, parts, charges = [] }) {
  integerCents(totalCents, 'Total', false);
  if (!Array.isArray(parts) || !Array.isArray(charges)) throw new TypeError('Plan inválido');
  const byId = new Map();
  for (const charge of charges) {
    if (!charge.id || !charge.memberId || byId.has(charge.id)) throw new Error('Cargo inválido o repetido');
    integerCents(charge.outstandingCents, 'Saldo cargo');
    byId.set(charge.id, charge);
  }
  const spent = new Map();
  const memberCredits = [];
  let identifiedCents = 0;
  for (const part of parts) {
    if (typeof part.memberId !== 'string' || !part.memberId.trim()) throw new Error('Falta miembro');
    integerCents(part.amountCents, 'Parte', false);
    identifiedCents = safeSum([identifiedCents, part.amountCents]);
    const allocations = part.allocations ?? [];
    if (!Array.isArray(allocations)) throw new TypeError('Aplicaciones inválidas');
    let applied = 0;
    for (const allocation of allocations) {
      integerCents(allocation.amountCents, 'Aplicación', false);
      const charge = byId.get(allocation.chargeId);
      if (!charge || charge.memberId !== part.memberId) throw new Error('Cargo no pertenece al miembro');
      applied = safeSum([applied, allocation.amountCents]);
      const accumulated = safeSum([spent.get(charge.id) ?? 0, allocation.amountCents]);
      if (accumulated > charge.outstandingCents) throw new Error('Sobreaplicación del cargo');
      spent.set(charge.id, accumulated);
    }
    if (applied > part.amountCents) throw new Error('Aplicaciones exceden la parte');
    memberCredits.push({ memberId: part.memberId, creditCents: part.amountCents - applied });
  }
  if (identifiedCents > totalCents) throw new Error('Partes exceden el depósito');
  return { identifiedCents, unidentifiedCents: totalCents - identifiedCents, memberCredits };
}

export function normalizeName(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es').replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Solo sugiere por nombre exacto o alias explícitamente aprobado. Nunca publica. */
export function suggestMember(payerName, members, aliases = []) {
  const normalized = normalizeName(payerName);
  if (!normalized) return { status: 'REVIEW_REQUIRED', memberIds: [] };
  const knownIds = new Set(members.map(member => member.id));
  const matches = new Set(members.filter(member => normalizeName(member.name) === normalized)
    .map(member => member.id));
  for (const alias of aliases) {
    if (alias.approved === true && knownIds.has(alias.memberId) &&
        normalizeName(alias.value) === normalized) matches.add(alias.memberId);
  }
  return { status: matches.size === 1 ? 'SUGGESTED_ONLY' : 'REVIEW_REQUIRED',
    memberIds: [...matches].sort() };
}

/** Ausencia de referencia fiable => no construir una clave dura por fecha/monto. */
export function bankReferenceKey({ bank, accountId, externalRef }) {
  if (!bank || !accountId || !externalRef || !String(externalRef).trim()) return null;
  return createHash('sha256')
    .update(JSON.stringify([bank, accountId, String(externalRef).trim()])).digest('hex');
}

/** Flujo externo consolidado; no es el cálculo de saldos individuales por cuenta. */
export function externalNetFlow(movements) {
  let total = 0;
  for (const movement of movements) {
    integerCents(movement.amountCents, 'Movimiento', false);
    if (!['IN', 'OUT'].includes(movement.direction)) throw new TypeError('Dirección inválida');
    if (!['PAYMENT', 'EXPENSE', 'INTEREST', 'INTERNAL_TRANSFER', 'OPENING_BALANCE', 'REVERSAL']
      .includes(movement.kind)) throw new TypeError('Tipo inválido');
    if (movement.status !== 'CONFIRMED') continue;
    if (['INTERNAL_TRANSFER', 'OPENING_BALANCE'].includes(movement.kind)) continue;
    total = safeSum([total, (movement.direction === 'IN' ? 1 : -1) * movement.amountCents]);
  }
  return total;
}
