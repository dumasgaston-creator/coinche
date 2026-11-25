import {
  normalizeComparisonKey,
  sanitizePlainName,
} from "@/lib/security/sanitize";
import { generateKnockoutBracket } from "@/lib/tournament/bracket";
import {
  formatPoolLabel,
  generatePoolsAndSchedule,
} from "@/lib/tournament/pool-generator";
import {
  computePoolStandings,
  determineKnockoutFormat,
  resolvePoolQualifications,
} from "@/lib/tournament/qualification";
import { evaluateMatchProgress } from "@/lib/tournament/scoring";
import type {
  CompletedPoolMatchInput,
  GeneratedBracketNode,
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

export const UNIFIED_STORE_STORAGE_KEY = "coincheirb-unified-tournament-v2";
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

const SEED_TEAMS_DATA: ReadonlyArray<{
  shortCode: string;
  teamName: string;
  player1Name: string;
  player2Name: string;
  promotionLabel: string;
}> = [
  { shortCode: "A01", teamName: "Les Valets d'Eirb", player1Name: "Lucas Martin", player2Name: "Camille Durand", promotionLabel: "2A Info" },
  { shortCode: "A02", teamName: "Atout Pique 33", player1Name: "Maxime Lefèvre", player2Name: "Sarah Benali", promotionLabel: "2A Matmeca" },
  { shortCode: "A03", teamName: "Dix de Der", player1Name: "Antoine Mercier", player2Name: "Chloé Faure", promotionLabel: "1A Info" },
  { shortCode: "A04", teamName: "Capot Royal", player1Name: "Hugo Blanc", player2Name: "Léa Chevalier", promotionLabel: "3A Télécoms" },
  { shortCode: "B01", teamName: "Sans Atout Matmeca", player1Name: "Thomas Garnier", player2Name: "Inès Morel", promotionLabel: "2A Matmeca" },
  { shortCode: "B02", teamName: "Atout Cœur", player1Name: "Théo Bernard", player2Name: "Inès Petit", promotionLabel: "1A Élec" },
  { shortCode: "B03", teamName: "Belote & Rebelote", player1Name: "Alexandre Boyer", player2Name: "Juliette Masson", promotionLabel: "3A Info" },
  { shortCode: "B04", teamName: "Surcoinche Eirb", player1Name: "Romain Fournier", player2Name: "Clara Gautier", promotionLabel: "2A Télécoms" },
  { shortCode: "C01", teamName: "La Ruche Dorée", player1Name: "Quentin Brunet", player2Name: "Adèle Picard", promotionLabel: "3A Info" },
  { shortCode: "C02", teamName: "Cœur Vaillant", player1Name: "Pauline Colin", player2Name: "Julien Vidal", promotionLabel: "2A Élec" },
  { shortCode: "C03", teamName: "Trèfle Mécanique", player1Name: "Bastien Caron", player2Name: "Alice Renard", promotionLabel: "1A Matmeca" },
  { shortCode: "C04", teamName: "Les Parlantes", player1Name: "Florian Arnaud", player2Name: "Anaïs Marty", promotionLabel: "2A RSI" },
  { shortCode: "D01", teamName: "Générale Impériale", player1Name: "Nicolas Robin", player2Name: "Manon Guérin", promotionLabel: "3A Matmeca" },
  { shortCode: "D02", teamName: "160 Chuté", player1Name: "Valentin Aubert", player2Name: "Noémie Rolland", promotionLabel: "1A Info" },
  { shortCode: "D03", teamName: "Les Rois du Tapis", player1Name: "Guillaume Leclerc", player2Name: "Céline Barbier", promotionLabel: "2A Élec" },
  { shortCode: "D04", teamName: "Pique & Cœur", player1Name: "Adrien Schmitt", player2Name: "Marine Leroux", promotionLabel: "1A Télécoms" },
  { shortCode: "E01", teamName: "Les Quatre As", player1Name: "Mathieu Perrin", player2Name: "Eva Lemoine", promotionLabel: "3A Télécoms" },
  { shortCode: "E02", teamName: "Foyer Enseirb", player1Name: "Benoît Lemaire", player2Name: "Élise Noel", promotionLabel: "2A Info" },
  { shortCode: "E03", teamName: "Les As du 9", player1Name: "Rémi Fontaine", player2Name: "Margaux Moulin", promotionLabel: "2A RSI" },
  { shortCode: "E04", teamName: "Impasse Maître", player1Name: "Damien Marchand", player2Name: "Lucie Prévost", promotionLabel: "1A Élec" },
];

function buildSeedTeams(
  checkedInByDefault: boolean,
  requestedCount: number = 20,
): UnifiedTeamRecord[] {
  const safeCount = Math.max(4, Math.min(64, Math.trunc(requestedCount)));
  const extraPlayers: ReadonlyArray<[string, string]> = [
    ["Angèle", "Kamila"],
    ["Chahe", "Antonin"],
    ["Elie", "Naël"],
    ["Nico", "br7"],
    ["Lenny", "Dona"],
    ["Martin", "Ulysse"],
    ["Sacha", "Benoit"],
    ["Matís", "Timeo"],
    ["Philo", "Maxime"],
    ["Bely", "Thib"],
    ["Lelio", "Arnaud"],
    ["Puff", "Baptiste"],
  ];

  const list: UnifiedTeamRecord[] = [];
  for (let index = 0; index < safeCount; index += 1) {
    const seed = SEED_TEAMS_DATA[index];
    if (seed !== undefined) {
      const cleanName = sanitizePlainName(seed.teamName);
      list.push({
        id: `team-${String(index + 1).padStart(2, "0")}`,
        shortCode: seed.shortCode,
        teamName: cleanName,
        normalizedName: normalizeComparisonKey(cleanName),
        player1Name: sanitizePlainName(seed.player1Name),
        player2Name: sanitizePlainName(seed.player2Name),
        promotionLabel: seed.promotionLabel,
        checkedIn: checkedInByDefault,
        isForfeit: false,
        seedOrder: index + 1,
        player1LinkedAccount: null,
        player2LinkedAccount: null,
      });
    } else {
      const extraIdx = (index - SEED_TEAMS_DATA.length) % extraPlayers.length;
      const pair = extraPlayers[extraIdx] ?? ["Joueur A", "Joueur B"];
      const suffix = index + 1;
      let p1 = pair[0];
      let p2 = pair[1];
      if (index - SEED_TEAMS_DATA.length >= extraPlayers.length) {
        p1 = `${pair[0]} ${suffix}`;
        p2 = `${pair[1]} ${suffix}`;
      }
      const autoName = formatPlayersPrimaryName(p1, p2);
      list.push({
        id: `team-${String(suffix).padStart(2, "0")}`,
        shortCode: `EQ${String(suffix).padStart(2, "0")}`,
        teamName: autoName,
        normalizedName: normalizeComparisonKey(autoName),
        player1Name: p1,
        player2Name: p2,
        promotionLabel: "ENSEIRB-MATMECA",
        checkedIn: checkedInByDefault,
        isForfeit: false,
        seedOrder: suffix,
        player1LinkedAccount: null,
        player2LinkedAccount: null,
      });
    }
  }
  return list;
}

function buildDefaultTournamentMeta(status: TournamentStatus, locked: boolean): UnifiedTournamentMeta {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Tournoi Coinch'Eirb · Foyer ENSEIRB-MATMECA",
    eventDate: "2026-11-26",
    eventDateLabel: "Jeudi 26 novembre 2026 · 18h30",
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
    winnerPhotoUrl: "/assets/media/vainqueur-precedent.jpg",
    winnerPhotoCaption: "Derniers vainqueurs · Coinch'Eirb",
  };
}

const COMPLETED_DEMO_DEAL_PATTERNS: ReadonlyArray<ReadonlyArray<[number, number, AnnouncementType | null, AnnouncementOutcome | null, boolean]>> = [
  [
    [110, 0, null, null, false],
    [0, 160, null, null, false],
    [250, 0, "capot", "passed", false],
    [120, 0, null, null, false],
    [0, 130, null, null, false],
  ],
  [
    [0, 100, null, null, false],
    [260, 0, "coinche", "passed", false],
    [90, 0, null, null, false],
    [0, 160, null, null, true],
    [140, 0, null, null, false],
  ],
  [
    [130, 0, null, null, false],
    [110, 0, null, null, false],
    [0, 320, "coinche", "failed", false],
    [250, 0, "capot", "passed", false],
    [100, 0, null, null, false],
  ],
  [
    [0, 120, null, null, false],
    [0, 250, "capot", "passed", false],
    [140, 0, null, null, false],
    [0, 110, null, null, false],
    [100, 0, null, null, false],
  ],
  [
    [500, 0, "generale", "passed", false],
    [0, 110, null, null, false],
    [120, 0, null, null, false],
    [0, 90, null, null, false],
    [100, 0, null, null, false],
  ],
];

/**
 * Construit un etat complet interactif de 20 equipes (5 poules de 4, tables 1 a 10) :
 * - Tours 1 et 2 termines avec historique de donnes coherent
 * - Tour 3 en cours aux tables 1 a 10 (2 donnes jouees sur 5) pour pouvoir saisir
 *   immediatement des points sur `/ma-table` et voir les poules et l'arbre bouger en direct.
 */
export function createDefaultUnifiedTournamentState(
  teamCount: number = 20,
): UnifiedTournamentState {
  const tournament = buildDefaultTournamentMeta("pools", true);
  const teams = buildSeedTeams(true, teamCount);
  const plan = generatePoolsAndSchedule(teams, {
    dealsPerMatch: tournament.dealsPerPoolMatch,
    startsAtTimeLabel: tournament.startsAtLabel,
  });

  const matches: UnifiedMatchRecord[] = plan.matches.map((gen, idx) => {
    const matchId = `match-pool-${gen.poolNumber}-r${gen.roundNumber}-t${gen.tableNumber}`;
    const poolLabel = formatPoolLabel(gen.poolNumber);
    const pattern =
      COMPLETED_DEMO_DEAL_PATTERNS[idx % COMPLETED_DEMO_DEAL_PATTERNS.length] ??
      COMPLETED_DEMO_DEAL_PATTERNS[0];

    let dealsCount = 5;
    if (gen.roundNumber === 3) {
      dealsCount = 2;
    }

    const deals: UnifiedDealRecord[] = [];
    let scoreA = 0;
    let scoreB = 0;

    if (pattern !== undefined) {
      for (let d = 0; d < dealsCount; d += 1) {
        const tuple = pattern[d];
        if (tuple === undefined) {
          continue;
        }
        scoreA += tuple[0];
        scoreB += tuple[1];
        deals.push({
          id: `${matchId}-d${d + 1}`,
          dealNumber: d + 1,
          pointsTeamA: tuple[0],
          pointsTeamB: tuple[1],
          isTiebreaker: false,
          specialAnnouncement: tuple[2],
          announcementOutcome: tuple[3],
          parlantePenalty: tuple[4],
        });
      }
    }

    let status: MatchStatus = "in_progress";
    let winnerTeamId: string | null = null;
    if (gen.roundNumber < 3) {
      status = "completed";
      if (scoreA > scoreB) {
        winnerTeamId = gen.teamAId;
      } else {
        winnerTeamId = gen.teamBId;
      }
    }

    return {
      id: matchId,
      phase: "pool",
      poolNumber: gen.poolNumber,
      poolLabel,
      roundNumber: gen.roundNumber,
      bracketSlot: null,
      tableNumber: gen.tableNumber,
      teamAId: gen.teamAId,
      teamBId: gen.teamBId,
      seedA: null,
      seedB: null,
      scoreTeamA: scoreA,
      scoreTeamB: scoreB,
      targetScore: null,
      maxDeals: gen.maxDeals,
      dealsPlayed: deals.length,
      deals,
      isDirectFinalScore: false,
      status,
      winnerTeamId,
      forfeitTeamId: null,
      lockedByAdmin: false,
      nextMatchId: null,
      nextMatchSlot: null,
      highlightNote: null,
      updatedByRole: "team",
      updatedAtLabel: "19h15",
    };
  });

  const alerts: UnifiedRefereeAlert[] = [
    {
      id: "alert-init-1",
      matchId: "match-pool-2-r3-t3",
      tableNumber: 3,
      requestingTeamId: "team-05",
      requestingTeamName: "Sans Atout Matmeca",
      alertType: "referee_call",
      message: "Question sur le seuil de belote sur un contrat à 90 pts.",
      status: "open",
      createdAtLabel: "19h14",
      resolvedAtLabel: null,
    },
  ];

  const liveFeed: UnifiedLiveFeedItem[] = [
    {
      id: "feed-init-1",
      tableNumber: 1,
      teamName: "Les Valets d'Eirb",
      announcementType: "capot",
      phase: "passed",
      pointsAwarded: 250,
      createdAtLabel: "19h08",
    },
    {
      id: "feed-init-2",
      tableNumber: 5,
      teamName: "La Ruche Dorée",
      announcementType: "generale",
      phase: "passed",
      pointsAwarded: 500,
      createdAtLabel: "19h12",
    },
  ];

  return {
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
    tournament,
    teams,
    pools: plan.pools,
    matches,
    alerts,
    liveFeed,
  };
}

/**
 * Construit un tournoi vierge en phase de check-in (avant 18h30) pret pour une vraie soiree.
 */
export function createCleanCheckinTournamentState(): UnifiedTournamentState {
  const tournament = buildDefaultTournamentMeta("checkin", false);
  const teams = buildSeedTeams(false);
  return {
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
    tournament,
    teams,
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
