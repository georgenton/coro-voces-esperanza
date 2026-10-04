import Link from "next/link";
import { AppRole } from "@/generated/prisma/client";
import type { AccessContext } from "@/lib/access";
import { SignOutButton } from "@/components/sign-out-button";
import { Notice } from "@/components/notice";
import { AppNavigation, type NavigationLink } from "@/components/app-navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const fullNavigation = [
  { href: "/resumen", label: "Resumen", icon: "⌂" },
  { href: "/miembros", label: "Miembros", icon: "♩" },
  { href: "/cuotas", label: "Cuotas", icon: "$" },
  { href: "/movimientos", label: "Movimientos", icon: "↕" },
  { href: "/reportes/cuotas", label: "Matriz anual", icon: "▦" },
  { href: "/reportes/movimientos", label: "Reporte mensual", icon: "≋" },
  { href: "/conciliar", label: "Conciliar", icon: "✓" },
  { href: "/importar", label: "Importar Excel", icon: "⇧" },
  { href: "/reportes/historico", label: "Histórico fuente", icon: "◷" },
  { href: "/actividades", label: "Actividades", icon: "◇" },
  { href: "/asistencia", label: "Asistencia", icon: "▣" },
  { href: "/incidencias", label: "Incidencias", icon: "!" },
  { href: "/configuracion", label: "Configuración", icon: "⚙" },
] satisfies NavigationLink[];

const memberNavigation = [
  { href: "/resumen", label: "Mi resumen", icon: "⌂" },
  { href: "/reportes/cuotas", label: "Mis cuotas", icon: "▦" },
  { href: "/mi-cuenta", label: "Mi cuenta", icon: "$" },
  { href: "/mi-asistencia", label: "Mi asistencia", icon: "▣" },
  { href: "/enviar-comprobante", label: "Enviar comprobante", icon: "⇧" },
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
      <header className="topbar">
        <Link href="/resumen" className="brand" aria-label="Voces de Esperanza, inicio">
          <span className="brand-mark" aria-hidden="true">♪</span>
          <span>
            <span className="brand-title">Voces de Esperanza</span>
            <span className="brand-subtitle">Cuotas, tesorería y asistencia</span>
          </span>
        </Link>
        <div className="actions">
          <ThemeToggle />
          <span className="user-chip"><span aria-hidden="true">●</span><span>{access.name}</span></span>
          <SignOutButton />
        </div>
      </header>
      <div className="app-grid">
        <aside className="sidebar" aria-label="Navegación principal">
          <AppNavigation links={[...visibleLinks(access)]} />
          <p className="sidebar-note">Información privada. Los comprobantes y datos personales solo se muestran según tu rol y cuerda.</p>
        </aside>
        <main><Notice warning="Migración histórica pendiente de aprobación" />{children}</main>
      </div>
    </div>
  );
}
