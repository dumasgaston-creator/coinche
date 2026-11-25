import { Suspense } from "react";
import type { Metadata } from "next";
import { MaTableView } from "@/components/table/MaTableView";

export const metadata: Metadata = {
  title: "Ma table | Coinch'Eirb",
  description:
    "Feuille de marque temps réel de votre table : saisie par donne, score final direct, annonces et appel arbitre.",
};

export default function MaTablePage() {
  return (
    <Suspense
      fallback={
        <div className="container-mobile">
          <section className="card-ruled">
            <span className="eyebrow">Chargement de la table</span>
            <p style={{ margin: "6px 0 0", fontSize: "14px" }}>
              Synchronisation de la feuille de marque en cours...
            </p>
          </section>
        </div>
      }
    >
      <MaTableView />
    </Suspense>
  );
}
