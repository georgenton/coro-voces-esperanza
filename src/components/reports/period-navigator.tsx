import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

function movePeriod(period: string, offset: number) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function periodUrl(pathname: string, period: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "period" && key !== "page") query.set(key, value);
  }
  query.set("period", period);
  return `${pathname}?${query.toString()}`;
}

export function PeriodNavigator({
  pathname,
  period,
  params,
  label = "Período",
  status,
}: {
  pathname: string;
  period: string;
  params: Record<string, string | undefined>;
  label?: string;
  status?: string;
}) {
  return (
    <div className="period-navigator" aria-label={`Navegación de ${label.toLowerCase()}`}>
      <Link className="period-arrow" href={periodUrl(pathname, movePeriod(period, -1), params)} aria-label="Ir al mes anterior"><ChevronLeft aria-hidden="true" size={18}/></Link>
      <form className="period-form" action={pathname}>
        {Object.entries(params).map(([key, value]) => value && key !== "period" && key !== "page" ? <input key={key} type="hidden" name={key} value={value}/> : null)}
        <label htmlFor={`period-${pathname.replaceAll("/", "-")}`}><CalendarDays aria-hidden="true" size={15}/><span>{label}</span></label>
        <input id={`period-${pathname.replaceAll("/", "-")}`} name="period" type="month" defaultValue={period}/>
        <button className="button button-secondary button-small" type="submit">Ir</button>
      </form>
      <Link className="period-arrow" href={periodUrl(pathname, movePeriod(period, 1), params)} aria-label="Ir al mes siguiente"><ChevronRight aria-hidden="true" size={18}/></Link>
      {status ? <span className="period-status">{status}</span> : null}
    </div>
  );
}
