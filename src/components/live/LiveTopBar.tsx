"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LIVE_SLIDES } from "@/components/live/demo-data";
import type {
  LiveSlideId,
  RealtimeConnectionMode,
} from "@/components/live/types";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MaximizeIcon,
  MinimizeIcon,
  PauseIcon,
  PlayIcon,
  RadioIcon,
} from "@/components/live/LiveIcons";
import { ClockIcon, MegaphoneIcon, TableCardsIcon } from "@/components/icons/Icons";

interface LiveTopBarProps {
  activeSlideId: LiveSlideId;
  phaseLabel: string;
  connectionMode: RealtimeConnectionMode;
  isPaused: boolean;
  isFullscreen: boolean;
  soundEnabled: boolean;
  fullscreenNotice: string | null;
  queuedCount: number;
  hasActivePopup: boolean;
  rotationProgressPercent: number;
  onSelectSlide: (slideId: LiveSlideId) => void;
  onStepSlide: (direction: -1 | 1) => void;
  onTogglePause: () => void;
  onToggleFullscreen: () => void;
  onToggleSound: () => void;
  onTriggerFirstDealPopup: () => void;
}

function formatClock(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/**
 * Bandeau superieur plein ecran du videoprojecteur /live :
 * Logo Coinch'Eirb, horloge temps reel, phase en cours, statut temps reel,
 * bouton Plein ecran et bouton explicite de retour vers les tables.
 */
export function LiveTopBar(props: LiveTopBarProps) {
  const [clockLabel, setClockLabel] = useState<string>("--:--:--");

  useEffect(() => {
    setClockLabel(formatClock(new Date()));
    const intervalId = window.setInterval(() => {
      setClockLabel(formatClock(new Date()));
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  let statusClass = "live-conn-pill live-conn-online";
  let statusText = "Temps réel synchronisé";
  if (props.connectionMode === "supabase") {
    statusClass = "live-conn-pill live-conn-online";
    statusText = "Temps réel Supabase";
  } else if (props.connectionMode === "connecting") {
    statusClass = "live-conn-pill live-conn-connecting";
    statusText = "Synchronisation...";
  }

  let pauseIcon = <PauseIcon size={15} />;
  let pauseLabel = "Pause";
  let pauseAria = "Mettre la rotation automatique en pause";
  if (props.isPaused) {
    pauseIcon = <PlayIcon size={15} />;
    pauseLabel = "Lecture";
    pauseAria = "Reprendre la rotation automatique";
  }

  let fsIcon = <MaximizeIcon size={15} />;
  let fsLabel = "Plein écran";
  if (props.isFullscreen) {
    fsIcon = <MinimizeIcon size={15} />;
    fsLabel = "Fenêtrer";
  }

  const totalPendingInQueue = props.queuedCount;

  let soundLabel = "Son OFF";
  if (props.soundEnabled) {
    soundLabel = "Son ON";
  }

  return (
    <header className="live-topbar">
      <div className="live-topbar-row">
        <div className="live-brand-group">
          <Link
            href="/"
            className="live-brand-link"
            title="Retour à l'accueil Coinch'Eirb"
          >
            <img
              src="/assets/media/logo-abeilles.jpg"
              alt="Logo abeilles Coinch'Eirb"
              width={40}
              height={40}
              className="live-brand-logo"
            />
            <div className="live-brand-text">
              <span className="live-brand-title">Coinch&apos;Eirb</span>
              <span className="live-brand-sub">ENSEIRB-MATMECA · LIVE</span>
            </div>
          </Link>

          <div className="live-phase-chip" title="Phase en cours">
            <span className="live-phase-dot" aria-hidden="true" />
            <span>{props.phaseLabel}</span>
          </div>

          <div className={statusClass} role="status" aria-live="polite">
            <RadioIcon size={14} />
            <span>{statusText}</span>
          </div>
        </div>

        <nav
          className="live-slide-nav"
          aria-label="Sélection manuelle des vues projecteur"
        >
          <button
            type="button"
            className="live-icon-btn"
            onClick={() => props.onStepSlide(-1)}
            aria-label="Vue précédente"
          >
            <ChevronLeftIcon size={16} />
          </button>

          <div className="live-slide-pills">
            {LIVE_SLIDES.map((slide) => {
              let activeAttr = "false";
              if (slide.id === props.activeSlideId) {
                activeAttr = "true";
              }
              return (
                <button
                  key={slide.id}
                  type="button"
                  className="live-slide-pill"
                  data-active={activeAttr}
                  onClick={() => props.onSelectSlide(slide.id)}
                >
                  <span className="tabular-nums">{slide.index + 1}.</span>
                  <span>{slide.shortLabel}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="live-icon-btn"
            onClick={() => props.onStepSlide(1)}
            aria-label="Vue suivante"
          >
            <ChevronRightIcon size={16} />
          </button>
        </nav>

        <div className="live-controls-group">
          <button
            type="button"
            className="live-ctrl-btn"
            onClick={props.onToggleSound}
            data-paused={String(props.soundEnabled)}
            title="Activer ou couper les effets sonores des pop-ups"
          >
            <span>{soundLabel}</span>
          </button>

          <button
            type="button"
            className="live-ctrl-btn"
            onClick={props.onTriggerFirstDealPopup}
            title="Lancer la vidéo Première Donne sur le projecteur"
          >
            <span>1re Donne</span>
            {totalPendingInQueue > 0 && (
              <span className="live-queue-badge tabular-nums">
                +{totalPendingInQueue}
              </span>
            )}
          </button>

          <button
            type="button"
            className="live-ctrl-btn"
            onClick={props.onTogglePause}
            aria-label={pauseAria}
            data-paused={String(props.isPaused)}
          >
            {pauseIcon}
            <span>{pauseLabel}</span>
          </button>

          <button
            type="button"
            className="live-ctrl-btn"
            onClick={props.onToggleFullscreen}
            aria-label={fsLabel}
          >
            {fsIcon}
            <span>{fsLabel}</span>
          </button>

          <Link
            href="/ma-table"
            className="live-ctrl-btn"
            title="Quitter le mode projecteur et retourner aux tables"
          >
            <TableCardsIcon size={15} />
            <span>Retour tables</span>
          </Link>

          <div className="live-clock-box" aria-label="Heure actuelle">
            <ClockIcon size={15} />
            <span className="live-clock-value tabular-nums">{clockLabel}</span>
          </div>
        </div>
      </div>

      {props.fullscreenNotice !== null && (
        <div
          role="status"
          style={{
            padding: "6px 20px",
            backgroundColor: "#3a2d15",
            color: "#f7f2e8",
            fontSize: "12.5px",
            borderTop: "1px solid #e8a628",
          }}
        >
          {props.fullscreenNotice}
        </div>
      )}

      <div className="live-progress-track" aria-hidden="true">
        <div
          className="live-progress-fill"
          style={{ width: `${props.rotationProgressPercent}%` }}
        />
      </div>
    </header>
  );
}
