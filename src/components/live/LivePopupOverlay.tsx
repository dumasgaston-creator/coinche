"use client";

import { useEffect, useRef } from "react";
import type { AnnouncementType } from "@/types/database";
import { playLivePopupTimeline } from "@/components/live/gsap-engine";
import type { LiveAnnouncementEvent } from "@/components/live/types";
import {
  CheckIcon,
  ClubSuitIcon,
  DiamondSuitIcon,
  HeartSuitIcon,
  MegaphoneIcon,
  SpadeSuitIcon,
  XIcon,
} from "@/components/icons/Icons";

interface LivePopupOverlayProps {
  event: LiveAnnouncementEvent;
  queuedCount: number;
  onComplete: () => void;
}

function getAnnouncementDisplayTitle(type: AnnouncementType): string {
  if (type === "capot") {
    return "CAPOT";
  }
  if (type === "generale") {
    return "GÉNÉRALE";
  }
  if (type === "coinche") {
    return "COINCHE";
  }
  return "SURCOINCHE";
}

function resolvePassedBadgeText(event: LiveAnnouncementEvent): string {
  if (event.announcementType === "capot") {
    const pts = event.pointsAwarded ?? 250;
    return `+${pts} PTS`;
  }
  if (event.announcementType === "generale") {
    const pts = event.pointsAwarded ?? 500;
    return `+${pts} PTS`;
  }
  if (event.announcementType === "coinche") {
    if (event.pointsAwarded !== null) {
      return `X2 · +${event.pointsAwarded} PTS`;
    }
    return "CONTRAT X2";
  }
  if (event.pointsAwarded !== null) {
    return `X4 · +${event.pointsAwarded} PTS`;
  }
  return "CONTRAT X4";
}

function resolveFailedBadgeText(event: LiveAnnouncementEvent): string {
  if (event.announcementType === "coinche") {
    const pts = event.pointsAwarded ?? 320;
    return `${pts} PTS ADVERSAIRE`;
  }
  if (event.announcementType === "surcoinche") {
    const pts = event.pointsAwarded ?? 640;
    return `${pts} PTS ADVERSAIRE`;
  }
  const pts = event.pointsAwarded ?? 160;
  return `${pts} PTS ADVERSAIRE`;
}

/**
 * Pop-up temps reel anime par timeline GSAP (Web Animations API) pour la file FIFO.
 * Deux etats visuels distincts :
 * - Phase 1 (`announced`) : alerte dramatique "TABLE X · ANNONCE ..."
 * - Phase 2 (`passed` / `failed`) : verdict vert (#2D7D4E) ou rouge (#C8342B).
 */
export function LivePopupOverlay(props: LivePopupOverlayProps) {
  const { event, queuedCount, onComplete } = props;

  const backdropRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const badgeRef = useRef<HTMLDivElement | null>(null);
  const headlineRef = useRef<HTMLDivElement | null>(null);
  const teamRowRef = useRef<HTMLDivElement | null>(null);
  const verdictValueRef = useRef<HTMLDivElement | null>(null);
  const suitsStripRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const timeline = playLivePopupTimeline(
      {
        backdrop: backdropRef.current,
        card: cardRef.current,
        badge: badgeRef.current,
        headline: headlineRef.current,
        teamRow: teamRowRef.current,
        verdictValue: verdictValueRef.current,
        suitsStrip: suitsStripRef.current,
        progressBar: progressBarRef.current,
      },
      event.phase,
      () => {
        onCompleteRef.current();
      },
    );

    return () => {
      timeline.kill();
    };
  }, [event.queueKey, event.phase]);

  const titleWord = getAnnouncementDisplayTitle(event.announcementType);

  let cardVariantClass = "live-popup-card live-popup-announced";
  let statusBadgeIcon = <MegaphoneIcon size={18} />;
  let topBadgeText = `TABLE ${event.tableNumber} · ANNONCE EN COURS`;
  let mainHeadline = `ANNONCE ${titleWord}`;
  let verdictPillText = "DONNE EN COURS";
  let footerHint = "Annonce enregistrée sur la feuille de table";

  if (event.phase === "passed") {
    cardVariantClass = "live-popup-card live-popup-passed";
    statusBadgeIcon = <CheckIcon size={19} />;
    topBadgeText = `TABLE ${event.tableNumber} · VERDICT ${titleWord}`;
    mainHeadline = "CONTRAT PASSÉ";
    verdictPillText = resolvePassedBadgeText(event);
    footerHint = `${titleWord} validé à la table ${event.tableNumber}`;
  } else if (event.phase === "failed") {
    cardVariantClass = "live-popup-card live-popup-failed";
    statusBadgeIcon = <XIcon size={19} />;
    topBadgeText = `TABLE ${event.tableNumber} · VERDICT ${titleWord}`;
    mainHeadline = "CONTRAT CHUTÉ";
    verdictPillText = resolveFailedBadgeText(event);
    footerHint = `Points attribués à la défense · Table ${event.tableNumber}`;
  }

  return (
    <div
      ref={backdropRef}
      className="live-popup-backdrop"
      role="status"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div ref={cardRef} className={cardVariantClass}>
        <div className="live-popup-top-row">
          <div ref={badgeRef} className="live-popup-badge">
            {statusBadgeIcon}
            <span>{topBadgeText}</span>
          </div>

          {queuedCount > 0 && (
            <span className="live-popup-fifo-pill tabular-nums">
              File FIFO · {queuedCount} en attente
            </span>
          )}
        </div>

        <h2 ref={headlineRef} className="live-popup-headline">
          {mainHeadline}
        </h2>

        <div ref={teamRowRef} className="live-popup-team-box">
          <span className="live-popup-team-label">Équipe</span>
          <span className="live-popup-team-name">{event.teamName}</span>
          {event.opponentName !== null && (
            <span className="live-popup-opponent">
              face à {event.opponentName}
            </span>
          )}
        </div>

        <div ref={verdictValueRef} className="live-popup-verdict-pill">
          <span className="tabular-nums">{verdictPillText}</span>
        </div>

        <div className="live-popup-bottom-row">
          <span className="live-popup-footer-note">{footerHint}</span>
          <div
            ref={suitsStripRef}
            className="live-popup-suits"
            aria-hidden="true"
          >
            <SpadeSuitIcon size={20} className="suit-amber" />
            <HeartSuitIcon size={20} className="suit-crimson" />
            <ClubSuitIcon size={20} className="suit-ivory" />
            <DiamondSuitIcon size={20} className="suit-crimson" />
          </div>
        </div>

        <div className="live-popup-timer-track" aria-hidden="true">
          <div ref={progressBarRef} className="live-popup-timer-fill" />
        </div>
      </div>
    </div>
  );
}
