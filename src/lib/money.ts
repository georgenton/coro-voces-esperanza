export function assertCents(value: number, label = "Importe", allowZero = true) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new TypeError(`${label}: se requiere un entero de centavos válido.`);
  }
  return value;
}

export function parseUsdToCents(value: string) {
  const text = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) {
    throw new TypeError("Importe inválido. Usa, por ejemplo, 5.00.");
  }
  const [whole, fraction = ""] = text.replace(",", ".").split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Importe excesivo.");
  return Number(cents);
}

export function formatUsd(cents: number) {
  assertCents(Math.abs(cents));
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function safeCentsSum(values: number[]) {
  const sum = values.reduce((total, value) => total + assertCents(value), 0);
  if (!Number.isSafeInteger(sum)) throw new RangeError("Suma monetaria fuera del rango seguro.");
  return sum;
}
