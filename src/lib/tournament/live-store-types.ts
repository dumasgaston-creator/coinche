import {
  normalizeComparisonKey,
} from "@/lib/security/sanitize";
import type {
  GeneratedPool,
  PoolStandingSummary,
  QualificationOutcome,
  QualifiedTeamSeed,
  TournamentTeamInput,
} from "@/lib/tournament/types";
import type {
  AnnouncementOutcome,
  AnnouncementType,
  LivePopupPhase,
  MatchPhase,
  MatchStatus,
  RefereeAlertStatus,
  RefereeAlertType,
  TournamentStatus,
} from "@/types/database";

export const UNIFIED_STORE_STORAGE_KEY = "coincheirb-unified-tournament-v3";
export const UNIFIED_BROADCAST_CHANNEL = "coincheirb-live";
export const UNIFIED_LOCAL_EVENT_NAME = "coincheirb-store-updated";
export const LIVE_ANNOUNCEMENT_STORAGE_KEY = "coincheirb-live-announcement";

export interface UnifiedDealRecord {
  id: string;
  dealNumber: number;
  pointsTeamA: number;
  pointsTeamB: number;
  isTiebreaker: boolean;
  specialAnnouncement: AnnouncementType | null;
  announcementOutcome: AnnouncementOutcome | null;
  parlantePenalty: boolean;
}

export interface UnifiedTeamRecord extends TournamentTeamInput {
  shortCode: string;
  promotionLabel: string;
  player1LinkedAccount: string | null;
  player2LinkedAccount: string | null;
}

export interface UnifiedMatchRecord {
  id: string;
  phase: MatchPhase;
  poolNumber: number | null;
  poolLabel: string | null;
  roundNumber: number;
  bracketSlot: number | null;
  tableNumber: number | null;
  teamAId: string | null;
  teamBId: string | null;
  seedA: number | null;
  seedB: number | null;
  scoreTeamA: number;
  scoreTeamB: number;
  targetScore: number | null;
  maxDeals: number | null;
  dealsPlayed: number;
  deals: UnifiedDealRecord[];
  isDirectFinalScore: boolean;
  status: MatchStatus;
  winnerTeamId: string | null;
  forfeitTeamId: string | null;
  lockedByAdmin: boolean;
  nextMatchId: string | null;
  nextMatchSlot: "team_a" | "team_b" | null;
  highlightNote: string | null;
  updatedByRole: "team" | "admin" | null;
  updatedAtLabel: string;
}

export interface UnifiedRefereeAlert {
  id: string;
  matchId: string;
  tableNumber: number;
  requestingTeamId: string;
  requestingTeamName: string;
  alertType: RefereeAlertType;
  message: string;
  status: RefereeAlertStatus;
  createdAtLabel: string;
  resolvedAtLabel: string | null;
}

export interface UnifiedLiveFeedItem {
  id: string;
  tableNumber: number;
  teamName: string;
  announcementType: AnnouncementType;
  phase: LivePopupPhase;
  pointsAwarded: number | null;
  createdAtLabel: string;
}

export interface UnifiedTournamentMeta {
  id: string;
  title: string;
  eventDate: string;
  eventDateLabel: string;
  startsAtLabel: string;
  schoolYear: string;
  status: TournamentStatus;
  registrationsLocked: boolean;
  playerScoreEditingEnabled: boolean;
  roundOf16Threshold: number;
  dealsPerPoolMatch: number;
  targetScoreR16: number;
  targetScoreQf: number;
  targetScoreSf: number;
  targetScoreFinal: number;
  posterUrl: string;
  posterMimeLabel: string;
  posterSizeLabel: string;
  winnerPhotoUrl?: string;
  winnerPhotoCaption?: string;
}

export interface UnifiedTournamentState {
  schemaVersion: 2;
  updatedAt: string;
  tournament: UnifiedTournamentMeta;
  teams: UnifiedTeamRecord[];
  pools: GeneratedPool[];
  matches: UnifiedMatchRecord[];
  alerts: UnifiedRefereeAlert[];
  liveFeed: UnifiedLiveFeedItem[];
}

export interface DerivedKnockoutMatchView {
  id: string;
  isProjected: boolean;
  phase: Exclude<MatchPhase, "pool">;
  roundNumber: number;
  slot: number;
  tableNumber: number | null;
  targetScore: number;
  seedA: number | null;
  seedB: number | null;
  teamAId: string | null;
  teamAName: string;
  teamAPlayers: string;
  teamANickname: string | null;
  teamABinome: string;
  teamBId: string | null;
  teamBName: string;
  teamBPlayers: string;
  teamBNickname: string | null;
  teamBBinome: string;
  scoreTeamA: number;
  scoreTeamB: number;
  status: MatchStatus;
  winnerTeamId: string | null;
  nextMatchId: string | null;
  nextMatchSlot: "team_a" | "team_b" | null;
  highlightNote: string | null;
}

/**
 * Libelle principal d'un binome : les 2 joueurs mis en avant (`Joueur 1 / Joueur 2`).
 */
export function formatPlayersPrimaryName(
  player1Name: string,
  player2Name: string,
): string {
  return `${player1Name} / ${player2Name}`;
}

/**
 * Retourne le surnom d'equipe en petit uniquement s'il est renseigne
 * et distinct du nom des deux joueurs (evite tout doublon).
 */
export function formatOptionalTeamNickname(
  teamName: string,
  player1Name: string,
  player2Name: string,
): string | null {
  const cleaned = teamName.trim();
  if (cleaned.length === 0) {
    return null;
  }
  const normTeam = normalizeComparisonKey(cleaned);
  const normPairSlash = normalizeComparisonKey(`${player1Name} / ${player2Name}`);
  const normPairAmp = normalizeComparisonKey(`${player1Name} & ${player2Name}`);
  const normPairRev = normalizeComparisonKey(`${player2Name} / ${player1Name}`);
  if (
    normTeam === "" ||
    normTeam === normPairSlash ||
    normTeam === normPairAmp ||
    normTeam === normPairRev
  ) {
    return null;
  }
  return cleaned;
}

export interface DerivedTournamentSummary {
  poolStandings: PoolStandingSummary[];
  qualification: QualificationOutcome | null;
  qualifiedLookup: Record<string, QualifiedTeamSeed>;
  knockoutMatches: DerivedKnockoutMatchView[];
  hasRealKnockoutBracket: boolean;
  mostOffensivePoolLabel: string;
  mostOffensivePoolPoints: number;
  highestPoolTeamName: string;
  highestPoolTeamBinome: string;
  highestPoolTeamPoints: number;
  totalDealsPlayed: number;
  totalPointsAllMatches: number;
  capotsAnnounced: number;
  capotsPassed: number;
  generalesAnnounced: number;
  generalesPassed: number;
  coinchesAnnounced: number;
  coinchesPassed: number;
  surcoinchesAnnounced: number;
  surcoinchesPassed: number;
  parlantesPenalized: number;
}

export function formatStoreTimeLabel(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}h${mm}`;
}

function buildDefaultTournamentMeta(
  status: TournamentStatus,
  locked: boolean,
): UnifiedTournamentMeta {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Tournoi Coinch'Eirb · BAR ENSEIRB-MATMECA",
    eventDate: "2026-11-27",
    eventDateLabel: "Saison 2026-2027 · 18h30",
    startsAtLabel: "18h30",
    schoolYear: "2026-2027",
    status,
    registrationsLocked: locked,
    playerScoreEditingEnabled: true,
    roundOf16Threshold: 12,
    dealsPerPoolMatch: 5,
    targetScoreR16: 500,
    targetScoreQf: 600,
    targetScoreSf: 700,
    targetScoreFinal: 1000,
    posterUrl: "/assets/affiche-soiree.jpg",
    posterMimeLabel: "image/jpeg",
    posterSizeLabel: "Affiche officielle",
    winnerPhotoUrl: "/assets/vainqueurs/vainqueur-01.jpg",
    winnerPhotoCaption: "Derniers vainqueurs · Coinch'Eirb",
  };
}

/**
 * Construit un etat initial 100 % vierge (zero joueur fictif, zero match fictif).
 * L'application se construit petit a petit avec les vrais noms des joueurs ENSEIRB.
 */
export function createDefaultUnifiedTournamentState(): UnifiedTournamentState {
  return createCleanCheckinTournamentState();
}

/**
 * Construit un tournoi vierge en phase de check-in (avant 18h30) pret pour une vraie soiree.
 */
export function createCleanCheckinTournamentState(): UnifiedTournamentState {
  const tournament = buildDefaultTournamentMeta("checkin", false);
  return {
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
    tournament,
    teams: [],
    pools: [],
    matches: [],
    alerts: [],
    liveFeed: [],
  };
}

export function findUnifiedTeam(
  teams: readonly UnifiedTeamRecord[],
  teamId: string | null | undefined,
): UnifiedTeamRecord | null {
  if (teamId === null || teamId === undefined) {
    return null;
  }
  for (const team of teams) {
    if (team.id === teamId) {
      return team;
    }
  }
  return null;
}

function getWinningSeedFromMatch(match: UnifiedMatchRecord): number | null {
  if (match.winnerTeamId === match.teamAId) {
    return match.seedA;
  }
  if (match.winnerTeamId === match.teamBId) {
    return match.seedB;
  }
  return null;
}

/**
 * Propage automatiquement les vainqueurs des matchs de phase finale termines
 * vers le tour suivant (`nextMatchId` / `nextMatchSlot` : 8es -> Quarts -> Demies -> Finale).
 */
export function propagateKnockoutWinners(
  matches: UnifiedMatchRecord[],
): UnifiedMatchRecord[] {
  const cloned = matches.map((m) => ({ ...m }));
  const byId = new Map<string, UnifiedMatchRecord>();
  for (const m of cloned) {
    byId.set(m.id, m);
  }

  const orderedPhases: ReadonlyArray<Exclude<MatchPhase, "pool">> = [
    "round_of_16",
    "quarterfinals",
    "semifinals",
    "final",
  ];

  for (const phase of orderedPhases) {
    for (const match of cloned) {
      if (match.phase !== phase) {
        continue;
      }
      if (match.nextMatchId === null || match.nextMatchSlot === null) {
        continue;
      }
      const nextMatch = byId.get(match.nextMatchId);
      if (nextMatch === undefined) {
        continue;
      }

      if (match.winnerTeamId !== null) {
        const winningSeed = getWinningSeedFromMatch(match);
        if (match.nextMatchSlot === "team_a") {
          nextMatch.teamAId = match.winnerTeamId;
          nextMatch.seedA = winningSeed;
        } else {
          nextMatch.teamBId = match.winnerTeamId;
          nextMatch.seedB = winningSeed;
        }
      }

      if (
        nextMatch.teamAId !== null &&
        nextMatch.teamBId !== null &&
        nextMatch.status === "pending"
      ) {
        nextMatch.status = "in_progress";
        if (nextMatch.tableNumber === null) {
          nextMatch.tableNumber = nextMatch.bracketSlot ?? 1;
        }
      }
    }
  }

  return cloned;
}
