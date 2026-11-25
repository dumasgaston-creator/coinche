import type { Metadata } from "next";
import "@/components/live/live.css";
import { LiveProjectorApp } from "@/components/live/LiveProjectorApp";

export const metadata: Metadata = {
  title: "Projecteur Live | Coinch'Eirb",
  description:
    "Affichage vidéoprojecteur temps réel du tournoi Coinch'Eirb : poules, meilleurs 4es, tables en cours, arbre final et annonces.",
};

/**
 * Route /live : mode videoprojecteur plein ecran sombre chaud.
 */
export default function LiveProjectorPage() {
  return <LiveProjectorApp />;
}
