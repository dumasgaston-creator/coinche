"use client";

import { useEffect, useState } from "react";
import { QrCodeSvg } from "@/components/live/QrCodeSvg";
import {
  ClockIcon,
  ClubSuitIcon,
  DiamondSuitIcon,
  HeartSuitIcon,
  SpadeSuitIcon,
  TableCardsIcon,
  TrophyIcon,
} from "@/components/icons/Icons";

interface PosterViewProps {
  posterUrl: string;
  tournamentTitle: string;
  startTimeLabel: string;
}

/**
 * Vue 5 : Mise en scene grand format de l'affiche de la soiree,
 * informations de debut a 18h30, regles cles et acces rapide mobile (/ma-table).
 */
export function PosterView(props: PosterViewProps) {
  const [tableUrl, setTableUrl] = useState<string>("https://coincheirb.fr/ma-table");
  const [displayOriginPath, setDisplayOriginPath] = useState<string>("/ma-table");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      setTableUrl(`${origin}/ma-table`);
      setDisplayOriginPath(`${window.location.host}/ma-table`);
    }
  }, []);

  return (
    <section
      className="live-view-section live-poster-stage"
      aria-label="Affiche officielle de la soirée"
    >
      <figure className="live-poster-showcase">
        <div className="live-poster-image-frame">
          <img
            src={props.posterUrl}
            alt="Affiche officielle Coinch'Eirb : Voulez-vous coincher avec moi ce soir"
            className="live-poster-img"
          />
        </div>
        <figcaption className="live-poster-caption">
          <span>{props.tournamentTitle}</span>
          <span className="live-poster-suits" aria-hidden="true">
            <ClubSuitIcon size={15} />
            <DiamondSuitIcon size={15} className="suit-crimson" />
            <SpadeSuitIcon size={15} />
            <HeartSuitIcon size={15} className="suit-crimson" />
          </span>
        </figcaption>
      </figure>

      <div className="live-poster-info-panel">
        <div className="live-poster-hero-box">
          <span className="live-poster-eyebrow">
            <ClockIcon size={15} />
            <span>{props.startTimeLabel} · Rythme libre par table</span>
          </span>
          <h2 className="live-poster-heading">Soirée Tournoi Coinch&apos;Eirb</h2>
          <p className="live-poster-lead">
            Enregistrement des équipes avant 18h30. Un seul téléphone par table
            pour saisir les 5 donnes, envoyer vos annonces en direct sur cet écran
            ou appeler un arbitre.
          </p>
        </div>

        <div className="live-poster-rules-grid">
          <div className="live-poster-rule-card">
            <div className="live-poster-rule-head">
              <TableCardsIcon size={17} className="suit-amber" />
              <h3>Barème des contrats</h3>
            </div>
            <ul className="live-poster-rule-list">
              <li>Capot annoncé et fait : +250 pts</li>
              <li>Générale annoncée et faite : +500 pts</li>
              <li>Coinche : x2 (320 pts si chutée) · Surcoinche : x4</li>
              <li>Belote : 20 pts (abaisse le seuil dès 100) · Parlante : 160 pts</li>
            </ul>
          </div>

          <div className="live-poster-rule-card">
            <div className="live-poster-rule-head">
              <TrophyIcon size={17} className="suit-amber" />
              <h3>Format &amp; phase finale</h3>
            </div>
            <ul className="live-poster-rule-list">
              <li>Poules en 5 donnes (+ 6e donne en cas d&apos;égalité)</li>
              <li>Huitièmes en 500 pts · Quarts en 600 pts</li>
              <li>Demi-finales en 700 pts · Finale en 1000 pts</li>
              <li>Départage égalité : poule au cumul de points le plus élevé</li>
            </ul>
          </div>
        </div>

        <div className="live-poster-qr-card">
          <div className="live-poster-qr-box">
            <QrCodeSvg value={tableUrl} size={136} />
          </div>
          <div className="live-poster-qr-copy">
            <span className="live-poster-qr-kicker">Accès joueur immédiat</span>
            <h3 className="live-poster-qr-title">Ouvrir « Ma table »</h3>
            <p className="live-poster-qr-desc">
              Scannez ce code avec votre téléphone ou saisissez votre nom
              d&apos;équipe sur :
            </p>
            <div className="live-poster-url-pill">{displayOriginPath}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
