"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LIVE_SLIDES,
  buildSimulatedAnnouncementEvents,
} from "@/components/live/demo-data";
import { animateLiveViewEnter } from "@/components/live/gsap-engine";
import { subscribeToLiveChannels } from "@/components/live/live-data-source";
import {
  readSoundEnabledPreference,
  writeSoundEnabledPreference,
} from "@/components/live/sound-engine";
import { LiveTopBar } from "@/components/live/LiveTopBar";
import { LivePopupOverlay } from "@/components/live/LivePopupOverlay";
import { PoolsView } from "@/components/live/PoolsView";
import { BestFourthsView } from "@/components/live/BestFourthsView";
import { ActiveTablesView } from "@/components/live/ActiveTablesView";
import { BracketView } from "@/components/live/BracketView";
import { PosterView } from "@/components/live/PosterView";
import type {
  LiveAnnouncementEvent,
  LiveBracketMatchView,
  LiveSlideDefinition,
  LiveSlideId,
  LiveTableMatchItem,
  LiveTournamentSnapshot,
  RealtimeConnectionMode,
} from "@/components/live/types";
import {
  findUnifiedTeam,
  formatOptionalTeamNickname,
  formatPlayersPrimaryName,
  type DerivedTournamentSummary,
  type UnifiedTournamentState,
} from "@/lib/tournament/live-store";
import { useTournamentStore } from "@/lib/tournament/use-tournament-store";
import type { TournamentStatus } from "@/types/database";

const SLIDE_DURATION_MS = 14000;
const TICK_INTERVAL_MS = 100;
const MAX_SEEN_KEYS = 200;

function findSlideById(id: LiveSlideId): LiveSlideDefinition {
  for (const slide of LIVE_SLIDES) {
    if (slide.id === id) {
      return slide;
    }
  }
  return LIVE_SLIDES[0] as LiveSlideDefinition;
}

function formatStatusPhaseLabel(status: TournamentStatus): string {
  if (status === "checkin") {
    return "Check-in en cours · Départ 18h30";
  }
  if (status === "pools") {
    return "Phase de poules en cours";
  }
  if (status === "round_of_16") {
    return "Huitièmes de finale · 500 pts";
  }
  if (status === "quarterfinals") {
    return "Quarts de finale · 600 pts";
  }
  if (status === "semifinals") {
    return "Demi-finales · 700 pts";
  }
  if (status === "final") {
    return "Finale · 1000 pts";
  }
  if (status === "completed") {
    return "Tournoi terminé · Podium officiel";
  }
  return "Préparation du tournoi";
}

function buildLiveSnapshotFromUnifiedStore(
  state: UnifiedTournamentState,
  summary: DerivedTournamentSummary,
): LiveTournamentSnapshot {
  const teamDisplayById: LiveTournamentSnapshot["teamDisplayById"] = {};
  for (const team of state.teams) {
    teamDisplayById[team.id] = {
      players: formatPlayersPrimaryName(team.player1Name, team.player2Name),
      nickname: formatOptionalTeamNickname(
        team.teamName,
        team.player1Name,
        team.player2Name,
      ),
    };
  }

  let wildcardCandidates: LiveTournamentSnapshot["wildcardCandidates"] = [];
  let wildcardSlotsAvailable = 1;
  let wildcardRank: number | null = 4;
  let directTopRank = 3;
  if (summary.qualification !== null) {
    wildcardCandidates = summary.qualification.wildcardCandidatesRanked;
    wildcardRank = summary.qualification.wildcardRank;
    const directTeams = summary.qualification.qualifiedTeams.filter(
      (q) => q.qualificationReason === "direct_top_n",
    );
    wildcardSlotsAvailable = Math.max(
      0,
      summary.qualification.format.qualifierCount - directTeams.length,
    );
    let maxDirectRank = 0;
    for (const dt of directTeams) {
      if (dt.poolRank > maxDirectRank) {
        maxDirectRank = dt.poolRank;
      }
    }
    if (maxDirectRank > 0) {
      directTopRank = maxDirectRank;
    }
  }

  const totalActiveTeams = state.teams.filter(
    (t) => t.checkedIn && !t.isForfeit,
  ).length;

  const prioritizedMatches = [...state.matches]
    .filter((m) => m.tableNumber !== null && m.status !== "bye")
    .sort((a, b) => {
      let rankA = 1;
      if (a.status === "in_progress") {
        rankA = 0;
      } else if (a.status === "completed") {
        rankA = 2;
      }
      let rankB = 1;
      if (b.status === "in_progress") {
        rankB = 0;
      } else if (b.status === "completed") {
        rankB = 2;
      }
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return (a.tableNumber ?? 99) - (b.tableNumber ?? 99);
    })
    .slice(0, 12);

  const activeMatches: LiveTableMatchItem[] = [];
  for (const m of prioritizedMatches) {
    const teamA = findUnifiedTeam(state.teams, m.teamAId);
    const teamB = findUnifiedTeam(state.teams, m.teamBId);
    if (teamA === null || teamB === null || m.tableNumber === null) {
      continue;
    }

    let phaseLabel = `Poules · Tour ${m.roundNumber}`;
    if (m.phase === "pool" && m.poolLabel !== null) {
      phaseLabel = `${m.poolLabel} · Tour ${m.roundNumber}`;
    } else if (m.phase === "round_of_16") {
      phaseLabel = "Huitième · 500 pts";
    } else if (m.phase === "quarterfinals") {
      phaseLabel = "Quart · 600 pts";
    } else if (m.phase === "semifinals") {
      phaseLabel = "Demi-finale · 700 pts";
    } else if (m.phase === "final") {
      phaseLabel = "Finale · 1000 pts";
    }

    let tone: LiveTableMatchItem["recentAnnouncementTone"] = "neutral";
    let note = m.highlightNote;
    if (
      note === null &&
      m.phase === "pool" &&
      m.dealsPlayed >= state.tournament.dealsPerPoolMatch &&
      m.scoreTeamA === m.scoreTeamB &&
      m.status === "in_progress"
    ) {
      note = "Égalité · 6e donne décisive";
      tone = "amber";
    } else if (note !== null) {
      if (note.includes("Passé")) {
        tone = "pass";
      } else if (note.includes("Chuté")) {
        tone = "fail";
      } else {
        tone = "amber";
      }
    }

    activeMatches.push({
      id: m.id,
      tableNumber: m.tableNumber,
      phase: m.phase,
      phaseLabel,
      roundNumber: m.roundNumber,
      teamAId: teamA.id,
      teamAName: teamA.teamName,
      teamAPlayers: formatPlayersPrimaryName(teamA.player1Name, teamA.player2Name),
      teamANickname: formatOptionalTeamNickname(
        teamA.teamName,
        teamA.player1Name,
        teamA.player2Name,
      ),
      teamBId: teamB.id,
      teamBName: teamB.teamName,
      teamBPlayers: formatPlayersPrimaryName(teamB.player1Name, teamB.player2Name),
      teamBNickname: formatOptionalTeamNickname(
        teamB.teamName,
        teamB.player1Name,
        teamB.player2Name,
      ),
      scoreTeamA: m.scoreTeamA,
      scoreTeamB: m.scoreTeamB,
      dealsPlayed: m.dealsPlayed,
      maxDeals: m.maxDeals,
      targetScore: m.targetScore,
      status: m.status,
      recentAnnouncement: note,
      recentAnnouncementTone: tone,
    });
  }

  const bracketMatches: LiveBracketMatchView[] = summary.knockoutMatches.map(
    (km) => {
      let nodeStatus: "pending" | "bye" = "pending";
      if (km.status === "bye") {
        nodeStatus = "bye";
      }
      return {
        node: {
          tempId: km.id,
          phase: km.phase,
          roundNumber: km.roundNumber,
          bracketSlot: km.slot,
          tableNumber: km.tableNumber,
          targetScore: km.targetScore,
          teamAId: km.teamAId,
          teamBId: km.teamBId,
          seedA: km.seedA,
          seedB: km.seedB,
          status: nodeStatus,
          winnerTeamId: km.winnerTeamId,
          nextMatchTempId: km.nextMatchId,
          nextMatchSlot: km.nextMatchSlot,
        },
        teamAName: km.teamAName,
        teamAPlayers: km.teamAPlayers,
        teamANickname: km.teamANickname,
        teamBName: km.teamBName,
        teamBPlayers: km.teamBPlayers,
        teamBNickname: km.teamBNickname,
        scoreTeamA: km.scoreTeamA,
        scoreTeamB: km.scoreTeamB,
        status: km.status,
        winnerTeamId: km.winnerTeamId,
      };
    },
  );

  return {
    tournamentId: state.tournament.id,
    tournamentTitle: state.tournament.title,
    tournamentStatus: state.tournament.status,
    phaseLabel: formatStatusPhaseLabel(state.tournament.status),
    startTimeLabel: `1er tour à ${state.tournament.startsAtLabel}`,
    posterUrl: state.tournament.posterUrl,
    winnerPhotoUrl:
      state.tournament.winnerPhotoUrl ?? "/assets/media/vainqueur-precedent.jpg",
    winnerPhotoCaption:
      state.tournament.winnerPhotoCaption ?? "Derniers vainqueurs · Coinch'Eirb",
    dealsPerPoolMatch: state.tournament.dealsPerPoolMatch,
    roundOf16Threshold: state.tournament.roundOf16Threshold,
    poolStandings: summary.poolStandings,
    wildcardCandidates,
    wildcardSlotsAvailable,
    wildcardRank,
    directTopRank,
    totalActiveTeams,
    qualifiedLookup: summary.qualifiedLookup,
    activeMatches,
    bracketMatches,
    teamDisplayById,
  };
}

/**
 * Orchestrateur principal de la vue Videoprojecteur (/live).
 * - Relie en direct au store temps reel unifie (`/ma-table`, `/admin`, `/classement`)
 * - Ecoute Supabase Realtime + BroadcastChannel("coincheirb-live") + storage
 * - File d'attente FIFO stricte pour les pop-ups GSAP (~4.5s chacun)
 */
export function LiveProjectorApp() {
  const { state: storeState, summary: storeSummary } = useTournamentStore();
  const [supabaseSnapshot, setSupabaseSnapshot] =
    useState<LiveTournamentSnapshot | null>(null);
  const [connectionMode, setConnectionMode] =
    useState<RealtimeConnectionMode>("demo");
  const [activeSlideId, setActiveSlideId] = useState<LiveSlideId>("pools");
  const [isPaused, setIsPaused] = useState<boolean>(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const vue = params.get("vue");
      if (
        vue === "pools" ||
        vue === "best_fourths" ||
        vue === "tables" ||
        vue === "bracket" ||
        vue === "poster"
      ) {
        setActiveSlideId(vue);
      }
    } catch {
      // Ignore
    }
  }, []);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [fullscreenNotice, setFullscreenNotice] = useState<string | null>(null);

  useEffect(() => {
    setSoundEnabled(readSoundEnabledPreference());
  }, []);

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      writeSoundEnabledPreference(next);
      return next;
    });
  }, []);

  const [popupQueue, setPopupQueue] = useState<LiveAnnouncementEvent[]>([]);
  const [activePopup, setActivePopup] =
    useState<LiveAnnouncementEvent | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const seenQueueKeysRef = useRef<string[]>([]);
  const simScenarioIdxRef = useRef<number>(0);
  const simCounterRef = useRef<number>(0);
  const simTimeoutsRef = useRef<number[]>([]);

  const storeSnapshot = useMemo(
    () => buildLiveSnapshotFromUnifiedStore(storeState, storeSummary),
    [storeState, storeSummary],
  );

  let snapshot = storeSnapshot;
  if (connectionMode === "supabase" && supabaseSnapshot !== null) {
    snapshot = supabaseSnapshot;
  }

  const enqueueAnnouncement = useCallback((event: LiveAnnouncementEvent) => {
    if (seenQueueKeysRef.current.includes(event.queueKey)) {
      return;
    }
    seenQueueKeysRef.current.push(event.queueKey);
    if (seenQueueKeysRef.current.length > MAX_SEEN_KEYS) {
      seenQueueKeysRef.current.shift();
    }

    setPopupQueue((prev) => [...prev, event]);
  }, []);

  useEffect(() => {
    if (activePopup !== null || popupQueue.length === 0) {
      return;
    }
    const nextEvent = popupQueue[0];
    if (nextEvent === undefined) {
      return;
    }
    setActivePopup(nextEvent);
    setPopupQueue((prev) => prev.slice(1));
  }, [activePopup, popupQueue]);

  const handlePopupComplete = useCallback(() => {
    setActivePopup(null);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToLiveChannels({
      onAnnouncement: enqueueAnnouncement,
      onSnapshotUpdate: (freshSnapshot) => {
        setSupabaseSnapshot(freshSnapshot);
      },
      onConnectionModeChange: (mode) => {
        setConnectionMode(mode);
      },
    });

    return () => {
      unsubscribe();
      for (const timerId of simTimeoutsRef.current) {
        window.clearTimeout(timerId);
      }
      simTimeoutsRef.current = [];
    };
  }, [enqueueAnnouncement]);

  useEffect(() => {
    const tl = animateLiveViewEnter(stageRef.current);
    return () => {
      tl.kill();
    };
  }, [activeSlideId]);

  const stepSlide = useCallback((direction: -1 | 1) => {
    setActiveSlideId((currentId) => {
      const currentSlide = findSlideById(currentId);
      const total = LIVE_SLIDES.length;
      const nextIdx = (currentSlide.index + direction + total) % total;
      const nextSlide = LIVE_SLIDES[nextIdx] ?? LIVE_SLIDES[0];
      if (nextSlide === undefined) {
        return "pools";
      }
      return nextSlide.id;
    });
    setElapsedMs(0);
  }, []);

  useEffect(() => {
    if (isPaused || activePopup !== null) {
      return;
    }

    const timerId = window.setInterval(() => {
      setElapsedMs((prev) => {
        const next = prev + TICK_INTERVAL_MS;
        if (next >= SLIDE_DURATION_MS) {
          stepSlide(1);
          return 0;
        }
        return next;
      });
    }, TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, [isPaused, activePopup, stepSlide]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
      if (document.fullscreenElement !== null) {
        setFullscreenNotice(null);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }
    setFullscreenNotice(null);

    if (document.fullscreenElement !== null) {
      void document.exitFullscreen().catch(() => {
        setFullscreenNotice(null);
      });
      return;
    }

    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };

    if (typeof docEl.requestFullscreen === "function") {
      docEl.requestFullscreen().catch(() => {
        setFullscreenNotice(
          "Plein écran bloqué par ce cadre navigateur : ouvrez /live dans un onglet dédié ou appuyez sur F11.",
        );
      });
      return;
    }

    if (typeof docEl.webkitRequestFullscreen === "function") {
      void docEl.webkitRequestFullscreen();
      return;
    }

    setFullscreenNotice(
      "Appuyez sur F11 (Windows/Linux) ou Ctrl+Cmd+F (Mac) pour activer le plein écran.",
    );
  }, []);

  const handleSelectSlide = useCallback((slideId: LiveSlideId) => {
    setActiveSlideId(slideId);
    setElapsedMs(0);
  }, []);

  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        handleTogglePause();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        stepSlide(1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        stepSlide(-1);
        return;
      }
      if (event.key === "1") {
        handleSelectSlide("pools");
      } else if (event.key === "2") {
        handleSelectSlide("best_fourths");
      } else if (event.key === "3") {
        handleSelectSlide("tables");
      } else if (event.key === "4") {
        handleSelectSlide("bracket");
      } else if (event.key === "5") {
        handleSelectSlide("poster");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleSelectSlide, handleTogglePause, stepSlide]);

  const handleTriggerFirstDealPopup = useCallback(() => {
    const id = `first-deal-${Date.now()}`;
    enqueueAnnouncement({
      queueKey: `${id}:announced:first_deal`,
      id,
      tableNumber: 1,
      teamName: "Toutes les tables",
      opponentName: null,
      announcementType: "coinche",
      phase: "announced",
      pointsAwarded: null,
      contractNote: "Bon tournoi Coinch'Eirb !",
      createdAt: new Date().toISOString(),
      specialKind: "first_deal",
      customHeadline: "PREMIÈRE DONNE !",
      customBadge: "COUP D'ENVOI · COINCH'EIRB",
    });
  }, [enqueueAnnouncement]);

  const handleSimulateAnnouncement = useCallback(() => {
    const idx = simScenarioIdxRef.current;
    const counter = simCounterRef.current;
    simScenarioIdxRef.current += 1;
    simCounterRef.current += 1;

    if (idx % 3 === 2) {
      const elimId = `sim-elim-${Date.now()}-${counter}`;
      enqueueAnnouncement({
        queueKey: `${elimId}:failed:elimination`,
        id: elimId,
        tableNumber: 2,
        teamName: "Chahe / Antonin",
        opponentName: "Angèle / Kamila",
        announcementType: "coinche",
        phase: "failed",
        pointsAwarded: 500,
        contractNote: "Sortis 380 – 520 en Huitième",
        createdAt: new Date().toISOString(),
        specialKind: "elimination",
        customHeadline: "CAPRI-SEUM !",
        customBadge: "ÉLIMINÉS EN HUITIÈME (500 PTS)",
      });
      return;
    }

    const pair = buildSimulatedAnnouncementEvents(idx, counter);
    enqueueAnnouncement(pair.announcedEvent);

    const verdictTimer = window.setTimeout(() => {
      enqueueAnnouncement(pair.verdictEvent);
    }, 2400);
    simTimeoutsRef.current.push(verdictTimer);
  }, [enqueueAnnouncement]);

  const currentSlide = findSlideById(activeSlideId);
  let dynamicSlideTitle = currentSlide.title;
  let dynamicSlideSubtitle = currentSlide.subtitle;
  const activeRankNum = snapshot.wildcardRank ?? 4;
  const activeDirectTop = snapshot.directTopRank ?? 3;
  const totalTeamsCount = snapshot.totalActiveTeams ?? 20;

  if (activeSlideId === "pools") {
    let wildcardPiece = "";
    if (snapshot.wildcardSlotsAvailable > 0 && snapshot.wildcardRank !== null) {
      if (snapshot.wildcardSlotsAvailable === 1) {
        wildcardPiece = ` + 1 meilleur ${activeRankNum}e`;
      } else {
        wildcardPiece = ` + ${snapshot.wildcardSlotsAvailable} meilleurs ${activeRankNum}es`;
      }
    }
    dynamicSlideSubtitle = `${totalTeamsCount} équipes · ${snapshot.poolStandings.length} poules · Top ${activeDirectTop}${wildcardPiece} qualifiés`;
  } else if (activeSlideId === "best_fourths") {
    dynamicSlideTitle = `Course aux meilleurs ${activeRankNum}es`;
    let ticketWord = "billet qualificatif";
    if (snapshot.wildcardSlotsAvailable > 1) {
      ticketWord = "billets qualificatifs";
    }
    dynamicSlideSubtitle = `${snapshot.wildcardSlotsAvailable} ${ticketWord} · Départage par points marqués puis force de la poule`;
  }
  const progressPercent = Math.min(
    100,
    Math.round((elapsedMs / SLIDE_DURATION_MS) * 100),
  );

  let rotationStateText = "Rotation auto · 14s";
  if (activePopup !== null) {
    rotationStateText = "Annonce en cours";
  } else if (isPaused) {
    rotationStateText = "Rotation en pause";
  }

  return (
    <div ref={rootRef} className="live-projector-root">
      <LiveTopBar
        activeSlideId={activeSlideId}
        phaseLabel={snapshot.phaseLabel}
        connectionMode={connectionMode}
        isPaused={isPaused}
        isFullscreen={isFullscreen}
        soundEnabled={soundEnabled}
        fullscreenNotice={fullscreenNotice}
        queuedCount={popupQueue.length}
        hasActivePopup={activePopup !== null}
        rotationProgressPercent={progressPercent}
        onSelectSlide={handleSelectSlide}
        onStepSlide={stepSlide}
        onTogglePause={handleTogglePause}
        onToggleFullscreen={handleToggleFullscreen}
        onToggleSound={handleToggleSound}
        onTriggerFirstDealPopup={handleTriggerFirstDealPopup}
        onSimulateAnnouncement={handleSimulateAnnouncement}
      />

      <main className="live-main-stage">
        <div className="live-slide-banner">
          <div>
            <span className="live-slide-kicker tabular-nums">
              Écran {currentSlide.index + 1} / {LIVE_SLIDES.length} ·{" "}
              {snapshot.tournamentTitle}
            </span>
            <h1 className="live-slide-title">{dynamicSlideTitle}</h1>
          </div>
          <p className="live-slide-subtitle">{dynamicSlideSubtitle}</p>
        </div>

        <div ref={stageRef} key={activeSlideId} className="live-stage-viewport">
          {activeSlideId === "pools" && (
            <PoolsView
              pools={snapshot.poolStandings}
              wildcardCandidates={snapshot.wildcardCandidates}
              qualifiedLookup={snapshot.qualifiedLookup}
              directTopRank={snapshot.directTopRank}
              wildcardRank={snapshot.wildcardRank}
              teamDisplayById={snapshot.teamDisplayById}
            />
          )}

          {activeSlideId === "best_fourths" && (
            <BestFourthsView
              candidates={snapshot.wildcardCandidates}
              wildcardSlotsAvailable={snapshot.wildcardSlotsAvailable}
              wildcardRank={snapshot.wildcardRank}
              directTopRank={snapshot.directTopRank}
              teamDisplayById={snapshot.teamDisplayById}
            />
          )}

          {activeSlideId === "tables" && (
            <ActiveTablesView matches={snapshot.activeMatches} />
          )}

          {activeSlideId === "bracket" && (
            <BracketView
              matches={snapshot.bracketMatches}
              posterUrl={snapshot.posterUrl}
              winnerPhotoUrl={snapshot.winnerPhotoUrl}
              tournamentTitle={snapshot.tournamentTitle}
            />
          )}

          {activeSlideId === "poster" && (
            <PosterView
              posterUrl={snapshot.posterUrl}
              winnerPhotoUrl={snapshot.winnerPhotoUrl}
              winnerPhotoCaption={snapshot.winnerPhotoCaption}
              tournamentTitle={snapshot.tournamentTitle}
              startTimeLabel={snapshot.startTimeLabel}
            />
          )}
        </div>
      </main>

      <footer className="live-footer-bar">
        <div className="live-footer-left">
          <span className="live-footer-status">{rotationStateText}</span>
          <span className="live-footer-hints">
            Touches 1–5 · Espace (Pause) · Flèches (Changer de vue)
          </span>
        </div>

        <div className="live-footer-dots" aria-hidden="true">
          {LIVE_SLIDES.map((slide) => {
            let dotActive = "false";
            if (slide.id === activeSlideId) {
              dotActive = "true";
            }
            return (
              <span
                key={slide.id}
                className="live-footer-dot"
                data-active={dotActive}
              />
            );
          })}
        </div>
      </footer>

      {activePopup !== null && (
        <LivePopupOverlay
          event={activePopup}
          queuedCount={popupQueue.length}
          winnerPhotoUrl={snapshot.winnerPhotoUrl}
          soundEnabled={soundEnabled}
          onComplete={handlePopupComplete}
        />
      )}
    </div>
  );
}
