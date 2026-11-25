"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useTournamentStore } from "@/lib/tournament/use-tournament-store";
import {
  LockIcon,
  MoonIcon,
  ProjectorScreenIcon,
  SunIcon,
} from "@/components/icons/Icons";

/**
 * Barre d'en-tete compacte (optimisee a 375 px) :
 * - Logo abeille Coinch'Eirb (retour accueil)
 * - Acces direct au Grand Ecran Videoprojecteur (`/live`)
 * - Acces direct au Poste Admin (`/admin`) avec compteur d'alertes arbitre en direct
 * - Bascule instantanee Mode Clair / Mode Sombre
 */
export function AppHeader() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { state, hydrated } = useTournamentStore();

  let toggleLabel = "Sombre";
  let toggleAria = "Passer en thème sombre";
  let icon = <MoonIcon size={16} />;

  if (theme === "dark") {
    toggleLabel = "Clair";
    toggleAria = "Passer en thème clair";
    icon = <SunIcon size={16} />;
  }

  let openAlertsCount = 0;
  if (hydrated) {
    openAlertsCount = state.alerts.filter((a) => a.status !== "resolved").length;
  }

  let adminActiveAttr = "false";
  if (pathname.startsWith("/admin")) {
    adminActiveAttr = "true";
  }

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/" className="brand-link" aria-label="Accueil Coinch'Eirb">
          <img
            src="/assets/media/logo-abeilles.jpg"
            alt="Logo abeilles Coinch'Eirb"
            width={36}
            height={36}
            className="brand-logo"
          />
          <span className="brand-wordmark">
            <span className="brand-name">Coinch&apos;Eirb</span>
            <span className="brand-sub">ENSEIRB · BAR</span>
          </span>
        </Link>

        <div className="header-actions">
          <Link
            href="/live"
            className="header-quick-link header-quick-live"
            title="Ouvrir la vue vidéoprojecteur grand écran (/live)"
          >
            <ProjectorScreenIcon size={15} />
            <span className="header-quick-text">Grand écran</span>
            <span className="header-quick-text-compact">Live</span>
          </Link>

          <Link
            href="/admin"
            className="header-quick-link"
            data-active={adminActiveAttr}
            title="Ouvrir le poste de pilotage administrateur (/admin)"
          >
            <LockIcon size={14} />
            <span>Admin</span>
            {openAlertsCount > 0 && (
              <span
                className="header-alert-pill tabular-nums"
                title={`${openAlertsCount} alerte(s) arbitre en attente`}
              >
                {openAlertsCount}
              </span>
            )}
          </Link>

          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={toggleAria}
            title={toggleAria}
          >
            {icon}
            <span className="theme-toggle-label">{toggleLabel}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
