const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function assertPeriod(period: string) {
  if (!PERIOD_PATTERN.test(period)) throw new TypeError("Período inválido; usa AAAA-MM.");
  return period;
}

export function periodMonth(period: string) {
  assertPeriod(period);
  return Number(period.slice(5, 7));
}

export function dueDateForPeriod(period: string) {
  assertPeriod(period);
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0));
}

export function formatLocalDate(value: Date | string | null | undefined) {
  if (!value) return "Fecha pendiente";
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeZone: "America/Guayaquil",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function formatLocalDateNumeric(value: Date | string | null | undefined) {
  if (!value) return "Fecha pendiente";
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Guayaquil",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function formatLocalDateTime(value: Date | string | null | undefined) {
  if (!value) return "Fecha y hora pendientes";
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Guayaquil",
  }).format(typeof value === "string" ? new Date(value) : value);
}
