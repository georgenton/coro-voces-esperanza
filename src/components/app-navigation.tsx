"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavigationLink = { href: string; label: string; icon: string };

export function AppNavigation({ links }: { links: NavigationLink[] }) {
  const pathname = usePathname();
  return (
    <nav className="nav-list">
      {links.map(({ href, label, icon }) => {
        const active = pathname === href || (href !== "/resumen" && pathname.startsWith(`${href}/`));
        return <Link className="nav-link" data-active={active} aria-current={active ? "page" : undefined} href={href} key={href}><span aria-hidden="true">{icon}</span><span>{label}</span></Link>;
      })}
    </nav>
  );
}
