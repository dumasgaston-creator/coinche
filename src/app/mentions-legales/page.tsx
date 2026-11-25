import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, LockIcon } from "@/components/icons/Icons";

export const metadata: Metadata = {
  title: "Mentions légales & Confidentialité | Coinch'Eirb",
  description:
    "Mentions légales, gestion des cookies et politique de confidentialité de l'application tournoi Coinch'Eirb.",
};

export default function MentionsLegalesPage() {
  return (
    <div className="container-mobile">
      <div className="table-stack">
        <section className="card-ruled">
          <span className="eyebrow">
            <LockIcon size={13} />
            <span>Conformité &amp; Transparence</span>
          </span>
          <h1 className="section-title" style={{ marginTop: "6px" }}>
            Mentions légales &amp; Confidentialité
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "13.5px",
              color: "var(--ink-secondary)",
            }}
          >
            Informations réglementaires relatives à la plateforme temps réel des
            tournois Coinch&apos;Eirb (ENSEIRB-MATMECA).
          </p>
        </section>

        <section className="card">
          <h2 className="section-title" style={{ fontSize: "18px" }}>
            1. Éditeur de l&apos;application
          </h2>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "13.5px",
              color: "var(--ink-secondary)",
            }}
          >
            Club étudiant <strong>Coinch&apos;Eirb</strong> · Association des
            élèves de l&apos;ENSEIRB-MATMECA (Bordeaux INP), 1 Avenue du Docteur
            Albert Schweitzer, 33400 Talence, France.
          </p>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "13px",
              color: "var(--ink-muted)",
            }}
          >
            Note de pré-production : le nom du responsable de publication et
            l&apos;adresse email officielle de contact du bureau Coinch&apos;Eirb
            doivent être renseignés avant l&apos;ouverture publique.
          </p>
        </section>

        <section className="card">
          <h2 className="section-title" style={{ fontSize: "18px" }}>
            2. Hébergement
          </h2>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "13.5px",
              color: "var(--ink-secondary)",
            }}
          >
            Interface web déployée sur <strong>Vercel Inc.</strong> (440 N
            Barranca Ave #4133, Covina, CA 91723). Base de données temps réel
            hébergée sur <strong>Supabase</strong> (région Union Européenne) avec
            sécurité au niveau des lignes (RLS).
          </p>
        </section>

        <section className="card">
          <h2 className="section-title" style={{ fontSize: "18px" }}>
            3. Données personnelles &amp; Cookies
          </h2>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "13.5px",
              color: "var(--ink-secondary)",
            }}
          >
            La participation au tournoi ne nécessite aucune création de compte :
            seuls le nom d&apos;équipe et les prénoms/pseudos inscrits pour la
            soirée sont affichés sur les feuilles de table et le
            vidéoprojecteur.
          </p>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "13.5px",
              color: "var(--ink-secondary)",
            }}
          >
            Le compte joueur annuel est strictement facultatif. Les cookies de
            session sont configurés en <code>httpOnly</code>,{" "}
            <code>secure</code> et <code>sameSite=lax</code>. La mesure
            d&apos;audience locale est désactivée par défaut si vous cliquez sur
            « Refuser » dans le bandeau de préférences cookies.
          </p>
        </section>

        <Link href="/ma-table" className="btn btn-primary btn-full">
          <span>Retourner à Ma table</span>
          <ArrowRightIcon size={17} />
        </Link>
      </div>
    </div>
  );
}
