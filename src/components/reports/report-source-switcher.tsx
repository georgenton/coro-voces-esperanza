import Link from "next/link";
import { Database, ShieldCheck } from "lucide-react";
import type { ReportSource } from "@/server/reports/historical";

function sourceUrl(pathname: string, params: Record<string, string | undefined>, source: ReportSource) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  query.set("source", source);
  return `${pathname}?${query.toString()}`;
}

export function ReportSourceSwitcher({
  source,
  pathname,
  params,
}: {
  source: ReportSource;
  pathname: string;
  params: Record<string, string | undefined>;
}) {
  return (
    <nav className="source-switcher" aria-label="Fuente del reporte">
      <Link className="source-option" data-active={source === "historical"} aria-current={source === "historical" ? "page" : undefined} href={sourceUrl(pathname, params, "historical")}>
        <Database aria-hidden="true" size={16} />
        <span><strong>Histórico del Excel</strong><small>Pendiente de validación</small></span>
      </Link>
      <Link className="source-option" data-active={source === "operation"} aria-current={source === "operation" ? "page" : undefined} href={sourceUrl(pathname, params, "operation")}>
        <ShieldCheck aria-hidden="true" size={16} />
        <span><strong>Operación validada</strong><small>Cargos y movimientos promovidos</small></span>
      </Link>
    </nav>
  );
}
