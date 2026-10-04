import Link from "next/link";
import { Database, Music2, UserRound } from "lucide-react";
import { AppRole } from "@/generated/prisma/client";
import type { AccessContext } from "@/lib/access";
import { SignOutButton } from "@/components/sign-out-button";
import { Notice } from "@/components/notice";
import { AppNavigation, type NavigationLink } from "@/components/app-navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const fullNavigation = [
  { href: "/resumen", label: "Resumen", icon: "dashboard" },
  { href: "/miembros", label: "Miembros", icon: "members" },
  { href: "/cuotas", label: "Cuotas", icon: "dues" },
  { href: "/movimientos", label: "Movimientos", icon: "movements" },
  { href: "/reportes/cuotas", label: "Matriz anual", icon: "matrix" },
  { href: "/reportes/movimientos", label: "Reporte mensual", icon: "report" },
  { href: "/conciliar", label: "Conciliar", icon: "reconcile" },
  { href: "/importar", label: "Importar Excel", icon: "import" },
  { href: "/reportes/historico", label: "Histórico fuente", icon: "history" },
  { href: "/actividades", label: "Actividades", icon: "activities" },
  { href: "/asistencia", label: "Asistencia", icon: "attendance" },
  { href: "/incidencias", label: "Incidencias", icon: "incidents" },
  { href: "/configuracion", label: "Configuración", icon: "settings" },
] satisfies NavigationLink[];

const memberNavigation = [
  { href: "/resumen", label: "Mi resumen", icon: "dashboard" },
  { href: "/reportes/cuotas", label: "Mis cuotas", icon: "matrix" },
  { href: "/mi-cuenta", label: "Mi cuenta", icon: "account" },
  { href: "/mi-asistencia", label: "Mi asistencia", icon: "attendance" },
  { href: "/enviar-comprobante", label: "Enviar comprobante", icon: "receipt" },
] satisfies NavigationLink[];

function visibleLinks(access: AccessContext) {
  const isOnlyMember = access.roles.length === 1 && access.roles.includes(AppRole.MIEMBRO);
  if (isOnlyMember) return memberNavigation;
  const financeRoles = new Set<AppRole>([AppRole.SUPERADMIN, AppRole.ADMIN, AppRole.TESORERIA]);
  return fullNavigation.filter(({ href }) => {
    if (href === "/configuracion") return access.roles.includes(AppRole.SUPERADMIN);
    if (["/movimientos", "/conciliar", "/importar", "/reportes/historico", "/reportes/movimientos"].includes(href)) {
      return access.roles.some((role) => financeRoles.has(role));
    }
    return true;
  });
}

export function AppShell({ access, children }: { access: AccessContext; children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegación principal">
        <Link href="/resumen" className="brand" aria-label="Voces de Esperanza, inicio">
          <span className="brand-mark" aria-hidden="true"><Music2 size={20}/></span>
          <span>
            <span className="brand-title">Voces de Esperanza</span>
            <span className="brand-subtitle">Cuotas, tesorería y asistencia</span>
          </span>
        </Link>
        <AppNavigation links={[...visibleLinks(access)]} />
        <p className="sidebar-note">Información privada. Los comprobantes y datos personales solo se muestran según tu rol y cuerda.</p>
      </aside>
      <header className="topbar">
        <Link href="/resumen" className="brand brand-mobile" aria-label="Voces de Esperanza, inicio"><span className="brand-mark" aria-hidden="true"><Music2 size={18}/></span><span className="brand-title">Voces de Esperanza</span></Link>
        <div className="topbar-context"><span className="context-chip"><Database aria-hidden="true" size={14}/><strong>Excel</strong> pendiente</span></div>
        <div className="actions"><ThemeToggle/><span className="user-chip"><UserRound aria-hidden="true" size={14}/><span>{access.name}</span></span><SignOutButton/></div>
      </header>
      <main className="app-content"><Notice warning="Migración histórica pendiente de aprobación" />{children}</main>
    </div>
  );
}
