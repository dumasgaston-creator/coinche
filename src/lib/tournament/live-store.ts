import {
  normalizeComparisonKey,
  sanitizePlainName,
} from "@/lib/security/sanitize";
import { generateKnockoutBracket } from "@/lib/tournament/bracket";
import {
  LIVE_ANNOUNCEMENT_STORAGE_KEY,
  UNIFIED_BROADCAST_CHANNEL,
  UNIFIED_LOCAL_EVENT_NAME,
  UNIFIED_STORE_STORAGE_KEY,
  createCleanCheckinTournamentState,
  createDefaultUnifiedTournamentState,
  findUnifiedTeam,
  formatOptionalTeamNickname,
  formatPlayersPrimaryName,
  formatStoreTimeLabel,
  propagateKnockoutWinners,
  type DerivedKnockoutMatchView,
  type DerivedTournamentSummary,
  type UnifiedDealRecord,
  type UnifiedLiveFeedItem,
  type UnifiedMatchRecord,
  type UnifiedRefereeAlert,
  type UnifiedTeamRecord,
  type UnifiedTournamentState,
} from "@/lib/tournament/live-store-types";
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
  QualificationOutcome,
  QualifiedTeamSeed,
  RawImportedTeamRow,
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

let cachedState: UnifiedTournamentState | null = null;

function isValidStoredState(raw: unknown): raw is UnifiedTournamentState {
  if (typeof raw !== "object" || raw === null) {
    return false;
  }
  const obj = raw as Record<string, unknown>;
  return (
    obj.schemaVersion === 2 &&
    typeof obj.tournament === "object" &&
    obj.tournament !== null &&
    Array.isArray(obj.teams) &&
    Array.isArray(obj.pools) &&
    Array.isArray(obj.matches)
  );
}

/**
 * Lit l'etat courant du tournoi depuis la memoire ou `localStorage` (avec repli deterministe).
 */
export function readUnifiedTournamentState(): UnifiedTournamentState {
  if (typeof window === "undefined") {
    return createDefaultUnifiedTournamentState();
  }

  try {
    const raw = window.localStorage.getItem(UNIFIED_STORE_STORAGE_KEY);
    if (raw !== null && raw.length > 0) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidStoredState(parsed)) {
        cachedState = parsed;
        return parsed;
      }
    }
  } catch {
    // Stockage local indisponible ou corrompu
  }

  if (cachedState !== null) {
    return cachedState;
  }

  const fresh = createDefaultUnifiedTournamentState();
  cachedState = fresh;
  try {
    window.localStorage.setItem(
      UNIFIED_STORE_STORAGE_KEY,
      JSON.stringify(fresh),
    );
  } catch {
    // Ignore si quota depasse
  }
  return fresh;
}

/**
 * Enregistre et diffuse instantanement une nouvelle version de l'etat a tous les onglets
 * (`/ma-table`, `/classement`, `/equipe`, `/admin`, `/live`).
 */
export function writeUnifiedTournamentState(
  nextState: UnifiedTournamentState,
): UnifiedTournamentState {
  const stamped: UnifiedTournamentState = {
    ...nextState,
    updatedAt: new Date().toISOString(),
  };
  cachedState = stamped;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        UNIFIED_STORE_STORAGE_KEY,
        JSON.stringify(stamped),
      );
    } catch {
      // Ignore si quota depasse
    }

    try {
      window.dispatchEvent(new CustomEvent(UNIFIED_LOCAL_EVENT_NAME));
    } catch {
      // Ignore
    }

    if ("BroadcastChannel" in window) {
      try {
        const channel = new BroadcastChannel(UNIFIED_BROADCAST_CHANNEL);
        channel.postMessage({
          kind: "tournament_state_sync",
          updatedAt: stamped.updatedAt,
        });
        channel.close();
      } catch {
        // Ignore
      }
    }
  }

  return stamped;
}

export function updateUnifiedTournamentState(
  updater: (current: UnifiedTournamentState) => UnifiedTournamentState,
): UnifiedTournamentState {
  const current = readUnifiedTournamentState();
  const next = updater(current);
  return writeUnifiedTournamentState(next);
}

/**
 * Calcule en temps reel tous les classements de poules, les meilleurs 4es,
 * l'arbre des phases finales (reel ou projete) et les statistiques de soiree.
 */
export function deriveTournamentViews(
  state: UnifiedTournamentState,
): DerivedTournamentSummary {
  const completedPoolInputs: CompletedPoolMatchInput[] = [];
  for (const m of state.matches) {
    if (
      m.phase === "pool" &&
      m.poolNumber !== null &&
      m.teamAId !== null &&
      m.teamBId !== null
    ) {
      // Inclut aussi les points des matchs en cours dans le goal-average temps reel
      completedPoolInputs.push({
        poolNumber: m.poolNumber,
        teamAId: m.teamAId,
        teamBId: m.teamBId,
        scoreTeamA: m.scoreTeamA,
        scoreTeamB: m.scoreTeamB,
        status: m.status,
        winnerTeamId: m.winnerTeamId,
        forfeitTeamId: m.forfeitTeamId,
      });
    }
  }

  let poolStandings = computePoolStandings(
    state.pools,
    state.teams,
    completedPoolInputs,
  );
  if (state.pools.length === 0) {
    poolStandings = [];
  }

  const activeTeamCount = state.teams.filter(
    (t) => t.checkedIn && !t.isForfeit,
  ).length;

  let qualification: QualificationOutcome | null = null;
  const qualifiedLookup: Record<string, QualifiedTeamSeed> = {};

  if (poolStandings.length > 0 && activeTeamCount >= 2) {
    qualification = resolvePoolQualifications(
      poolStandings,
      state.tournament.roundOf16Threshold,
    );
    for (const q of qualification.qualifiedTeams) {
      qualifiedLookup[q.teamId] = q;
    }
    for (const e of qualification.eliminatedTeams) {
      qualifiedLookup[e.teamId] = e;
    }
  }

  const realKoMatches = state.matches.filter((m) => m.phase !== "pool");
  const hasRealKnockoutBracket = realKoMatches.length > 0;
  const knockoutMatches: DerivedKnockoutMatchView[] = [];

  if (hasRealKnockoutBracket) {
    const sorted = [...realKoMatches].sort((a, b) => {
      if (a.roundNumber !== b.roundNumber) {
        return a.roundNumber - b.roundNumber;
      }
      return (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0);
    });

    for (const ko of sorted) {
      const teamA = findUnifiedTeam(state.teams, ko.teamAId);
      const teamB = findUnifiedTeam(state.teams, ko.teamBId);

      let teamAName = "À déterminer";
      let teamAPlayers = "À déterminer";
      let teamANickname: string | null = null;
      let teamABinome = "En attente du tour précédent";
      if (teamA !== null) {
        teamAName = teamA.teamName;
        teamAPlayers = formatPlayersPrimaryName(
          teamA.player1Name,
          teamA.player2Name,
        );
        teamANickname = formatOptionalTeamNickname(
          teamA.teamName,
          teamA.player1Name,
          teamA.player2Name,
        );
        teamABinome = teamAPlayers;
      } else if (ko.seedA !== null) {
        teamAName = `Qualifié #${ko.seedA}`;
        teamAPlayers = `Qualifié #${ko.seedA}`;
      }

      let teamBName = "À déterminer";
      let teamBPlayers = "À déterminer";
      let teamBNickname: string | null = null;
      let teamBBinome = "En attente du tour précédent";
      if (teamB !== null) {
        teamBName = teamB.teamName;
        teamBPlayers = formatPlayersPrimaryName(
          teamB.player1Name,
          teamB.player2Name,
        );
        teamBNickname = formatOptionalTeamNickname(
          teamB.teamName,
          teamB.player1Name,
          teamB.player2Name,
        );
        teamBBinome = teamBPlayers;
      } else if (ko.seedB !== null) {
        teamBName = `Qualifié #${ko.seedB}`;
        teamBPlayers = `Qualifié #${ko.seedB}`;
      }

      let koPhase: Exclude<MatchPhase, "pool"> = "round_of_16";
      if (
        ko.phase === "quarterfinals" ||
        ko.phase === "semifinals" ||
        ko.phase === "final"
      ) {
        koPhase = ko.phase;
      }

      knockoutMatches.push({
        id: ko.id,
        isProjected: false,
        phase: koPhase,
        roundNumber: ko.roundNumber,
        slot: ko.bracketSlot ?? 1,
        tableNumber: ko.tableNumber,
        targetScore: ko.targetScore ?? 500,
        seedA: ko.seedA,
        seedB: ko.seedB,
        teamAId: ko.teamAId,
        teamAName,
        teamAPlayers,
        teamANickname,
        teamABinome,
        teamBId: ko.teamBId,
        teamBName,
        teamBPlayers,
        teamBNickname,
        teamBBinome,
        scoreTeamA: ko.scoreTeamA,
        scoreTeamB: ko.scoreTeamB,
        status: ko.status,
        winnerTeamId: ko.winnerTeamId,
        nextMatchId: ko.nextMatchId,
        nextMatchSlot: ko.nextMatchSlot,
        highlightNote: ko.highlightNote,
      });
    }
  } else if (qualification !== null) {
    const projectedNodes = generateKnockoutBracket({
      format: qualification.format,
      qualifiedTeams: qualification.qualifiedTeams,
      targetScores: {
        round_of_16: state.tournament.targetScoreR16,
        quarterfinals: state.tournament.targetScoreQf,
        semifinals: state.tournament.targetScoreSf,
        final: state.tournament.targetScoreFinal,
      },
    });

    for (const node of projectedNodes) {
      const teamA = findUnifiedTeam(state.teams, node.teamAId);
      const teamB = findUnifiedTeam(state.teams, node.teamBId);

      let teamAName = "À déterminer";
      let teamAPlayers = "À déterminer";
      let teamANickname: string | null = null;
      let teamABinome = "Projection en direct des poules";
      if (teamA !== null) {
        teamAName = teamA.teamName;
        teamAPlayers = formatPlayersPrimaryName(
          teamA.player1Name,
          teamA.player2Name,
        );
        teamANickname = formatOptionalTeamNickname(
          teamA.teamName,
          teamA.player1Name,
          teamA.player2Name,
        );
        teamABinome = teamAPlayers;
      } else if (node.seedA !== null) {
        teamAName = `Qualifié #${node.seedA}`;
        teamAPlayers = `Qualifié #${node.seedA}`;
      }

      let teamBName = "À déterminer";
      let teamBPlayers = "À déterminer";
      let teamBNickname: string | null = null;
      let teamBBinome = "Projection en direct des poules";
      if (teamB !== null) {
        teamBName = teamB.teamName;
        teamBPlayers = formatPlayersPrimaryName(
          teamB.player1Name,
          teamB.player2Name,
        );
        teamBNickname = formatOptionalTeamNickname(
          teamB.teamName,
          teamB.player1Name,
          teamB.player2Name,
        );
        teamBBinome = teamBPlayers;
      } else if (node.seedB !== null) {
        teamBName = `Qualifié #${node.seedB}`;
        teamBPlayers = `Qualifié #${node.seedB}`;
      }

      knockoutMatches.push({
        id: `proj-${node.tempId}`,
        isProjected: true,
        phase: node.phase,
        roundNumber: node.roundNumber,
        slot: node.bracketSlot,
        tableNumber: node.tableNumber,
        targetScore: node.targetScore,
        seedA: node.seedA,
        seedB: node.seedB,
        teamAId: node.teamAId,
        teamAName,
        teamAPlayers,
        teamANickname,
        teamABinome,
        teamBId: node.teamBId,
        teamBName,
        teamBPlayers,
        teamBNickname,
        teamBBinome,
        scoreTeamA: 0,
        scoreTeamB: 0,
        status: node.status,
        winnerTeamId: node.winnerTeamId,
        nextMatchId: node.nextMatchTempId,
        nextMatchSlot: node.nextMatchSlot,
        highlightNote: "Projection temps réel selon le classement actuel des poules",
      });
    }
  }

  let mostOffensivePoolLabel = "Poule A";
  let mostOffensivePoolPoints = 0;
  let highestPoolTeamName = "–";
  let highestPoolTeamBinome = "–";
  let highestPoolTeamPoints = 0;

  for (const pool of poolStandings) {
    if (pool.poolTotalPoints > mostOffensivePoolPoints) {
      mostOffensivePoolPoints = pool.poolTotalPoints;
      mostOffensivePoolLabel = pool.poolLabel;
    }
    for (const row of pool.standings) {
      if (row.pointsScored > highestPoolTeamPoints) {
        highestPoolTeamPoints = row.pointsScored;
        highestPoolTeamName = row.teamName;
        const foundTeam = findUnifiedTeam(state.teams, row.teamId);
        if (foundTeam !== null) {
          highestPoolTeamBinome = `${foundTeam.player1Name} · ${foundTeam.player2Name}`;
        }
      }
    }
  }

  let totalDealsPlayed = 0;
  let totalPointsAllMatches = 0;
  let capotsAnnounced = 0;
  let capotsPassed = 0;
  let generalesAnnounced = 0;
  let generalesPassed = 0;
  let coinchesAnnounced = 0;
  let coinchesPassed = 0;
  let surcoinchesAnnounced = 0;
  let surcoinchesPassed = 0;
  let parlantesPenalized = 0;

  for (const match of state.matches) {
    totalDealsPlayed += match.dealsPlayed;
    totalPointsAllMatches += match.scoreTeamA + match.scoreTeamB;
    for (const deal of match.deals) {
      if (deal.parlantePenalty) {
        parlantesPenalized += 1;
      }
      if (deal.specialAnnouncement === "capot") {
        capotsAnnounced += 1;
        if (deal.announcementOutcome === "passed") {
          capotsPassed += 1;
        }
      } else if (deal.specialAnnouncement === "generale") {
        generalesAnnounced += 1;
        if (deal.announcementOutcome === "passed") {
          generalesPassed += 1;
        }
      } else if (deal.specialAnnouncement === "coinche") {
        coinchesAnnounced += 1;
        if (deal.announcementOutcome === "passed") {
          coinchesPassed += 1;
        }
      } else if (deal.specialAnnouncement === "surcoinche") {
        surcoinchesAnnounced += 1;
        if (deal.announcementOutcome === "passed") {
          surcoinchesPassed += 1;
        }
      }
    }
  }

  return {
    poolStandings,
    qualification,
    qualifiedLookup,
    knockoutMatches,
    hasRealKnockoutBracket,
    mostOffensivePoolLabel,
    mostOffensivePoolPoints,
    highestPoolTeamName,
    highestPoolTeamBinome,
    highestPoolTeamPoints,
    totalDealsPlayed,
    totalPointsAllMatches,
    capotsAnnounced,
    capotsPassed,
    generalesAnnounced,
    generalesPassed,
    coinchesAnnounced,
    coinchesPassed,
    surcoinchesAnnounced,
    surcoinchesPassed,
    parlantesPenalized,
  };
}

function recomputeMatchFromDeals(
  match: UnifiedMatchRecord,
  deals: UnifiedDealRecord[],
  dealsPerPoolMatch: number,
  actorRole: "team" | "admin",
): UnifiedMatchRecord {
  let sumA = 0;
  let sumB = 0;
  const renumbered = deals.map((d, idx) => {
    sumA += d.pointsTeamA;
    sumB += d.pointsTeamB;
    const num = idx + 1;
    return {
      ...d,
      dealNumber: num,
      isTiebreaker: match.phase === "pool" && num > dealsPerPoolMatch,
    };
  });

  const progress = evaluateMatchProgress({
    phase: match.phase,
    scoreTeamA: sumA,
    scoreTeamB: sumB,
    dealsPlayed: renumbered.length,
    dealsPerPoolMatch,
    targetScore: match.targetScore,
    isDirectFinalScore: false,
  });

  let winnerTeamId: string | null = null;
  if (progress.winnerSide === "team_a") {
    winnerTeamId = match.teamAId;
  } else if (progress.winnerSide === "team_b") {
    winnerTeamId = match.teamBId;
  }

  let nextStatus: MatchStatus = progress.status;
  if (renumbered.length === 0 && match.status === "pending") {
    nextStatus = "pending";
  }

  return {
    ...match,
    deals: renumbered,
    dealsPlayed: renumbered.length,
    scoreTeamA: sumA,
    scoreTeamB: sumB,
    isDirectFinalScore: false,
    status: nextStatus,
    winnerTeamId,
    updatedByRole: actorRole,
    updatedAtLabel: formatStoreTimeLabel(),
  };
}

function isMatchFinished(status: MatchStatus): boolean {
  return status === "completed" || status === "forfeit" || status === "bye";
}

/**
 * Active automatiquement le prochain tour de poule des qu'un binome a termine son tour courant
 * (rythme libre par table) et cree AUTOMATIQUEMENT tout l'arbre des phases finales
 * des que tous les matchs decisifs de poule sont termines.
 */
function autoAdvanceTournamentStage(
  state: UnifiedTournamentState,
): UnifiedTournamentState {
  // 1. Propage d'abord les vainqueurs deja connus dans l'arbre final
  const matches = propagateKnockoutWinners(state.matches);

  // 2. Dans chaque poule, active les matchs du tour suivant dont les 2 equipes sont disponibles
  const busyTeams = new Set<string>();
  for (const m of matches) {
    if (m.phase === "pool" && m.status === "in_progress") {
      if (m.teamAId !== null) {
        busyTeams.add(m.teamAId);
      }
      if (m.teamBId !== null) {
        busyTeams.add(m.teamBId);
      }
    }
  }

  const pendingPoolSorted = matches
    .filter(
      (m) =>
        m.phase === "pool" &&
        m.status === "pending" &&
        m.teamAId !== null &&
        m.teamBId !== null,
    )
    .sort((a, b) => a.roundNumber - b.roundNumber);

  const idsToActivate = new Set<string>();
  for (const pending of pendingPoolSorted) {
    const aId = pending.teamAId;
    const bId = pending.teamBId;
    if (aId === null || bId === null) {
      continue;
    }
    if (!busyTeams.has(aId) && !busyTeams.has(bId)) {
      idsToActivate.add(pending.id);
      busyTeams.add(aId);
      busyTeams.add(bId);
    }
  }

  let progressedMatches = matches;
  if (idsToActivate.size > 0) {
    progressedMatches = matches.map((m) => {
      if (idsToActivate.has(m.id)) {
        return { ...m, status: "in_progress" as const };
      }
      return m;
    });
  }

  // 3. Verifie si tous les matchs de poules sont termines pour generer automatiquement les phases finales
  const poolMatches = progressedMatches.filter((m) => m.phase === "pool");
  const realKoMatches = progressedMatches.filter((m) => m.phase !== "pool");

  let nextTournamentStatus: TournamentStatus = state.tournament.status;
  let finalMatches = progressedMatches;

  if (
    poolMatches.length > 0 &&
    realKoMatches.length === 0 &&
    poolMatches.every((m) => isMatchFinished(m.status))
  ) {
    const interimState: UnifiedTournamentState = {
      ...state,
      matches: progressedMatches,
    };
    const summary = deriveTournamentViews(interimState);
    if (summary.qualification !== null) {
      const qualification = summary.qualification;
      const nodes: GeneratedBracketNode[] = generateKnockoutBracket({
        format: qualification.format,
        qualifiedTeams: qualification.qualifiedTeams,
        targetScores: {
          round_of_16: state.tournament.targetScoreR16,
          quarterfinals: state.tournament.targetScoreQf,
          semifinals: state.tournament.targetScoreSf,
          final: state.tournament.targetScoreFinal,
        },
      });

      const generatedKo: UnifiedMatchRecord[] = nodes.map((node) => {
        let status: MatchStatus = node.status;
        if (
          node.phase === qualification.format.startingPhase &&
          node.status === "pending" &&
          node.teamAId !== null &&
          node.teamBId !== null
        ) {
          status = "in_progress";
        }

        let nextMatchId: string | null = null;
        if (node.nextMatchTempId !== null) {
          nextMatchId = `match-ko-${node.nextMatchTempId}`;
        }

        return {
          id: `match-ko-${node.tempId}`,
          phase: node.phase,
          poolNumber: null,
          poolLabel: null,
          roundNumber: node.roundNumber,
          bracketSlot: node.bracketSlot,
          tableNumber: node.tableNumber,
          teamAId: node.teamAId,
          teamBId: node.teamBId,
          seedA: node.seedA,
          seedB: node.seedB,
          scoreTeamA: 0,
          scoreTeamB: 0,
          targetScore: node.targetScore,
          maxDeals: null,
          dealsPlayed: 0,
          deals: [],
          isDirectFinalScore: false,
          status,
          winnerTeamId: node.winnerTeamId,
          forfeitTeamId: null,
          lockedByAdmin: false,
          nextMatchId,
          nextMatchSlot: node.nextMatchSlot,
          highlightNote: "Phase finale générée automatiquement après clôture des poules",
          updatedByRole: "admin",
          updatedAtLabel: formatStoreTimeLabel(),
        };
      });

      const propagatedKo = propagateKnockoutWinners(generatedKo);
      finalMatches = [...propagatedKo, ...progressedMatches];
      nextTournamentStatus = qualification.format.startingPhase;
    }
  } else if (realKoMatches.length > 0) {
    // Met a jour la phase courante en fonction de l'avancement des phases finales
    const finalMatch = finalMatches.find((m) => m.phase === "final");
    const semiMatches = finalMatches.filter((m) => m.phase === "semifinals");
    const qfMatches = finalMatches.filter((m) => m.phase === "quarterfinals");

    if (finalMatch !== undefined && isMatchFinished(finalMatch.status)) {
      nextTournamentStatus = "completed";
    } else if (
      finalMatch !== undefined &&
      finalMatch.teamAId !== null &&
      finalMatch.teamBId !== null
    ) {
      nextTournamentStatus = "final";
    } else if (
      semiMatches.some(
        (m) => m.teamAId !== null && m.teamBId !== null && !isMatchFinished(m.status),
      )
    ) {
      nextTournamentStatus = "semifinals";
    } else if (
      qfMatches.some(
        (m) => m.teamAId !== null && m.teamBId !== null && !isMatchFinished(m.status),
      )
    ) {
      nextTournamentStatus = "quarterfinals";
    }
  }

  return {
    ...state,
    tournament: {
      ...state.tournament,
      status: nextTournamentStatus,
    },
    matches: finalMatches,
  };
}

/**
 * Ajoute une nouvelle donne sur un match depuis `/ma-table` et met a jour
 * immediatement les poules, meilleurs 4es et l'arbre final (avec creation automatique
 * des phases finales des que le dernier match de poule se termine).
 */
export function recordDealInStore(params: {
  matchId: string;
  pointsTeamA: number;
  pointsTeamB: number;
  specialAnnouncement: AnnouncementType | null;
  announcementOutcome: AnnouncementOutcome | null;
  parlantePenalty: boolean;
}): UnifiedTournamentState {
  return updateUnifiedTournamentState((state) => {
    const updatedMatches = state.matches.map((match) => {
      if (match.id !== params.matchId) {
        return match;
      }
      const nextDealNum = match.deals.length + 1;
      const newDeal: UnifiedDealRecord = {
        id: `${match.id}-d${nextDealNum}-${Date.now()}`,
        dealNumber: nextDealNum,
        pointsTeamA: params.pointsTeamA,
        pointsTeamB: params.pointsTeamB,
        isTiebreaker:
          match.phase === "pool" &&
          nextDealNum > state.tournament.dealsPerPoolMatch,
        specialAnnouncement: params.specialAnnouncement,
        announcementOutcome: params.announcementOutcome,
        parlantePenalty: params.parlantePenalty,
      };

      return recomputeMatchFromDeals(
        match,
        [...match.deals, newDeal],
        state.tournament.dealsPerPoolMatch,
        "team",
      );
    });

    return autoAdvanceTournamentStage({
      ...state,
      matches: updatedMatches,
    });
  });
}

export function editDealInStore(params: {
  matchId: string;
  dealId: string;
  pointsTeamA: number;
  pointsTeamB: number;
  parlantePenalty: boolean;
}): UnifiedTournamentState {
  return updateUnifiedTournamentState((state) => {
    const updatedMatches = state.matches.map((match) => {
      if (match.id !== params.matchId) {
        return match;
      }
      const nextDeals = match.deals.map((d) => {
        if (d.id !== params.dealId) {
          return d;
        }
        return {
          ...d,
          pointsTeamA: params.pointsTeamA,
          pointsTeamB: params.pointsTeamB,
          parlantePenalty: params.parlantePenalty,
        };
      });
      return recomputeMatchFromDeals(
        match,
        nextDeals,
        state.tournament.dealsPerPoolMatch,
        "team",
      );
    });

    return autoAdvanceTournamentStage({
      ...state,
      matches: updatedMatches,
    });
  });
}

export function recordDirectFinalScoreInStore(params: {
  matchId: string;
  scoreTeamA: number;
  scoreTeamB: number;
}): UnifiedTournamentState {
  return updateUnifiedTournamentState((state) => {
    const updatedMatches = state.matches.map((match) => {
      if (match.id !== params.matchId) {
        return match;
      }
      let winnerId: string | null = null;
      if (params.scoreTeamA > params.scoreTeamB) {
        winnerId = match.teamAId;
      } else if (params.scoreTeamB > params.scoreTeamA) {
        winnerId = match.teamBId;
      }

      return {
        ...match,
        scoreTeamA: params.scoreTeamA,
        scoreTeamB: params.scoreTeamB,
        isDirectFinalScore: true,
        status: "completed" as const,
        winnerTeamId: winnerId,
        updatedByRole: "team" as const,
        updatedAtLabel: formatStoreTimeLabel(),
      };
    });

    return autoAdvanceTournamentStage({
      ...state,
      matches: updatedMatches,
    });
  });
}

/**
 * Diffuse en temps reel une annonce manuelle (`Capot`, `Generale`, `Coinche`, `Surcoinche`)
 * ou son verdict (`passed` / `failed`) vers le videoprojecteur `/live` et le journal `/admin`.
 */
export function broadcastLiveAnnouncementFromStore(params: {
  announcementId: string;
  matchId: string;
  tableNumber: number;
  teamId: string | null;
  teamName: string;
  opponentName: string | null;
  announcementType: AnnouncementType;
  phase: LivePopupPhase;
  pointsAwarded: number | null;
  contractNote: string | null;
}): void {
  const payload = {
    id: params.announcementId,
    match_id: params.matchId,
    table_number: params.tableNumber,
    team_id: params.teamId,
    team_name_snapshot: params.teamName,
    opponentName: params.opponentName,
    announcement_type: params.announcementType,
    phase: params.phase,
    points_awarded: params.pointsAwarded,
    contractNote: params.contractNote,
    created_at: new Date().toISOString(),
  };

  updateUnifiedTournamentState((state) => {
    const entry: UnifiedLiveFeedItem = {
      id: `${params.announcementId}-${params.phase}-${Date.now()}`,
      tableNumber: params.tableNumber,
      teamName: params.teamName,
      announcementType: params.announcementType,
      phase: params.phase,
      pointsAwarded: params.pointsAwarded,
      createdAtLabel: formatStoreTimeLabel(),
    };

    const updatedMatches = state.matches.map((m) => {
      if (m.id !== params.matchId) {
        return m;
      }
      let notePrefix = "Annonce";
      if (params.phase === "passed") {
        notePrefix = "Passé";
      } else if (params.phase === "failed") {
        notePrefix = "Chuté";
      }
      return {
        ...m,
        highlightNote: `${params.announcementType.toUpperCase()} · ${notePrefix} (${params.teamName})`,
      };
    });

    return {
      ...state,
      matches: updatedMatches,
      liveFeed: [entry, ...state.liveFeed.slice(0, 29)],
    };
  });

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        LIVE_ANNOUNCEMENT_STORAGE_KEY,
        JSON.stringify(payload),
      );
    } catch {
      // Ignore
    }

    if ("BroadcastChannel" in window) {
      try {
        const channel = new BroadcastChannel(UNIFIED_BROADCAST_CHANNEL);
        channel.postMessage(payload);
        channel.close();
      } catch {
        // Ignore
      }
    }
  }
}

/**
 * Envoie une alerte Arbitre ou une demande d'Abandon en direct vers `/admin`.
 */
export function submitTableAlertToStore(params: {
  matchId: string;
  tableNumber: number;
  teamId: string;
  teamName: string;
  alertType: RefereeAlertType;
  message: string;
  applyImmediateForfeit: boolean;
}): UnifiedTournamentState {
  return updateUnifiedTournamentState((state) => {
    const alert: UnifiedRefereeAlert = {
      id: `alert-${Date.now()}`,
      matchId: params.matchId,
      tableNumber: params.tableNumber,
      requestingTeamId: params.teamId,
      requestingTeamName: params.teamName,
      alertType: params.alertType,
      message: params.message,
      status: "open",
      createdAtLabel: formatStoreTimeLabel(),
      resolvedAtLabel: null,
    };

    let nextMatches = state.matches;
    let nextTeams = state.teams;

    if (params.applyImmediateForfeit) {
      nextTeams = state.teams.map((t) => {
        if (t.id === params.teamId) {
          return { ...t, isForfeit: true };
        }
        return t;
      });

      nextMatches = state.matches.map((m) => {
        if (m.id !== params.matchId) {
          return m;
        }
        let winnerId = m.teamAId;
        let scoreA = 500;
        let scoreB = 0;
        if (m.teamAId === params.teamId) {
          winnerId = m.teamBId;
          scoreA = 0;
          scoreB = 500;
        }
        return {
          ...m,
          status: "forfeit" as const,
          forfeitTeamId: params.teamId,
          winnerTeamId: winnerId,
          scoreTeamA: scoreA,
          scoreTeamB: scoreB,
          updatedByRole: "team" as const,
          updatedAtLabel: formatStoreTimeLabel(),
        };
      });
      nextMatches = propagateKnockoutWinners(nextMatches);
    }

    return autoAdvanceTournamentStage({
      ...state,
      teams: nextTeams,
      matches: nextMatches,
      alerts: [alert, ...state.alerts],
    });
  });
}

/* ==========================================================================
   Commandes Administrateur completes (modification totale par l'Admin)
   ========================================================================== */

export function adminForceUpdateMatchInStore(params: {
  matchId: string;
  scoreTeamA: number;
  scoreTeamB: number;
  status: MatchStatus;
  lockedByAdmin: boolean;
  forfeitTeamId: string | null;
}): UnifiedTournamentState {
  return updateUnifiedTournamentState((state) => {
    const updatedMatches = state.matches.map((match) => {
      if (match.id !== params.matchId) {
        return match;
      }

      let winnerId: string | null = null;
      if (params.status === "forfeit" && params.forfeitTeamId !== null) {
        if (params.forfeitTeamId === match.teamAId) {
          winnerId = match.teamBId;
        } else {
          winnerId = match.teamAId;
        }
      } else if (params.status === "completed") {
        if (params.scoreTeamA > params.scoreTeamB) {
          winnerId = match.teamAId;
        } else if (params.scoreTeamB > params.scoreTeamA) {
          winnerId = match.teamBId;
        }
      }

      return {
        ...match,
        scoreTeamA: params.scoreTeamA,
        scoreTeamB: params.scoreTeamB,
        status: params.status,
        lockedByAdmin: params.lockedByAdmin,
        forfeitTeamId: params.forfeitTeamId,
        winnerTeamId: winnerId,
        isDirectFinalScore: true,
        updatedByRole: "admin" as const,
        updatedAtLabel: formatStoreTimeLabel(),
      };
    });

    const updatedTeams = state.teams.map((team) => {
      if (params.status === "forfeit" && team.id === params.forfeitTeamId) {
        return { ...team, isForfeit: true };
      }
      return team;
    });

    return autoAdvanceTournamentStage({
      ...state,
      matches: updatedMatches,
      teams: updatedTeams,
    });
  });
}

export function adminGeneratePoolsInStore(): UnifiedTournamentState {
  return updateUnifiedTournamentState((state) => {
    const plan = generatePoolsAndSchedule(state.teams, {
      dealsPerMatch: state.tournament.dealsPerPoolMatch,
      startsAtTimeLabel: state.tournament.startsAtLabel,
    });

    const poolCodeMap = new Map<string, string>();
    for (const pool of plan.pools) {
      const letter = pool.poolLabel.replace("Poule ", "").trim();
      for (const member of pool.teams) {
        poolCodeMap.set(
          member.teamId,
          `${letter}${String(member.positionInPool).padStart(2, "0")}`,
        );
      }
    }

    const updatedTeams = state.teams.map((t) => {
      const assignedCode = poolCodeMap.get(t.id);
      if (assignedCode !== undefined) {
        return { ...t, shortCode: assignedCode };
      }
      return t;
    });

    const generatedMatches: UnifiedMatchRecord[] = plan.matches.map((m) => {
      let initialStatus: MatchStatus = "pending";
      if (m.roundNumber === 1) {
        initialStatus = "in_progress";
      }
      return {
        id: `match-pool-${m.poolNumber}-r${m.roundNumber}-t${m.tableNumber}`,
        phase: "pool",
        poolNumber: m.poolNumber,
        poolLabel: formatPoolLabel(m.poolNumber),
        roundNumber: m.roundNumber,
        bracketSlot: null,
        tableNumber: m.tableNumber,
        teamAId: m.teamAId,
        teamBId: m.teamBId,
        seedA: null,
        seedB: null,
        scoreTeamA: 0,
        scoreTeamB: 0,
        targetScore: null,
        maxDeals: m.maxDeals,
        dealsPlayed: 0,
        deals: [],
        isDirectFinalScore: false,
        status: initialStatus,
        winnerTeamId: null,
        forfeitTeamId: null,
        lockedByAdmin: false,
        nextMatchId: null,
        nextMatchSlot: null,
        highlightNote: null,
        updatedByRole: "admin",
        updatedAtLabel: formatStoreTimeLabel(),
      };
    });

    return {
      ...state,
      tournament: {
        ...state.tournament,
        status: "pools",
        registrationsLocked: true,
      },
      teams: updatedTeams,
      pools: plan.pools,
      matches: generatedMatches,
    };
  });
}

export function adminAdvanceToKnockoutInStore(): {
  nextState: UnifiedTournamentState;
  qualifiedCount: number;
  eliminatedCount: number;
  startingPhase: Exclude<MatchPhase, "pool">;
} {
  const current = readUnifiedTournamentState();
  const summary = deriveTournamentViews(current);

  if (summary.qualification === null) {
    throw new Error(
      "Générez d'abord les poules avec au moins 4 équipes pointées avant de lancer la phase finale.",
    );
  }

  const qualification = summary.qualification;
  const nodes: GeneratedBracketNode[] = generateKnockoutBracket({
    format: qualification.format,
    qualifiedTeams: qualification.qualifiedTeams,
    targetScores: {
      round_of_16: current.tournament.targetScoreR16,
      quarterfinals: current.tournament.targetScoreQf,
      semifinals: current.tournament.targetScoreSf,
      final: current.tournament.targetScoreFinal,
    },
  });

  const knockoutMatches: UnifiedMatchRecord[] = nodes.map((node) => {
    let status: MatchStatus = node.status;
    if (
      node.phase === qualification.format.startingPhase &&
      node.status === "pending" &&
      node.teamAId !== null &&
      node.teamBId !== null
    ) {
      status = "in_progress";
    }

    let nextMatchId: string | null = null;
    if (node.nextMatchTempId !== null) {
      nextMatchId = `match-ko-${node.nextMatchTempId}`;
    }

    return {
      id: `match-ko-${node.tempId}`,
      phase: node.phase,
      poolNumber: null,
      poolLabel: null,
      roundNumber: node.roundNumber,
      bracketSlot: node.bracketSlot,
      tableNumber: node.tableNumber,
      teamAId: node.teamAId,
      teamBId: node.teamBId,
      seedA: node.seedA,
      seedB: node.seedB,
      scoreTeamA: 0,
      scoreTeamB: 0,
      targetScore: node.targetScore,
      maxDeals: null,
      dealsPlayed: 0,
      deals: [],
      isDirectFinalScore: false,
      status,
      winnerTeamId: node.winnerTeamId,
      forfeitTeamId: null,
      lockedByAdmin: false,
      nextMatchId,
      nextMatchSlot: node.nextMatchSlot,
      highlightNote: null,
      updatedByRole: "admin",
      updatedAtLabel: formatStoreTimeLabel(),
    };
  });

  const propagatedKo = propagateKnockoutWinners(knockoutMatches);
  const preservedPoolMatches = current.matches
    .filter((m) => m.phase === "pool")
    .map((m) => {
      if (m.status === "in_progress") {
        let winnerId: string | null = m.winnerTeamId;
        if (winnerId === null) {
          if (m.scoreTeamA >= m.scoreTeamB) {
            winnerId = m.teamAId;
          } else {
            winnerId = m.teamBId;
          }
        }
        return {
          ...m,
          status: "completed" as const,
          winnerTeamId: winnerId,
        };
      }
      return m;
    });

  const nextState = writeUnifiedTournamentState({
    ...current,
    tournament: {
      ...current.tournament,
      status: qualification.format.startingPhase,
    },
    matches: [...propagatedKo, ...preservedPoolMatches],
  });

  return {
    nextState,
    qualifiedCount: qualification.qualifiedTeams.length,
    eliminatedCount: qualification.eliminatedTeams.length,
    startingPhase: qualification.format.startingPhase,
  };
}

export function adminUpdateTeamDetailsInStore(params: {
  teamId: string;
  teamName: string;
  player1Name: string;
  player2Name: string;
  checkedIn: boolean;
  isForfeit: boolean;
}): UnifiedTournamentState {
  const cleanP1 = sanitizePlainName(params.player1Name);
  const cleanP2 = sanitizePlainName(params.player2Name);
  let cleanTeam = sanitizePlainName(params.teamName);
  if (cleanTeam.length === 0) {
    cleanTeam = formatPlayersPrimaryName(cleanP1, cleanP2);
  }

  return updateUnifiedTournamentState((state) => {
    const updatedTeams = state.teams.map((t) => {
      if (t.id !== params.teamId) {
        return t;
      }
      return {
        ...t,
        teamName: cleanTeam,
        normalizedName: normalizeComparisonKey(cleanTeam),
        player1Name: cleanP1,
        player2Name: cleanP2,
        checkedIn: params.checkedIn,
        isForfeit: params.isForfeit,
      };
    });

    const updatedPools = state.pools.map((pool) => ({
      ...pool,
      teams: pool.teams.map((pt) => {
        if (pt.teamId === params.teamId) {
          return { ...pt, teamName: cleanTeam };
        }
        return pt;
      }),
    }));

    return {
      ...state,
      teams: updatedTeams,
      pools: updatedPools,
    };
  });
}

export function adminImportTeamsIntoStore(
  rows: RawImportedTeamRow[],
  mode: "replace" | "append",
): UnifiedTournamentState {
  return updateUnifiedTournamentState((state) => {
    let baseList: UnifiedTeamRecord[] = [];
    if (mode === "append") {
      baseList = [...state.teams];
    }

    const existingPairKeys = new Set(
      baseList.map((t) =>
        normalizeComparisonKey(`${t.player1Name} ${t.player2Name}`),
      ),
    );
    let nextIndex = baseList.length + 1;

    for (const row of rows) {
      const pairKey = normalizeComparisonKey(
        `${row.player1Name} ${row.player2Name}`,
      );
      if (existingPairKeys.has(pairKey)) {
        continue;
      }
      existingPairKeys.add(pairKey);
      baseList.push({
        id: `team-${String(nextIndex).padStart(2, "0")}-${Date.now().toString().slice(-3)}`,
        shortCode: `EQ${String(nextIndex).padStart(2, "0")}`,
        teamName: row.teamName,
        normalizedName: row.normalizedTeamName,
        player1Name: row.player1Name,
        player2Name: row.player2Name,
        promotionLabel: "ENSEIRB-MATMECA",
        checkedIn: true,
        isForfeit: false,
        seedOrder: nextIndex,
        player1LinkedAccount: null,
        player2LinkedAccount: null,
      });
      nextIndex += 1;
    }

    return {
      ...state,
      tournament: {
        ...state.tournament,
        status: "checkin",
        registrationsLocked: false,
      },
      teams: baseList,
      pools: [],
      matches: [],
    };
  });
}

export function adminResetTournamentInStore(
  mode: "demo" | "clean_checkin",
): UnifiedTournamentState {
  if (mode === "clean_checkin") {
    return writeUnifiedTournamentState(createCleanCheckinTournamentState());
  }
  return writeUnifiedTournamentState(createDefaultUnifiedTournamentState());
}

export {
  autoAdvanceTournamentStage,
  createCleanCheckinTournamentState,
  createDefaultUnifiedTournamentState,
  determineKnockoutFormat,
  findUnifiedTeam,
  formatOptionalTeamNickname,
  formatPlayersPrimaryName,
  formatStoreTimeLabel,
  propagateKnockoutWinners,
};
export type {
  DerivedKnockoutMatchView,
  DerivedTournamentSummary,
  UnifiedDealRecord,
  UnifiedLiveFeedItem,
  UnifiedMatchRecord,
  UnifiedRefereeAlert,
  UnifiedTeamRecord,
  UnifiedTournamentState,
};
