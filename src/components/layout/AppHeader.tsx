"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/theme/ThemeProvider";
import {
  MoonIcon,
  ProjectorScreenIcon,
  SpadeSuitIcon,
  SunIcon,
} from "@/components/icons/Icons";

/**
 * Barre d'en-tete compacte (optimisee a 375 px) :
 * - Logo abeille Coinch'Eirb (retour accueil)
 * - Acces direct a Partie Libre au BAR (`/jouer`)
 * - Acces direct au Grand Ecran Videoprojecteur (`/live`)
 * - Bascule instantanee Mode Clair / Mode Sombre
 * (Aucun bouton `/admin` n'est expose dans la barre publique.)
 */
export function AppHeader() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  let toggleLabel = "Sombre";
  let toggleAria = "Passer en thème sombre";
  let icon = <MoonIcon size={16} />;

  if (theme === "dark") {
    toggleLabel = "Clair";
    toggleAria = "Passer en thème clair";
    icon = <SunIcon size={16} />;
  }

  let jouerActiveAttr = "false";
  if (pathname.startsWith("/jouer")) {
    jouerActiveAttr = "true";
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
            href="/jouer"
            className="header-quick-link"
            data-active={jouerActiveAttr}
            title="Lancer ou compter une partie libre au BAR (/jouer)"
          >
            <SpadeSuitIcon size={13} />
            <span className="header-quick-text">Partie BAR</span>
            <span className="header-quick-text-compact">BAR</span>
          </Link>

          <Link
            href="/live"
            className="header-quick-link header-quick-live"
            title="Ouvrir la vue vidéoprojecteur grand écran (/live)"
          >
            <ProjectorScreenIcon size={15} />
            <span className="header-quick-text">Grand écran</span>
            <span className="header-quick-text-compact">Live</span>
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
