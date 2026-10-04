"use client";

import Link from "next/link";
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
  type LucideIcon,
} from "lucide-react";

export type NavigationIcon = "dashboard" | "members" | "dues" | "movements" | "matrix" | "report" | "reconcile" | "import" | "history" | "activities" | "attendance" | "incidents" | "settings" | "account" | "receipt";
export type NavigationLink = { href: string; label: string; icon: NavigationIcon };

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

export function AppNavigation({ links }: { links: NavigationLink[] }) {
  const pathname = usePathname();
  return (
    <nav className="nav-list">
      {links.map(({ href, label, icon }) => {
        const active = pathname === href || (href !== "/resumen" && pathname.startsWith(`${href}/`));
        const Icon = icons[icon];
        return <Link className="nav-link" data-active={active} aria-current={active ? "page" : undefined} href={href} key={href}><Icon aria-hidden="true" size={17}/><span>{label}</span></Link>;
      })}
    </nav>
  );
}
