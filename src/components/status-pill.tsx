const styles: Record<string, string> = {
  ACTIVE: "pill-success",
  APPROVED: "pill-success",
  CONFIRMED: "pill-success",
  PAID: "pill-success",
  PRESENT: "pill-success",
  READY: "pill-success",
  PENDING: "pill-warning",
  PARTIAL: "pill-warning",
  REVIEW_REQUIRED: "pill-warning",
  EXTRACTION_PENDING: "pill-warning",
  POSSIBLE_DUPLICATE: "pill-warning",
  LATE: "pill-warning",
  REJECTED: "pill-danger",
  RETIRED: "pill-danger",
  VOIDED: "pill-danger",
  REVERSED: "pill-danger",
  OPEN: "pill-info",
  SCHEDULED: "pill-info",
  PAUSED: "pill-info",
};

const labels: Record<string, string> = {
  ACTIVE: "Activo",
  APPROVED: "Aprobado",
  CONFIRMED: "Confirmado",
  PAID: "Pagado",
  PRESENT: "Presente",
  READY: "Listo",
  PENDING: "Pendiente",
  PARTIAL: "Parcial",
  REVIEW_REQUIRED: "Revisión pendiente",
  EXTRACTION_PENDING: "Leyendo",
  POSSIBLE_DUPLICATE: "Posible duplicado",
  LATE: "Tardanza",
  REJECTED: "Rechazado",
  RETIRED: "Retirado",
  VOIDED: "Anulado",
  REVERSED: "Reversado",
  OPEN: "Abierto",
  SCHEDULED: "Programado",
  PAUSED: "Pausa",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
};

export function StatusPill({ value }: { value: string }) {
  return <span className={`pill ${styles[value] ?? ""}`}>{labels[value] ?? value}</span>;
}
