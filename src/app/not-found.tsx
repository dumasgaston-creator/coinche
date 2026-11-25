import Link from "next/link";
import {
  ArrowRightIcon,
  ClubSuitIcon,
  DiamondSuitIcon,
  HeartSuitIcon,
  SpadeSuitIcon,
  TableCardsIcon,
  TrophyIcon,
} from "@/components/icons/Icons";

/**
 * Page 404 personnalisée aux couleurs Coinch'Eirb.
 */
export default function NotFoundPage() {
  return (
    <div className="container-mobile" style={{ paddingTop: "28px" }}>
      <section className="card-ruled" style={{ textAlign: "left" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <span className="eyebrow">Erreur 404 · Donne introuvable</span>
          <span className="suits-strip" aria-hidden="true">
            <SpadeSuitIcon size={14} />
            <HeartSuitIcon size={14} style={{ color: "var(--status-fail)" }} />
            <DiamondSuitIcon size={14} style={{ color: "var(--status-fail)" }} />
            <ClubSuitIcon size={14} />
          </span>
        </div>

        <h1 className="page-title" style={{ marginTop: "10px" }}>
          Cette table n&apos;existe pas
        </h1>

        <p
          style={{
            margin: "10px 0 18px",
            fontSize: "14px",
            color: "var(--ink-secondary)",
          }}
        >
          L&apos;adresse demandée ne correspond à aucune table, poule ou page du
          tournoi Coinch&apos;Eirb. Rejoignez votre feuille de marque ou le
          classement en direct.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <Link href="/ma-table" className="btn btn-primary btn-full">
            <TableCardsIcon size={18} />
            <span>Rejoindre Ma table</span>
            <ArrowRightIcon size={17} />
          </Link>

          <Link href="/classement" className="btn btn-secondary btn-full">
            <TrophyIcon size={18} />
            <span>Voir le classement des poules</span>
          </Link>

          <Link href="/" className="btn btn-secondary btn-full">
            <span>Retour à l&apos;accueil Coinch&apos;Eirb</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
