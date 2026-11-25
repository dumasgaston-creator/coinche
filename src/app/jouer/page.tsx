import type { Metadata } from "next";
import "@/components/jouer/jouer.css";
import { PartieLibreView } from "@/components/jouer/PartieLibreView";

export const metadata: Metadata = {
  title: "Partie Libre au BAR | Coinch'Eirb",
  description:
    "Comptez vos points de coinche toute l'année au BAR de l'ENSEIRB-MATMECA et alimentez le classement annuel +/-.",
};

export default function JouerPage() {
  return <PartieLibreView />;
}
