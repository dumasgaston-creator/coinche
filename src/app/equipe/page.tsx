import type { Metadata } from "next";
import "@/components/players/players.css";
import { EquipeView } from "@/components/players/EquipeView";

export const metadata: Metadata = {
  title: "Mon équipe | Coinch'Eirb",
  description:
    "Accès rapide au binôme, suivi des matchs de poule, goal-average et liaison au classement annuel Coinch'Eirb.",
};

export default function EquipePage() {
  return <EquipeView />;
}
