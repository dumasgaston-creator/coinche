"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BookOpenIcon,
  ClubSuitIcon,
  DiamondSuitIcon,
  HeartSuitIcon,
  SpadeSuitIcon,
  TrophyIcon,
} from "@/components/icons/Icons";
import { ScoreSimulator } from "@/components/players/ScoreSimulator";

type CardOrderTab = "tout_atout" | "sans_atout" | "classique";

interface CardValueEntry {
  rank: string;
  points: number;
  highlight: boolean;
}

const TOUT_ATOUT_CARDS: readonly CardValueEntry[] = [
  { rank: "Valet", points: 14, highlight: true },
  { rank: "9", points: 9, highlight: true },
  { rank: "As", points: 6, highlight: false },
  { rank: "10", points: 5, highlight: false },
  { rank: "Roi", points: 3, highlight: false },
  { rank: "Dame", points: 1, highlight: false },
  { rank: "8", points: 0, highlight: false },
  { rank: "7", points: 0, highlight: false },
];

const SANS_ATOUT_CARDS: readonly CardValueEntry[] = [
  { rank: "As", points: 19, highlight: true },
  { rank: "10", points: 10, highlight: true },
  { rank: "Roi", points: 4, highlight: false },
  { rank: "Dame", points: 3, highlight: false },
  { rank: "Valet", points: 2, highlight: false },
  { rank: "9", points: 0, highlight: false },
  { rank: "8", points: 0, highlight: false },
  { rank: "7", points: 0, highlight: false },
];

const CLASSIC_TRUMP_CARDS: readonly CardValueEntry[] = [
  { rank: "Valet", points: 20, highlight: true },
  { rank: "9", points: 14, highlight: true },
  { rank: "As", points: 11, highlight: false },
  { rank: "10", points: 10, highlight: false },
  { rank: "Roi", points: 4, highlight: false },
  { rank: "Dame", points: 3, highlight: false },
  { rank: "8", points: 0, highlight: false },
  { rank: "7", points: 0, highlight: false },
];

const CLASSIC_PLAIN_CARDS: readonly CardValueEntry[] = [
  { rank: "As", points: 11, highlight: true },
  { rank: "10", points: 10, highlight: true },
  { rank: "Roi", points: 4, highlight: false },
  { rank: "Dame", points: 3, highlight: false },
  { rank: "Valet", points: 2, highlight: false },
  { rank: "9", points: 0, highlight: false },
  { rank: "8", points: 0, highlight: false },
  { rank: "7", points: 0, highlight: false },
];

function getTabActiveAttr(
  activeTab: CardOrderTab,
  target: CardOrderTab,
): "true" | "false" {
  if (activeTab === target) {
    return "true";
  }
  return "false";
}

function renderCardGrid(entries: readonly CardValueEntry[]) {
  return (
    <div className="card-values-grid">
      {entries.map((card) => {
        let highlightAttr = "false";
        if (card.highlight) {
          highlightAttr = "true";
        }
        return (
          <div
            key={card.rank}
            className="card-value-cell"
            data-highlight={highlightAttr}
          >
            <span className="card-rank">{card.rank}</span>
            <span className="card-pts">{card.points} pt</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Vue mobile des regles officielles Coinch'Eirb (375 px) avec acces rapide
 * aux valeurs des cartes, calculs de contrats, parlante et simulateur.
 */
export function ReglesView() {
  const [cardTab, setCardTab] = useState<CardOrderTab>("tout_atout");

  return (
    <div className="container-mobile">
      <div className="players-stack">
        <header className="players-header-card">
          <span className="eyebrow">
            <BookOpenIcon size={13} />
            <span>Règlement officiel · Coinch&apos;Eirb</span>
          </span>
          <h1 className="page-title">Règles de jeu</h1>
          <p className="players-lead">
            Référence directe en cours de partie : valeurs des cartes, Belote à
            partir de 100, Coinche, Capot, Parlante et format du tournoi.
          </p>

          <nav className="players-jump-strip" aria-label="Sections du règlement">
            <a href="#cartes" className="players-jump-link">
              Valeurs cartes
            </a>
            <a href="#contrats" className="players-jump-link">
              Contrats &amp; Belote
            </a>
            <a href="#parlante" className="players-jump-link">
              Parlante (160)
            </a>
            <a href="#tournoi" className="players-jump-link">
              Format tournoi
            </a>
            <a href="#simulateur" className="players-jump-link">
              Simulateur
            </a>
          </nav>
        </header>

        {/* Valeurs des cartes */}
        <section id="cartes" className="card" aria-labelledby="cards-heading">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <h2 id="cards-heading" className="section-title">
              Valeurs des cartes
            </h2>
            <span className="suits-strip" aria-hidden="true">
              <SpadeSuitIcon size={13} />
              <HeartSuitIcon size={13} style={{ color: "var(--status-fail)" }} />
              <ClubSuitIcon size={13} />
              <DiamondSuitIcon size={13} style={{ color: "var(--status-fail)" }} />
            </span>
          </div>

          <div
            className="players-tabs-3"
            role="tablist"
            aria-label="Mode de jeu"
            style={{ marginTop: "10px" }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={cardTab === "tout_atout"}
              className="players-tab-btn"
              data-active={getTabActiveAttr(cardTab, "tout_atout")}
              onClick={() => setCardTab("tout_atout")}
            >
              Tout Atout
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={cardTab === "sans_atout"}
              className="players-tab-btn"
              data-active={getTabActiveAttr(cardTab, "sans_atout")}
              onClick={() => setCardTab("sans_atout")}
            >
              Sans Atout
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={cardTab === "classique"}
              className="players-tab-btn"
              data-active={getTabActiveAttr(cardTab, "classique")}
              onClick={() => setCardTab("classique")}
            >
              Couleur
            </button>
          </div>

          {cardTab === "tout_atout" && (
            <div>
              {renderCardGrid(TOUT_ATOUT_CARDS)}
              <p className="rules-note-line">
                Tout Atout (TA) : Valet 14, 9: 9, As: 6, 10: 5, Roi: 3, Dame: 1,
                8/7: 0 · Total 152 pts + 10 de der = 162 pts.
              </p>
            </div>
          )}

          {cardTab === "sans_atout" && (
            <div>
              {renderCardGrid(SANS_ATOUT_CARDS)}
              <p className="rules-note-line">
                Sans Atout (SA) : As 19, 10: 10, Roi: 4, Dame: 3, Valet: 2,
                9/8/7: 0 · Total 152 pts + 10 de der = 162 pts.
              </p>
            </div>
          )}

          {cardTab === "classique" && (
            <div>
              <div style={{ marginTop: "10px" }}>
                <span className="badge badge-amber">Couleur d&apos;Atout</span>
                {renderCardGrid(CLASSIC_TRUMP_CARDS)}
              </div>
              <div style={{ marginTop: "12px" }}>
                <span className="badge badge-neutral">Couleur Hors-Atout</span>
                {renderCardGrid(CLASSIC_PLAIN_CARDS)}
              </div>
              <p className="rules-note-line">
                Mode classique couleur : 62 pts à l&apos;atout + 30 pts par autre
                couleur + 10 de der = 162 pts.
              </p>
            </div>
          )}
        </section>

        {/* Règles de comptage & Contrats */}
        <section id="contrats" className="card" aria-labelledby="contracts-heading">
          <span className="eyebrow">Comptage officiel</span>
          <h2
            id="contracts-heading"
            className="section-title"
            style={{ marginTop: "4px" }}
          >
            Contrats, Belote &amp; Coinche
          </h2>

          <ul className="rules-list">
            <li className="rules-item">
              <div className="rules-item-head">
                <span className="rules-item-title">Sans annonces</span>
                <span className="badge badge-neutral">Règle stricte</span>
              </div>
              <p className="rules-item-body">
                Aucune annonce de main n&apos;est comptée (ni tierce, ni
                cinquante, ni cent, ni carré). Pas de règle « partenaire ».
              </p>
            </li>

            <li className="rules-item">
              <div className="rules-item-head">
                <span className="rules-item-title">Contrat passé ou chuté</span>
                <span className="badge badge-pass">Passé = Annonce</span>
              </div>
              <p className="rules-item-body">
                <strong>Contrat passé :</strong> le preneur marque uniquement la
                valeur de son annonce (jamais les points faits en plis) et
                l&apos;adversaire marque 0.{" "}
                <strong>Contrat chuté :</strong> le preneur marque 0 et
                l&apos;adversaire marque 160 pts.
              </p>
            </li>

            <li className="rules-item">
              <div className="rules-item-head">
                <span className="rules-item-title">Belote &amp; Rebelote</span>
                <span className="badge badge-amber">20 pts · Seuil 100+</span>
              </div>
              <p className="rules-item-body">
                Vaut 20 pts. Elle fait baisser le seuil de plis à réaliser{" "}
                <strong>à partir d&apos;un contrat de 100 uniquement</strong>{" "}
                (ex. contrat 100 avec Belote : 80 pts de plis requis ; sur 80 ou
                90, le seuil ne baisse pas). La Belote est hors points
                d&apos;annonce marqués par le preneur.
              </p>
            </li>

            <li className="rules-item">
              <div className="rules-item-head">
                <span className="rules-item-title">Coinche &amp; Surcoinche</span>
                <span className="badge badge-terracotta">x2 / x4</span>
              </div>
              <p className="rules-item-body">
                <strong>Coinche :</strong> double le contrat (ex. 130 passé =
                260 pts ; chuté = 320 pts pour l&apos;adversaire).{" "}
                <strong>Surcoinche :</strong> quadruple le contrat (ex. 130
                passé = 520 pts ; chuté = 640 pts).
              </p>
            </li>

            <li className="rules-item">
              <div className="rules-item-head">
                <span className="rules-item-title">Capot &amp; Générale</span>
                <span className="badge badge-amber">250 / 500 pts</span>
              </div>
              <p className="rules-item-body">
                <strong>Capot annoncé et fait :</strong> 250 pts (tous les plis
                par l&apos;équipe preneuse).{" "}
                <strong>Générale annoncée et faite :</strong> 500 pts (un seul
                joueur remporte les 8 plis).
              </p>
            </li>
          </ul>
        </section>

        {/* Sanction Parlante */}
        <section
          id="parlante"
          className="parlante-callout"
          aria-labelledby="parlante-heading"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangleIcon
              size={18}
              style={{ color: "var(--accent-terracotta)", flexShrink: 0 }}
            />
            <h2 id="parlante-heading" className="parlante-callout-title">
              Parlante : 160 pts immédiats
            </h2>
          </div>
          <p className="rules-item-body">
            Toute parlante (communication non autorisée sur les cartes ou le jeu
            du partenaire) est punie par <strong>160 points attribués immédiatement à l&apos;équipe adverse</strong>. En cas de désaccord à la table, utilisez le bouton{" "}
            <strong>Appeler un arbitre</strong> dans Ma table.
          </p>
        </section>

        {/* Format du tournoi */}
        <section id="tournoi" className="card" aria-labelledby="format-heading">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <TrophyIcon
              size={18}
              style={{ color: "var(--accent-amber)", flexShrink: 0 }}
            />
            <h2 id="format-heading" className="section-title">
              Format du tournoi Coinch&apos;Eirb
            </h2>
          </div>

          <ul className="rules-list">
            <li className="rules-item">
              <div className="rules-item-head">
                <span className="rules-item-title">Phase de poules</span>
                <span className="badge badge-amber">5 donnes (+ 6e)</span>
              </div>
              <p className="rules-item-body">
                Chaque match de poule se joue en 5 donnes. En cas d&apos;égalité
                parfaite après la 5e donne, une <strong>6e donne décisive</strong>{" "}
                départage immédiatement les deux équipes.
              </p>
            </li>

            <li className="rules-item">
              <div className="rules-item-head">
                <span className="rules-item-title">Qualification &amp; Départage</span>
                <span className="badge badge-neutral">Goal-average</span>
              </div>
              <p className="rules-item-body">
                Sur 20 équipes (5 poules de 4), les 3 premiers de chaque poule
                et le meilleur 4e se qualifient (16 équipes, pas de consolante).
                Le goal-average correspond au total de points marqués. En cas
                d&apos;égalité, l&apos;équipe issue de la{" "}
                <strong>poule la plus forte</strong> (total cumulé de points le
                plus élevé) passe devant.
              </p>
            </li>
          </ul>

          <div className="targets-grid" aria-label="Scores cibles en phase finale">
            <div className="target-box">
              <span className="target-stage">Huitièmes</span>
              <span className="target-score">500 pts</span>
            </div>
            <div className="target-box">
              <span className="target-stage">Quarts</span>
              <span className="target-score">600 pts</span>
            </div>
            <div className="target-box">
              <span className="target-stage">Demies</span>
              <span className="target-score">700 pts</span>
            </div>
            <div className="target-box">
              <span className="target-stage">Finale</span>
              <span className="target-score">1000 pts</span>
            </div>
          </div>
        </section>

        {/* Simulateur interactif */}
        <ScoreSimulator />

        <Link href="/ma-table" className="btn btn-primary btn-full">
          <span>Revenir à Ma table</span>
          <ArrowRightIcon size={18} />
        </Link>
      </div>
    </div>
  );
}
