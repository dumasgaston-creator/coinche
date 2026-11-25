import { sanitizePlainName } from "@/lib/security/sanitize";
import { generateKnockoutBracket } from "@/lib/tournament/bracket";
import {
  findUnifiedTeam,
  formatOptionalTeamNickname,
  formatPlayersPrimaryName,
  formatStoreTimeLabel,
  propagateKnockoutWinners,
  type UnifiedDealRecord,
  type UnifiedLiveFeedItem,
  type UnifiedMatchRecord,
  type UnifiedRefereeAlert,
  type UnifiedTournamentState,
} from "@/lib/tournament/live-store-types";
import {
  computePoolStandings,
  resolvePoolQualifications,
} from "@/lib/tournament/qualification";
import { evaluateMatchProgress } from "@/lib/tournament/scoring";
import type {
  CompletedPoolMatchInput,
  GeneratedBracketNode,
} from "@/lib/tournament/types";
import type {
  AnnouncementOutcome,
  AnnouncementType,
  LivePopupPhase,
  MatchPhase,
  MatchStatus,
  RefereeAlertType,
  TournamentStatus,
} from "@/types/database";

export class ReducerLockError extends Error {
  public readonly statusCode: 404 | 423;

  constructor(message: string, statusCode: 404 | 423) {
    super(message);
    this.name = "ReducerLockError";
    this.statusCode = statusCode;
  }
}

export interface ReducerOutcome {
  nextState: UnifiedTournamentState;
  popupEvent: Record<string, unknown> | null;
}

export function isValidUnifiedTournamentState(
  raw: unknown,
): raw is UnifiedTournamentState {
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

function isMatchFinished(status: MatchStatus): boolean {
  return status === "completed" || status === "forfeit" || status === "bye";
}

function recomputeMatchFromDealsPure(
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

function formatKnockoutStageLabel(phase: MatchPhase): string {
  if (phase === "round_of_16") {
    return "HUITIÈME (500 PTS)";
  }
  if (phase === "quarterfinals") {
    return "QUART DE FINALE (600 PTS)";
  }
  if (phase === "semifinals") {
    return "DEMI-FINALE (700 PTS)";
  }
  return "FINALE (1000 PTS)";
}

/**
 * Avancement automatique pur (serveur + client) :
 * - propage les vainqueurs dans l'arbre
 * - active le prochain tour de poule des que les 2 equipes sont libres
 * - cree automatiquement les phases finales des que le dernier match de poule se cloture.
 */
export function autoAdvanceTournamentStatePure(
  state: UnifiedTournamentState,
): UnifiedTournamentState {
  const matches = propagateKnockoutWinners(state.matches);

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

  const poolMatches = progressedMatches.filter((m) => m.phase === "pool");
  const realKoMatches = progressedMatches.filter((m) => m.phase !== "pool");

  let nextTournamentStatus: TournamentStatus = state.tournament.status;
  let finalMatches = progressedMatches;

  if (
    poolMatches.length > 0 &&
    realKoMatches.length === 0 &&
    poolMatches.every((m) => isMatchFinished(m.status))
  ) {
    const completedPoolInputs: CompletedPoolMatchInput[] = [];
    for (const m of progressedMatches) {
      if (
        m.phase === "pool" &&
        m.poolNumber !== null &&
        m.teamAId !== null &&
        m.teamBId !== null
      ) {
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

    const standings = computePoolStandings(
      state.pools,
      state.teams,
      completedPoolInputs,
    );
    const activeTeamCount = state.teams.filter(
      (t) => t.checkedIn && !t.isForfeit,
    ).length;

    if (standings.length > 0 && activeTeamCount >= 2) {
      const qualification = resolvePoolQualifications(
        standings,
        state.tournament.roundOf16Threshold,
      );
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
          highlightNote:
            "Phase finale générée automatiquement après clôture des poules",
          updatedByRole: "admin",
          updatedAtLabel: formatStoreTimeLabel(),
        };
      });

      const propagatedKo = propagateKnockoutWinners(generatedKo);
      finalMatches = [...propagatedKo, ...progressedMatches];
      nextTournamentStatus = qualification.format.startingPhase;
    }
  } else if (realKoMatches.length > 0) {
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
        (m) =>
          m.teamAId !== null && m.teamBId !== null && !isMatchFinished(m.status),
      )
    ) {
      nextTournamentStatus = "semifinals";
    } else if (
      qfMatches.some(
        (m) =>
          m.teamAId !== null && m.teamBId !== null && !isMatchFinished(m.status),
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
    updatedAt: new Date().toISOString(),
  };
}

function buildAutomaticPopupEvent(
  prevState: UnifiedTournamentState,
  nextState: UnifiedTournamentState,
  targetMatchId: string,
): Record<string, unknown> | null {
  let prevTotalDeals = 0;
  for (const m of prevState.matches) {
    prevTotalDeals += m.dealsPlayed;
  }
  let nextTotalDeals = 0;
  for (const m of nextState.matches) {
    nextTotalDeals += m.dealsPlayed;
  }

  const prevMatch = prevState.matches.find((m) => m.id === targetMatchId);
  const nextMatch = nextState.matches.find((m) => m.id === targetMatchId);
  if (nextMatch === undefined) {
    return null;
  }

  if (prevTotalDeals === 0 && nextTotalDeals > 0) {
    const tA = findUnifiedTeam(nextState.teams, nextMatch.teamAId);
    const tB = findUnifiedTeam(nextState.teams, nextMatch.teamBId);
    let labelA = "Table 1";
    if (tA !== null) {
      labelA = formatPlayersPrimaryName(tA.player1Name, tA.player2Name);
    }
    let labelB: string | null = null;
    if (tB !== null) {
      labelB = formatPlayersPrimaryName(tB.player1Name, tB.player2Name);
    }
    return {
      id: `special-first_deal-${Date.now()}`,
      specialKind: "first_deal",
      table_number: nextMatch.tableNumber ?? 1,
      team_name_snapshot: labelA,
      opponentName: labelB,
      announcement_type: "coinche",
      phase: "announced",
      points_awarded: null,
      customHeadline: "PREMIÈRE DONNE !",
      customBadge: "COUP D'ENVOI · COINCH'EIRB",
      contractNote: "La soirée est officiellement lancée",
      created_at: new Date().toISOString(),
    };
  }

  const wasFinished =
    prevMatch !== undefined && isMatchFinished(prevMatch.status);
  const isNowFinished = isMatchFinished(nextMatch.status);

  if (
    nextMatch.phase !== "pool" &&
    !wasFinished &&
    isNowFinished &&
    nextMatch.winnerTeamId !== null
  ) {
    const teamA = findUnifiedTeam(nextState.teams, nextMatch.teamAId);
    const teamB = findUnifiedTeam(nextState.teams, nextMatch.teamBId);
    let winnerName = "Vainqueurs";
    let loserName = "Adversaires";
    let winScore = nextMatch.scoreTeamA;
    let loseScore = nextMatch.scoreTeamB;

    if (nextMatch.winnerTeamId === nextMatch.teamAId) {
      if (teamA !== null) {
        winnerName = formatPlayersPrimaryName(
          teamA.player1Name,
          teamA.player2Name,
        );
      }
      if (teamB !== null) {
        loserName = formatPlayersPrimaryName(
          teamB.player1Name,
          teamB.player2Name,
        );
      }
    } else {
      winScore = nextMatch.scoreTeamB;
      loseScore = nextMatch.scoreTeamA;
      if (teamB !== null) {
        winnerName = formatPlayersPrimaryName(
          teamB.player1Name,
          teamB.player2Name,
        );
      }
      if (teamA !== null) {
        loserName = formatPlayersPrimaryName(
          teamA.player1Name,
          teamA.player2Name,
        );
      }
    }

    if (nextMatch.phase === "final") {
      return {
        id: `special-champion-${Date.now()}`,
        specialKind: "champion",
        table_number: nextMatch.tableNumber ?? 1,
        team_name_snapshot: winnerName,
        opponentName: loserName,
        announcement_type: "coinche",
        phase: "passed",
        points_awarded: winScore,
        customHeadline: "CHAMPIONS COINCH'EIRB !",
        customBadge: `FINALE · ${winScore} – ${loseScore}`,
        contractNote: `Victoire finale face à ${loserName}`,
        created_at: new Date().toISOString(),
      };
    }

    const stageTag = formatKnockoutStageLabel(nextMatch.phase);
    return {
      id: `special-elimination-${Date.now()}`,
      specialKind: "elimination",
      table_number: nextMatch.tableNumber ?? 1,
      team_name_snapshot: loserName,
      opponentName: winnerName,
      announcement_type: "coinche",
      phase: "failed",
      points_awarded: winScore,
      customHeadline: "CAPRI-SEUM !",
      customBadge: `ÉLIMINÉS EN ${stageTag}`,
      contractNote: `Sortis ${loseScore} – ${winScore} par ${winnerName}`,
      created_at: new Date().toISOString(),
    };
  }

  return null;
}

function assertPlayerCanEditMatch(
  state: UnifiedTournamentState,
  matchId: string,
  bypassLock: boolean,
): UnifiedMatchRecord {
  const match = state.matches.find((m) => m.id === matchId);
  if (match === undefined) {
    throw new ReducerLockError("Match introuvable.", 404);
  }
  if (!bypassLock) {
    if (!state.tournament.playerScoreEditingEnabled) {
      throw new ReducerLockError(
        "La saisie joueurs est verrouillée par l'administrateur.",
        423,
      );
    }
    if (match.lockedByAdmin) {
      throw new ReducerLockError(
        "Cette table a été verrouillée par l'administrateur.",
        423,
      );
    }
  }
  return match;
}

export function applyRecordDealReducer(
  state: UnifiedTournamentState,
  params: {
    matchId: string;
    pointsTeamA: number;
    pointsTeamB: number;
    specialAnnouncement: AnnouncementType | null;
    announcementOutcome: AnnouncementOutcome | null;
    parlantePenalty: boolean;
    bypassLock?: boolean;
  },
): ReducerOutcome {
  const targetMatch = assertPlayerCanEditMatch(
    state,
    params.matchId,
    params.bypassLock === true,
  );
  if (targetMatch.deals.length >= 40) {
    throw new ReducerLockError(
      "Nombre maximum de donnes atteint sur ce match (40).",
      423,
    );
  }

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

    return recomputeMatchFromDealsPure(
      match,
      [...match.deals, newDeal],
      state.tournament.dealsPerPoolMatch,
      "team",
    );
  });

  const nextState = autoAdvanceTournamentStatePure({
    ...state,
    matches: updatedMatches,
  });

  return {
    nextState,
    popupEvent: buildAutomaticPopupEvent(state, nextState, params.matchId),
  };
}

export function applyEditDealReducer(
  state: UnifiedTournamentState,
  params: {
    matchId: string;
    dealId: string;
    pointsTeamA: number;
    pointsTeamB: number;
    parlantePenalty: boolean;
    bypassLock?: boolean;
  },
): ReducerOutcome {
  assertPlayerCanEditMatch(state, params.matchId, params.bypassLock === true);

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
    return recomputeMatchFromDealsPure(
      match,
      nextDeals,
      state.tournament.dealsPerPoolMatch,
      "team",
    );
  });

  const nextState = autoAdvanceTournamentStatePure({
    ...state,
    matches: updatedMatches,
  });

  return { nextState, popupEvent: null };
}

export function applyDirectFinalScoreReducer(
  state: UnifiedTournamentState,
  params: {
    matchId: string;
    scoreTeamA: number;
    scoreTeamB: number;
    bypassLock?: boolean;
  },
): ReducerOutcome {
  assertPlayerCanEditMatch(state, params.matchId, params.bypassLock === true);

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

  const nextState = autoAdvanceTournamentStatePure({
    ...state,
    matches: updatedMatches,
  });

  return {
    nextState,
    popupEvent: buildAutomaticPopupEvent(state, nextState, params.matchId),
  };
}

export function applyTableAlertReducer(
  state: UnifiedTournamentState,
  params: {
    matchId: string;
    tableNumber: number;
    teamId: string;
    teamName: string;
    alertType: RefereeAlertType;
    message: string;
    applyImmediateForfeit: boolean;
  },
): ReducerOutcome {
  const targetMatch = state.matches.find((m) => m.id === params.matchId);
  if (targetMatch === undefined) {
    throw new ReducerLockError("Match introuvable.", 404);
  }
  if (
    targetMatch.teamAId !== params.teamId &&
    targetMatch.teamBId !== params.teamId
  ) {
    throw new ReducerLockError(
      "Action refusée : cette équipe ne joue pas sur cette table (anti-IDOR).",
      423,
    );
  }

  const cleanTeamName = sanitizePlainName(params.teamName).slice(0, 80);
  const cleanMessage = sanitizePlainName(params.message).slice(0, 260);

  const alert: UnifiedRefereeAlert = {
    id: `alert-${Date.now()}`,
    matchId: params.matchId,
    tableNumber: params.tableNumber,
    requestingTeamId: params.teamId,
    requestingTeamName: cleanTeamName,
    alertType: params.alertType,
    message: cleanMessage,
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

  const nextState = autoAdvanceTournamentStatePure({
    ...state,
    teams: nextTeams,
    matches: nextMatches,
    alerts: [alert, ...state.alerts],
  });

  return { nextState, popupEvent: null };
}

export function applyLiveAnnouncementReducer(
  state: UnifiedTournamentState,
  params: {
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
  },
): ReducerOutcome {
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

  const popupEvent: Record<string, unknown> = {
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

  return {
    nextState: {
      ...state,
      matches: updatedMatches,
      liveFeed: [entry, ...state.liveFeed.slice(0, 29)],
      updatedAt: new Date().toISOString(),
    },
    popupEvent,
  };
}

export { formatOptionalTeamNickname };
