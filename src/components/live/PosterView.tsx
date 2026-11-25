"use client";

import { useEffect, useState } from "react";
import { QrCodeSvg } from "@/components/live/QrCodeSvg";
import {
  ClockIcon,
  ClubSuitIcon,
  DiamondSuitIcon,
  HeartSuitIcon,
  SpadeSuitIcon,
  TrophyIcon,
} from "@/components/icons/Icons";

interface PosterViewProps {
  posterUrl: string;
  winnerPhotoUrl?: string;
  winnerPhotoCaption?: string;
  tournamentTitle: string;
  startTimeLabel: string;
}

/**
 * Vue 5 : Affiche officielle + Photo du vainqueur + QR code direct (epure, zero blabla).
 */
export function PosterView(props: PosterViewProps) {
  const [tableUrl, setTableUrl] = useState<string>(
    "https://coincheirb.fr/ma-table",
  );
  const [displayOriginPath, setDisplayOriginPath] = useState<string>("/ma-table");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setTableUrl(`${window.location.origin}/ma-table`);
      setDisplayOriginPath(`${window.location.host}/ma-table`);
    }
  }, []);

  const winnerImg =
    props.winnerPhotoUrl ?? "/assets/media/vainqueur-precedent.jpg";
  const winnerLabel =
    props.winnerPhotoCaption ?? "Derniers vainqueurs · Coinch'Eirb";

  return (
    <section
      className="live-view-section live-poster-stage"
      aria-label="Affiche officielle et vainqueurs"
    >
      <figure className="live-poster-showcase">
        <div className="live-poster-image-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={props.posterUrl}
            alt="Affiche de la soirée Coinch'Eirb"
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
            <span>{props.startTimeLabel} · 500 / 600 / 700 / 1000 PTS</span>
          </span>
          <h2 className="live-poster-heading">Coinch&apos;Eirb · ENSEIRB</h2>
        </div>

        <figure className="live-winner-spotlight">
          <div className="live-winner-photo-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={winnerImg}
              alt={winnerLabel}
              className="live-winner-photo-img"
            />
          </div>
          <figcaption className="live-winner-photo-cap">
            <TrophyIcon size={15} className="suit-amber" />
            <span>{winnerLabel}</span>
          </figcaption>
        </figure>

        <div className="live-poster-qr-card">
          <div className="live-poster-qr-box">
            <QrCodeSvg value={tableUrl} size={118} />
          </div>
          <div className="live-poster-qr-copy">
            <span className="live-poster-qr-kicker">Tape ton prénom</span>
            <h3 className="live-poster-qr-title">Rejoins ta table</h3>
            <div className="live-poster-url-pill">{displayOriginPath}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
