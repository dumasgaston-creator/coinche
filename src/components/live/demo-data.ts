import type { AnnouncementType, LivePopupPhase } from "@/types/database";
import type {
  LiveAnnouncementEvent,
  LiveSlideDefinition,
  LiveTournamentSnapshot,
} from "@/components/live/types";

export const LIVE_SLIDES: readonly LiveSlideDefinition[] = [
  {
    id: "pools",
    index: 0,
    shortLabel: "Poules",
    title: "Classement des poules",
    subtitle: "Qualification en direct · 5 donnes par match",
  },
  {
    id: "best_fourths",
    index: 1,
    shortLabel: "Repêchage",
    title: "Course aux meilleurs repêchés",
    subtitle: "Départage par points marqués puis force de la poule",
  },
  {
    id: "tables",
    index: 2,
    shortLabel: "Tables en cours",
    title: "Matchs en cours aux tables",
    subtitle: "5 donnes + 6e donne décisive si égalité",
  },
  {
    id: "bracket",
    index: 3,
    shortLabel: "Arbre final",
    title: "Tableau phase finale",
    subtitle: "Huitièmes 500 pts · Quarts 600 pts · Demies 700 pts · Finale 1000 pts",
  },
  {
    id: "poster",
    index: 4,
    shortLabel: "Soirée",
    title: "Affiche & infos soirée",
    subtitle: "Coinch'Eirb ENSEIRB-MATMECA · Premier tour à 18h30",
  },
];

export function buildDemoTournamentSnapshot(): LiveTournamentSnapshot {
  return {
    tournamentId: "00000000-0000-4000-8000-000000000001",
    tournamentTitle: "Tournoi Coinch'Eirb · BAR ENSEIRB-MATMECA",
    tournamentStatus: "checkin",
    phaseLabel: "Check-in en cours · Départ 18h30",
    startTimeLabel: "1er tour à 18h30",
    posterUrl: "/assets/affiche-soiree.jpg",
    dealsPerPoolMatch: 5,
    roundOf16Threshold: 12,
    poolStandings: [],
    wildcardCandidates: [],
    wildcardSlotsAvailable: 0,
    activeMatches: [],
    bracketMatches: [],
  };
}

export function buildSimulatedAnnouncementEvents(
  scenarioIndex: number,
  seedCounter: number,
): {
  announcedEvent: LiveAnnouncementEvent;
  verdictEvent: LiveAnnouncementEvent;
} {
  const baseId = `event-${Date.now()}-${seedCounter}-${Math.abs(scenarioIndex)}`;
  const nowIso = new Date().toISOString();
  const announcementType: AnnouncementType = "coinche";
  const phase: LivePopupPhase = "passed";

  const announcedEvent: LiveAnnouncementEvent = {
    queueKey: `${baseId}:announced`,
    id: baseId,
    tableNumber: 1,
    teamName: "Coinch'Eirb",
    opponentName: null,
    announcementType,
    phase: "announced",
    pointsAwarded: null,
    contractNote: "En direct du BAR ENSEIRB",
    createdAt: nowIso,
  };

  const verdictEvent: LiveAnnouncementEvent = {
    queueKey: `${baseId}:${phase}`,
    id: baseId,
    tableNumber: 1,
    teamName: "Coinch'Eirb",
    opponentName: null,
    announcementType,
    phase,
    pointsAwarded: 260,
    contractNote: "En direct du BAR ENSEIRB",
    createdAt: nowIso,
  };

  return { announcedEvent, verdictEvent };
}
