import type { Metadata } from "next";
import { HomeView } from "@/components/home/HomeView";

export const metadata: Metadata = {
  title: "Coinch'Eirb | Tournoi de Coinche ENSEIRB-MATMECA",
  description:
    "Suivi temps réel des tables, scores et poules du tournoi de coinche Coinch'Eirb à l'ENSEIRB-MATMECA.",
};

const DEFAULT_POSTER_PATH = "/assets/affiche-soiree.jpg";

/**
 * Page d'accueil Coinch'Eirb.
 * Affiche le heros d'acces rapide a sa table et l'affiche dynamique de la soiree.
 */
export default function HomePage() {
  const posterUrl = DEFAULT_POSTER_PATH;
  const tournamentTitle = "Soirée Coinch'Eirb · Check-in avant 18h30";
  const startTimeLabel = "1er tour à 18h30";

  return (
    <HomeView
      posterUrl={posterUrl}
      tournamentTitle={tournamentTitle}
      startTimeLabel={startTimeLabel}
    />
  );
}
