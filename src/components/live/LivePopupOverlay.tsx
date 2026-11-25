"use client";

import { useEffect, useRef } from "react";
import type { AnnouncementType } from "@/types/database";
import { playLivePopupTimeline } from "@/components/live/gsap-engine";
import {
  playLiveSound,
  type LiveSoundSlot,
} from "@/components/live/sound-engine";
import type { LiveAnnouncementEvent } from "@/components/live/types";
import {
  CheckIcon,
  ClubSuitIcon,
  DiamondSuitIcon,
  HeartSuitIcon,
  MegaphoneIcon,
  SpadeSuitIcon,
  TrophyIcon,
  XIcon,
} from "@/components/icons/Icons";

interface LivePopupOverlayProps {
  event: LiveAnnouncementEvent;
  queuedCount: number;
  winnerPhotoUrl?: string;
  soundEnabled: boolean;
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

function resolvePopupMedia(
  event: LiveAnnouncementEvent,
  winnerPhotoUrl: string,
): { src: string; kind: "image" | "video"; caption: string } {
  if (event.specialKind === "first_deal") {
    return {
      src: "/assets/media/popup-premiere-donne.mp4",
      kind: "video",
      caption: "Coup d'envoi · Première donne",
    };
  }
  if (event.specialKind === "elimination") {
    return {
      src: "/assets/media/meme-capri-seum.jpg",
      kind: "image",
      caption: "Capri-Seum · Le bon goût de la défaite",
    };
  }
  if (event.specialKind === "champion") {
    return {
      src: winnerPhotoUrl,
      kind: "image",
      caption: "Champions Coinch'Eirb",
    };
  }
  if (event.phase === "failed") {
    return {
      src: "/assets/media/meme-capri-seum.jpg",
      kind: "image",
      caption: "Contrat chuté · Capri-Seum",
    };
  }
  if (event.announcementType === "generale") {
    return {
      src: "/assets/media/meme-generale.jpg",
      kind: "image",
      caption: "La main de Générale",
    };
  }
  if (
    event.announcementType === "coinche" ||
    event.announcementType === "surcoinche"
  ) {
    if (event.phase === "passed") {
      return {
        src: "/assets/media/meme-tete-sourire.jpg",
        kind: "image",
        caption: "Coinche validée",
      };
    }
    return {
      src: "/assets/media/meme-voulez-vous-coincher.jpg",
      kind: "image",
      caption: "Voulez-vous coincher avec moi ce soir ?",
    };
  }
  if (event.phase === "passed") {
    return {
      src: "/assets/media/meme-tete-langue.jpg",
      kind: "image",
      caption: "Capot passé",
    };
  }
  return {
    src: "/assets/media/soiree-table-cartes.jpg",
    kind: "image",
    caption: "Annonce en cours",
  };
}

function resolveSoundSlot(event: LiveAnnouncementEvent): LiveSoundSlot {
  if (event.specialKind === "first_deal") {
    return "first_deal";
  }
  if (event.specialKind === "champion") {
    return "champion";
  }
  if (event.specialKind === "elimination" || event.phase === "failed") {
    return "failed";
  }
  if (event.phase === "passed") {
    return "passed";
  }
  return "announce";
}

/**
 * Pop-up temps reel anime (file FIFO) avec memes Coinch'Eirb, video Premiere donne
 * et jingles audio gratuits (Web Audio + MP3 perso).
 */
export function LivePopupOverlay(props: LivePopupOverlayProps) {
  const { event, queuedCount, soundEnabled, onComplete } = props;

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
    if (soundEnabled && event.specialKind !== "first_deal") {
      playLiveSound(resolveSoundSlot(event), true);
    }

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
  }, [event, soundEnabled]);

  const titleWord = getAnnouncementDisplayTitle(event.announcementType);
  let resolvedWinnerPhoto = "/assets/media/vainqueur-precedent.jpg";
  if (
    props.winnerPhotoUrl !== undefined &&
    props.winnerPhotoUrl.trim().length > 0
  ) {
    resolvedWinnerPhoto = props.winnerPhotoUrl.trim();
  }
  const media = resolvePopupMedia(event, resolvedWinnerPhoto);

  let cardVariantClass = "live-popup-card live-popup-announced";
  let statusBadgeIcon = <MegaphoneIcon size={18} />;
  let topBadgeText = `TABLE ${event.tableNumber} · ${titleWord}`;
  let mainHeadline = `ANNONCE ${titleWord}`;
  let verdictPillText = "DONNE EN COURS";
  let footerHint = event.contractNote ?? `Table ${event.tableNumber}`;

  if (event.specialKind === "first_deal") {
    cardVariantClass = "live-popup-card live-popup-announced";
    statusBadgeIcon = <SpadeSuitIcon size={18} />;
    topBadgeText = event.customBadge ?? "PREMIÈRE DONNE";
    mainHeadline = event.customHeadline ?? "C'EST PARTI !";
    verdictPillText = `TABLE ${event.tableNumber}`;
    footerHint = event.contractNote ?? "Première donne lancée";
  } else if (event.specialKind === "elimination") {
    cardVariantClass = "live-popup-card live-popup-failed";
    statusBadgeIcon = <XIcon size={19} />;
    topBadgeText = event.customBadge ?? `ÉLIMINÉS · TABLE ${event.tableNumber}`;
    mainHeadline = event.customHeadline ?? "CAPRI-SEUM !";
    verdictPillText = event.contractNote ?? "FIN DE PARCOURS";
    footerHint = "Capri-Seum · Le bon goût de la défaite";
  } else if (event.specialKind === "champion") {
    cardVariantClass = "live-popup-card live-popup-passed";
    statusBadgeIcon = <TrophyIcon size={19} />;
    topBadgeText = event.customBadge ?? "GRANDE FINALE · 1000 PTS";
    mainHeadline = event.customHeadline ?? "CHAMPIONS !";
    verdictPillText = event.contractNote ?? "VICTOIRE FINALE";
    footerHint = "Tournoi Coinch'Eirb";
  } else if (event.phase === "passed") {
    cardVariantClass = "live-popup-card live-popup-passed";
    statusBadgeIcon = <CheckIcon size={19} />;
    topBadgeText = `TABLE ${event.tableNumber} · ${titleWord}`;
    mainHeadline = `${titleWord} PASSÉ`;
    verdictPillText = resolvePassedBadgeText(event);
    footerHint = `Table ${event.tableNumber}`;
  } else if (event.phase === "failed") {
    cardVariantClass = "live-popup-card live-popup-failed";
    statusBadgeIcon = <XIcon size={19} />;
    topBadgeText = `TABLE ${event.tableNumber} · ${titleWord}`;
    mainHeadline = `${titleWord} CHUTÉ`;
    verdictPillText = resolveFailedBadgeText(event);
    footerHint = "Capri-Seum · Défense gagnante";
  }

  let teamLabelText = "Joueurs";
  if (event.specialKind === "elimination") {
    teamLabelText = "Éliminés";
  } else if (event.specialKind === "champion") {
    teamLabelText = "Vainqueurs";
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
              +{queuedCount} en attente
            </span>
          )}
        </div>

        <div className="live-popup-split">
          <div className="live-popup-copy">
            <h2 ref={headlineRef} className="live-popup-headline">
              {mainHeadline}
            </h2>

            <div ref={teamRowRef} className="live-popup-team-box">
              <span className="live-popup-team-label">{teamLabelText}</span>
              <span className="live-popup-team-name">{event.teamName}</span>
              {event.opponentName !== null && (
                <span className="live-popup-opponent">
                  vs {event.opponentName}
                </span>
              )}
            </div>

            <div ref={verdictValueRef} className="live-popup-verdict-pill">
              <span className="tabular-nums">{verdictPillText}</span>
            </div>
          </div>

          <figure className="live-popup-media-frame">
            {media.kind === "video" && (
              <video
                src={media.src}
                autoPlay
                playsInline
                muted={!soundEnabled}
                className="live-popup-media"
              />
            )}
            {media.kind === "image" && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={media.src}
                alt={media.caption}
                className="live-popup-media"
              />
            )}
          </figure>
        </div>

        <div className="live-popup-bottom-row">
          <span className="live-popup-footer-note">{footerHint}</span>
          <div
            ref={suitsStripRef}
            className="live-popup-suits"
            aria-hidden="true"
          >
            <SpadeSuitIcon size={18} className="suit-amber" />
            <HeartSuitIcon size={18} className="suit-crimson" />
            <ClubSuitIcon size={18} className="suit-ivory" />
            <DiamondSuitIcon size={18} className="suit-crimson" />
          </div>
        </div>

        <div className="live-popup-timer-track" aria-hidden="true">
          <div ref={progressBarRef} className="live-popup-timer-fill" />
        </div>
      </div>
    </div>
  );
}
