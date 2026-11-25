import { normalizeComparisonKey } from "@/lib/security/sanitize";
import {
  findUnifiedTeam,
  formatOptionalTeamNickname,
  formatPlayersPrimaryName,
  type UnifiedMatchRecord,
  type UnifiedTeamRecord,
} from "@/lib/tournament/live-store-types";

export const MY_TEAM_STORAGE_KEY = "coincheirb-my-team-id";

export interface TeamSearchCandidate {
  team: UnifiedTeamRecord;
  playersPrimary: string;
  nickname: string | null;
  matchedPlayerName: string | null;
  partnerName: string | null;
  score: number;
}

export interface TeamMatchTimeline {
  currentMatch: UnifiedMatchRecord | null;
  nextMatch: UnifiedMatchRecord | null;
  opponent: UnifiedTeamRecord | null;
  nextOpponent: UnifiedTeamRecord | null;
  allTeamMatches: UnifiedMatchRecord[];
  isEliminatedInKnockout: boolean;
  isTournamentWinner: boolean;
}

function getFirstToken(name: string): string {
  const norm = normalizeComparisonKey(name);
  const parts = norm.split(" ");
  return parts[0] ?? "";
}

/**
 * Recherche ultra-souple d'un binome par prenom de joueur (prioritaire),
 * surnom d'equipe ou code court (insensible a la casse et aux accents).
 */
export function searchTeamsByFirstName(
  teams: readonly UnifiedTeamRecord[],
  rawQuery: string,
): TeamSearchCandidate[] {
  const q = normalizeComparisonKey(rawQuery);
  if (q.length === 0) {
    return [];
  }

  const results: TeamSearchCandidate[] = [];

  for (const team of teams) {
    const p1Norm = normalizeComparisonKey(team.player1Name);
    const p2Norm = normalizeComparisonKey(team.player2Name);
    const p1First = getFirstToken(team.player1Name);
    const p2First = getFirstToken(team.player2Name);
    const teamNorm = team.normalizedName;
    const codeNorm = normalizeComparisonKey(team.shortCode);

    let score = 0;
    let matchedPlayerName: string | null = null;
    let partnerName: string | null = null;

    if (p1First === q || p1Norm === q) {
      score = 100;
      matchedPlayerName = team.player1Name;
      partnerName = team.player2Name;
    } else if (p2First === q || p2Norm === q) {
      score = 100;
      matchedPlayerName = team.player2Name;
      partnerName = team.player1Name;
    } else if (p1First.startsWith(q) || p1Norm.startsWith(q)) {
      score = 80;
      matchedPlayerName = team.player1Name;
      partnerName = team.player2Name;
    } else if (p2First.startsWith(q) || p2Norm.startsWith(q)) {
      score = 80;
      matchedPlayerName = team.player2Name;
      partnerName = team.player1Name;
    } else if (p1Norm.includes(q)) {
      score = 60;
      matchedPlayerName = team.player1Name;
      partnerName = team.player2Name;
    } else if (p2Norm.includes(q)) {
      score = 60;
      matchedPlayerName = team.player2Name;
      partnerName = team.player1Name;
    } else if (codeNorm === q) {
      score = 70;
    } else if (teamNorm === q) {
      score = 55;
    } else if (teamNorm.includes(q)) {
      score = 40;
    }

    if (score > 0) {
      results.push({
        team,
        playersPrimary: formatPlayersPrimaryName(
          team.player1Name,
          team.player2Name,
        ),
        nickname: formatOptionalTeamNickname(
          team.teamName,
          team.player1Name,
          team.player2Name,
        ),
        matchedPlayerName,
        partnerName,
        score,
      });
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.playersPrimary.localeCompare(b.playersPrimary, "fr");
  });

  return results;
}

function getPhaseOrderWeight(phase: UnifiedMatchRecord["phase"]): number {
  if (phase === "pool") {
    return 1;
  }
  if (phase === "round_of_16") {
    return 2;
  }
  if (phase === "quarterfinals") {
    return 3;
  }
  if (phase === "semifinals") {
    return 4;
  }
  return 5;
}

function getOpponentFromMatch(
  match: UnifiedMatchRecord | null,
  teamId: string,
  teams: readonly UnifiedTeamRecord[],
): UnifiedTeamRecord | null {
  if (match === null) {
    return null;
  }
  let oppId: string | null = match.teamBId;
  if (match.teamBId === teamId) {
    oppId = match.teamAId;
  }
  return findUnifiedTeam(teams, oppId);
}

/**
 * Determine automatiquement le match actif et le prochain match d'une equipe
 * en suivant strictement l'ordre du tournoi (Poules Tour 1 -> 2 -> 3 -> 8es -> Quarts -> Demies -> Finale).
 */
export function resolveTeamMatchTimeline(
  teamId: string,
  matches: readonly UnifiedMatchRecord[],
  teams: readonly UnifiedTeamRecord[],
): TeamMatchTimeline {
  const teamMatches = matches
    .filter(
      (m) =>
        m.status !== "bye" && (m.teamAId === teamId || m.teamBId === teamId),
    )
    .sort((a, b) => {
      const phaseDiff =
        getPhaseOrderWeight(a.phase) - getPhaseOrderWeight(b.phase);
      if (phaseDiff !== 0) {
        return phaseDiff;
      }
      return a.roundNumber - b.roundNumber;
    });

  const playableUpcoming = teamMatches.filter(
    (m) =>
      (m.status === "in_progress" || m.status === "pending") &&
      m.teamAId !== null &&
      m.teamBId !== null,
  );

  // Priorise d'abord les matchs en cours (ex. 8e/Quart/Demi ou Tour de poule en cours), puis le prochain a venir
  const inProgressList = playableUpcoming.filter(
    (m) => m.status === "in_progress",
  );
  const pendingList = playableUpcoming.filter((m) => m.status === "pending");

  let currentMatch: UnifiedMatchRecord | null = null;
  let nextMatch: UnifiedMatchRecord | null = null;

  if (inProgressList.length > 0) {
    currentMatch = inProgressList[0] ?? null;
    if (inProgressList.length > 1) {
      nextMatch = inProgressList[1] ?? null;
    } else if (pendingList.length > 0) {
      nextMatch = pendingList[0] ?? null;
    }
  } else if (pendingList.length > 0) {
    currentMatch = pendingList[0] ?? null;
    if (pendingList.length > 1) {
      nextMatch = pendingList[1] ?? null;
    }
  } else if (teamMatches.length > 0) {
    currentMatch = teamMatches[teamMatches.length - 1] ?? null;
  }

  let isEliminatedInKnockout = false;
  let isTournamentWinner = false;

  for (const m of teamMatches) {
    if (
      m.phase !== "pool" &&
      (m.status === "completed" || m.status === "forfeit") &&
      m.winnerTeamId !== null
    ) {
      if (m.phase === "final" && m.winnerTeamId === teamId) {
        isTournamentWinner = true;
      } else if (m.winnerTeamId !== teamId) {
        isEliminatedInKnockout = true;
      }
    }
  }

  return {
    currentMatch,
    nextMatch,
    opponent: getOpponentFromMatch(currentMatch, teamId, teams),
    nextOpponent: getOpponentFromMatch(nextMatch, teamId, teams),
    allTeamMatches: teamMatches,
    isEliminatedInKnockout,
    isTournamentWinner,
  };
}

export function saveMyTeamIdToStorage(teamId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(MY_TEAM_STORAGE_KEY, teamId);
  } catch {
    // Ignore
  }
}

export function readMyTeamIdFromStorage(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(MY_TEAM_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearMyTeamIdFromStorage(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(MY_TEAM_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
