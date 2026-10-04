import { AppRole } from "@/generated/prisma/client";
import { Notice } from "@/components/notice";
import { DashboardSummary } from "@/components/reports/dashboard-summary";
import { HistoricalDashboardSummary } from "@/components/reports/historical-dashboard-summary";
import { ReportSourceSwitcher } from "@/components/reports/report-source-switcher";
import { requireAccess, isFinanceRole, isGlobalReadRole } from "@/lib/access";
import { getDashboard } from "@/server/finance/dashboard";
import { getHistoricalDashboard, resolveReportSource } from "@/server/reports/historical";

function currentPeriod() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "America/Guayaquil",
  }).format(new Date()).slice(0, 7);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; source?: string; success?: string; error?: string }>;
}) {
  const access = await requireAccess();
  const params = await searchParams;
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.period ?? "") ? params.period! : currentPeriod();
  const finance = isFinanceRole(access);
  const memberOnly = access.roles.length === 1 && access.roles.includes(AppRole.MIEMBRO);
  const canFilterSection = isGlobalReadRole(access) || access.roles.includes(AppRole.JEFE_DE_CUERDA);
  const sourceContext = await resolveReportSource(access, params.source);

  if (sourceContext.source === "historical" && sourceContext.batchId) {
    const historical = await getHistoricalDashboard({ batchId: sourceContext.batchId, period });
    return (
      <div className="page">
        <header className="page-header"><div><p className="eyebrow">Fuente histórica · corte documental {historical.period}</p><h1>Resumen del coro</h1><p className="lede">Datos reales preservados desde el Excel. Permanecen separados de cargos, pagos, movimientos y saldos operativos hasta su revisión y promoción explícitas.</p></div><form className="actions"><input type="hidden" name="source" value="historical"/><label htmlFor="period">Período de fuente</label><input id="period" name="period" type="month" defaultValue={historical.period}/><button className="button button-secondary">Aplicar</button></form></header>
        <ReportSourceSwitcher source="historical" pathname="/resumen" params={{ period: historical.period }}/>
        <Notice success={params.success} error={params.error} warning={historical.periodSummary.status === "PARTIAL" ? "Este período está documentado como parcial. No representa un cierre mensual conciliado." : "Fuente pendiente de validación. Sus totales no son saldos operativos."}/>
        <HistoricalDashboardSummary data={historical}/>
      </div>
    );
  }

  const data = await getDashboard(access, period);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Corte {period}</p>
          <h1>{memberOnly ? "Mi cuenta" : "Resumen del coro"}</h1>
          <p className="lede">Los cargos, aplicaciones y movimientos se calculan por separado. Un pendiente de importación nunca se muestra como saldo cero validado.</p>
        </div>
        <form className="actions">
          <input type="hidden" name="source" value="operation" />
          <label htmlFor="period">Período de corte</label>
          <input id="period" name="period" type="month" defaultValue={period} />
          <button className="button button-secondary">Aplicar</button>
        </form>
      </header>
      {sourceContext.canReadHistory && sourceContext.hasHistory ? <ReportSourceSwitcher source="operation" pathname="/resumen" params={{ period }}/> : null}
      <Notice success={params.success} error={params.error} />
      {finance && data.pendingImports ? <Notice warning={`${data.pendingImports} importación(es) requieren revisión. Los saldos derivados del Excel siguen pendientes de validar.`} /> : null}

      <DashboardSummary data={data} period={period} finance={finance} memberOnly={memberOnly} canFilterSection={canFilterSection} />
    </div>
  );
}
