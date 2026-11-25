import type { Metadata } from "next";
import "@/components/players/players.css";
import { SettingsView } from "@/components/players/SettingsView";

export const metadata: Metadata = {
  title: "Réglages & Compte | Coinch'Eirb",
  description:
    "Thème clair ou sombre, compte joueur annuel optionnel Coinch'Eirb, accès rapide et mentions légales.",
};

export default function SettingsPage() {
  return <SettingsView />;
}
