"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const CONSENT_STORAGE_KEY = "coincheirb-cookie-consent-v1";
const ANALYTICS_STORAGE_KEY = "coincheirb-audience-metrics-v1";

type ConsentChoice = "accepted" | "refused";

function recordAnonymousPageView(pathname: string): void {
  try {
    const raw = localStorage.getItem(ANALYTICS_STORAGE_KEY);
    let counts: Record<string, number> = {};
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        counts = parsed as Record<string, number>;
      }
    }
    const current = counts[pathname] ?? 0;
    counts[pathname] = current + 1;
    localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Bandeau cookies sobre avec refus en un clic et mesure d'audience locale conditionnelle.
 * Masque sur la vue videoprojecteur `/live` pour ne jamais gener l'affichage en salle.
 */
export function CookieBanner() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<ConsentChoice | "unknown">("accepted");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (stored === "accepted" || stored === "refused") {
        setChoice(stored);
      } else {
        setChoice("unknown");
      }
    } catch {
      setChoice("refused");
    }
  }, []);

  useEffect(() => {
    if (choice === "accepted" && pathname) {
      recordAnonymousPageView(pathname);
    }
  }, [choice, pathname]);

  function handleSelect(decision: ConsentChoice) {
    setChoice(decision);
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, decision);
      if (decision === "refused") {
        localStorage.removeItem(ANALYTICS_STORAGE_KEY);
      }
    } catch {
      // Ignore storage failures
    }
  }

  if (pathname === "/live" || choice !== "unknown") {
    return null;
  }

  return (
    <aside
      role="region"
      aria-label="Préférences de cookies et mesure d'audience"
      style={{
        position: "fixed",
        left: "12px",
        right: "12px",
        bottom: "calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 10px)",
        zIndex: 65,
        maxWidth: "500px",
        margin: "0 auto",
        backgroundColor: "var(--bg-surface)",
        border: "1.5px solid var(--border-strong)",
        borderTop: "3px solid var(--accent-amber)",
        borderRadius: "var(--radius-card)",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div style={{ fontSize: "12.5px", color: "var(--ink-secondary)", lineHeight: 1.45 }}>
        <strong style={{ color: "var(--ink-primary)" }}>
          Cookies &amp; mesure d&apos;audience Coinch&apos;Eirb :
        </strong>{" "}
        seuls les cookies techniques de session de table sont requis. Vous pouvez
        accepter ou refuser en un clic la mesure d&apos;audience anonyme des
        pages du tournoi (
        <Link
          href="/mentions-legales"
          style={{ textDecoration: "underline", fontWeight: 700 }}
        >
          mentions légales
        </Link>
        ).
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
        }}
      >
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ minHeight: "38px" }}
          onClick={() => handleSelect("refused")}
        >
          Tout refuser
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ minHeight: "38px" }}
          onClick={() => handleSelect("accepted")}
        >
          Accepter
        </button>
      </div>
    </aside>
  );
}
