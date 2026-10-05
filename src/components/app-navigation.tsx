"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BadgeCheck,
  CalendarDays,
  CircleDollarSign,
  FileUp,
  Grid3X3,
  History,
  LayoutDashboard,
  QrCode,
  ReceiptText,
  Settings,
  ShieldAlert,
  TableProperties,
  UsersRound,
  WalletCards,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

export type NavigationIcon = "dashboard" | "members" | "dues" | "movements" | "matrix" | "report" | "reconcile" | "import" | "history" | "activities" | "attendance" | "incidents" | "settings" | "account" | "receipt";
export type NavigationLink = { href: string; label: string; icon: NavigationIcon };
export type NavigationGroup = { label: string; links: NavigationLink[] };

const icons: Record<NavigationIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  members: UsersRound,
  dues: CircleDollarSign,
  movements: ArrowLeftRight,
  matrix: Grid3X3,
  report: TableProperties,
  reconcile: BadgeCheck,
  import: FileUp,
  history: History,
  activities: CalendarDays,
  attendance: QrCode,
  incidents: ShieldAlert,
  settings: Settings,
  account: WalletCards,
  receipt: ReceiptText,
};

function NavigationLinks({ groups, onNavigate }: { groups: NavigationGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="nav-list" aria-label="Secciones de la aplicación">
      {groups.map((group) => <section className="nav-group" key={group.label}>
        <h2 className="nav-group-label">{group.label}</h2>
        <div className="nav-group-links">{group.links.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== "/resumen" && pathname.startsWith(`${href}/`));
          const Icon = icons[icon];
          return <Link onClick={onNavigate} className="nav-link" data-active={active} aria-current={active ? "page" : undefined} href={href} key={href}><Icon aria-hidden="true" size={17}/><span>{label}</span></Link>;
        })}</div>
      </section>)}
    </nav>
  );
}

export function AppNavigation({ groups }: { groups: NavigationGroup[] }) {
  return <NavigationLinks groups={groups}/>;
}

export function MobileNavigation({ groups }: { groups: NavigationGroup[] }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function closeMenu() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <>
      <button ref={triggerRef} className="icon-button mobile-menu-trigger" type="button" aria-label="Abrir menú principal" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><Menu aria-hidden="true" size={20}/></button>
      <dialog ref={dialogRef} className="mobile-nav-dialog" aria-label="Menú principal" onCancel={(event) => { event.preventDefault(); closeMenu(); }} onClick={(event) => { if (event.target === event.currentTarget) closeMenu(); }}>
        <div className="mobile-nav-panel">
          <header className="mobile-nav-header"><strong>Navegación</strong><button className="icon-button" type="button" aria-label="Cerrar menú principal" onClick={closeMenu}><X aria-hidden="true" size={20}/></button></header>
          <NavigationLinks groups={groups} onNavigate={closeMenu}/>
        </div>
      </dialog>
    </>
  );
}
