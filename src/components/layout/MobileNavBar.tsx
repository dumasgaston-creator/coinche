"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BookOpenIcon,
  SettingsIcon,
  TableCardsIcon,
  TrophyIcon,
  UsersIcon,
} from "@/components/icons/Icons";

interface NavTabItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const MOBILE_NAV_TABS: readonly NavTabItem[] = [
  {
    href: "/ma-table",
    label: "Ma table",
    icon: <TableCardsIcon size={20} />,
  },
  {
    href: "/classement",
    label: "Classement",
    icon: <TrophyIcon size={20} />,
  },
  {
    href: "/regles",
    label: "Règles",
    icon: <BookOpenIcon size={20} />,
  },
  {
    href: "/equipe",
    label: "Mon équipe",
    icon: <UsersIcon size={20} />,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: <SettingsIcon size={20} />,
  },
];

function isRouteActive(pathname: string, href: string): boolean {
  if (pathname === href) {
    return true;
  }
  if (pathname.startsWith(`${href}/`)) {
    return true;
  }
  return false;
}

/**
 * Barre de navigation mobile fixe a 5 onglets (Ma table, Classement, Regles, Mon equipe, Settings).
 */
export function MobileNavBar() {
  const pathname = usePathname();

  return (
    <nav className="mobile-nav" aria-label="Navigation principale">
      <ul className="mobile-nav-list">
        {MOBILE_NAV_TABS.map((tab) => {
          const active = isRouteActive(pathname, tab.href);
          let ariaCurrent: "page" | undefined = undefined;
          let activeAttr = "false";

          if (active) {
            ariaCurrent = "page";
            activeAttr = "true";
          }

          return (
            <li key={tab.href} className="mobile-nav-item">
              <Link
                href={tab.href}
                className="mobile-nav-link"
                data-active={activeAttr}
                aria-current={ariaCurrent}
              >
                <span className="mobile-nav-icon">{tab.icon}</span>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
