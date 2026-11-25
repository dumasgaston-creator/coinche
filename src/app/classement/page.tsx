import type { Metadata } from "next";
import "@/components/classement/classement.css";
import { ClassementView } from "@/components/classement/ClassementView";

export const metadata: Metadata = {
  title: "Classement Poules & Annuel | Coinch'Eirb",
  description:
    "Classement temps réel des 5 poules, meilleurs 4es, arbre final, classement annuel et exports PNG, PDF et CSV.",
};

export default function ClassementPage() {
  return <ClassementView />;
}
