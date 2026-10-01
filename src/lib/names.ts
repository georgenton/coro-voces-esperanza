export function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function neutralizeCsvCell(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
