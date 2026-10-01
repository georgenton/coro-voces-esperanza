import Link from "next/link";
import { AppRole } from "@/generated/prisma/client";
import type { AccessContext } from "@/lib/access";
import { SignOutButton } from "@/components/sign-out-button";
import { Notice } from "@/components/notice";

const fullNavigation = [
  ["/resumen", "Resumen"],
  ["/miembros", "Miembros"],
  ["/cuotas", "Cuotas"],
  ["/movimientos", "Movimientos"],
  ["/conciliar", "Conciliar"],
  ["/importar", "Importar Excel"],
  ["/actividades", "Actividades"],
  ["/asistencia", "Asistencia"],
  ["/incidencias", "Incidencias"],
  ["/configuracion", "Configuración"],
] as const;

const memberNavigation = [
  ["/mi-cuenta", "Mi cuenta"],
  ["/mi-asistencia", "Mi asistencia"],
  ["/enviar-comprobante", "Enviar comprobante"],
] as const;

function visibleLinks(access: AccessContext) {
  const isOnlyMember = access.roles.length === 1 && access.roles.includes(AppRole.MIEMBRO);
  if (isOnlyMember) return memberNavigation;
  const financeRoles = new Set<AppRole>([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  return fullNavigation.filter(([href]) => {
    if (href === "/configuracion") return access.roles.includes(AppRole.SUPERADMIN);
    if (["/movimientos", "/conciliar", "/importar"].includes(href)) {
      return access.roles.some((role) => financeRoles.has(role));
    }
    return true;
  });
}

export function AppShell({ access, children }: { access: AccessContext; children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/resumen" className="brand" aria-label="Voces de Esperanza, inicio">
          <span className="brand-mark" aria-hidden="true">♪</span>
          <span>
            <span className="brand-title">Voces de Esperanza</span>
            <span className="brand-subtitle">Cuotas, tesorería y asistencia</span>
          </span>
        </Link>
        <div className="actions">
          <span className="small">{access.name}</span>
          <SignOutButton />
        </div>
      </header>
      <div className="app-grid">
        <aside className="sidebar" aria-label="Navegación principal">
          <nav className="nav-list">
            {visibleLinks(access).map(([href, label]) => (
              <Link className="nav-link" href={href} key={href}>{label}</Link>
            ))}
          </nav>
          <p className="sidebar-note">Información privada. Los comprobantes y datos personales solo se muestran según tu rol y cuerda.</p>
        </aside>
        <main><Notice warning="Migración histórica pendiente de aprobación" />{children}</main>
      </div>
    </div>
  );
}
