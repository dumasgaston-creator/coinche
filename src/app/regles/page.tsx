import type { Metadata } from "next";
import "@/components/players/players.css";
import { ReglesView } from "@/components/players/ReglesView";

export const metadata: Metadata = {
  title: "Règles officielles | Coinch'Eirb",
  description:
    "Règlement officiel Coinch'Eirb : Tout Atout, Sans Atout, Belote à 100, Coinche, Capot, Parlante à 160 et simulateur de score.",
};

export default function ReglesPage() {
  return <ReglesView />;
}
