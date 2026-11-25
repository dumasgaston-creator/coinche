import type { Metadata } from "next";
import "@/components/memes/memes.css";
import { MemeBoxView } from "@/components/memes/MemeBoxView";

export const metadata: Metadata = {
  title: "Boîte à Memes & Photos | Coinch'Eirb",
  description:
    "Proposez vos memes Coinche et photos du BAR pour les pop-ups en direct sur le grand écran Coinch'Eirb.",
};

export default function MemesPage() {
  return <MemeBoxView />;
}
