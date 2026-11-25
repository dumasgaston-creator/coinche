import {
  normalizeComparisonKey,
  sanitizePlainName,
} from "@/lib/security/sanitize";
import {
  findUnifiedTeam,
  type UnifiedTournamentState,
} from "@/lib/tournament/live-store-types";

export const CASUAL_STORE_KEY = "coincheirb-casual-games-v1";
export const CASUAL_BROADCAST_CHANNEL = "coincheirb-casual-sync";
export const CASUAL_LOCAL_EVENT = "coincheirb-casual-updated";

export type CasualSpecialTag =
  | "capot"
  | "generale"
  | "coinche"
  | "surcoinche"
  | "parlante"
  | null;

export interface CasualDealRecord {
  id: string;
  dealNumber: number;
  pointsTeamA: number;
  pointsTeamB: number;
  specialTag: CasualSpecialTag;
}

export interface CasualGameRecord {
  id: string;
  createdAt: string;
  completedAt: string | null;
  locationLabel: string;
  targetScore: number | null;
  teamA: [string, string];
  teamB: [string, string];
  scoreA: number;
  scoreB: number;
  deals: CasualDealRecord[];
  status: "in_progress" | "completed";
  winnerSide: "team_a" | "team_b" | null;
}

export interface PlayerAnnualStandingLive {
  rank: number;
  playerKey: string;
  displayName: string;
  annualPoints: number;
  netBalance: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  casualGames: number;
  tournamentGames: number;
  pointsScored: number;
  pointsConceded: number;
  capotsCount: number;
  generalesCount: number;
  bestPartner: { name: string; wins: number; games: number } | null;
  nemesis: { name: string; losses: number; games: number } | null;
}

const SEED_CASUAL_GAMES: CasualGameRecord[] = [
  {
    id: "casual-seed-1",
    createdAt: "2026-11-22T17:15:00.000Z",
    completedAt: "2026-11-22T17:48:00.000Z",
    locationLabel: "Au BAR",
    targetScore: 1000,
    teamA: ["Angèle", "Kamila"],
    teamB: ["Gaston", "Jules"],
    scoreA: 1040,
    scoreB: 720,
    deals: [
      { id: "cs1-d1", dealNumber: 1, pointsTeamA: 250, pointsTeamB: 0, specialTag: "capot" },
      { id: "cs1-d2", dealNumber: 2, pointsTeamA: 0, pointsTeamB: 320, specialTag: "coinche" },
      { id: "cs1-d3", dealNumber: 3, pointsTeamA: 500, pointsTeamB: 0, specialTag: "generale" },
      { id: "cs1-d4", dealNumber: 4, pointsTeamA: 0, pointsTeamB: 400, specialTag: null },
      { id: "cs1-d5", dealNumber: 5, pointsTeamA: 290, pointsTeamB: 0, specialTag: null },
    ],
    status: "completed",
    winnerSide: "team_a",
  },
  {
    id: "casual-seed-2",
    createdAt: "2026-11-24T18:05:00.000Z",
    completedAt: "2026-11-24T18:32:00.000Z",
    locationLabel: "Au BAR",
    targetScore: 1000,
    teamA: ["Chahe", "Antonin"],
    teamB: ["Nico", "br7"],
    scoreA: 810,
    scoreB: 1020,
    deals: [
      { id: "cs2-d1", dealNumber: 1, pointsTeamA: 310, pointsTeamB: 0, specialTag: null },
      { id: "cs2-d2", dealNumber: 2, pointsTeamA: 0, pointsTeamB: 520, specialTag: "surcoinche" },
      { id: "cs2-d3", dealNumber: 3, pointsTeamA: 500, pointsTeamB: 0, specialTag: "generale" },
      { id: "cs2-d4", dealNumber: 4, pointsTeamA: 0, pointsTeamB: 500, specialTag: null },
    ],
    status: "completed",
    winnerSide: "team_b",
  },
];

export function createDefaultCasualGames(): CasualGameRecord[] {
  return SEED_CASUAL_GAMES.map((g) => ({
    ...g,
    teamA: [g.teamA[0], g.teamA[1]],
    teamB: [g.teamB[0], g.teamB[1]],
    deals: g.deals.map((d) => ({ ...d })),
  }));
}

export function readCasualGames(): CasualGameRecord[] {
  if (typeof window === "undefined") {
    return createDefaultCasualGames();
  }
  try {
    const raw = window.localStorage.getItem(CASUAL_STORE_KEY);
    if (raw !== null && raw.length > 0) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as CasualGameRecord[];
      }
    }
  } catch {
    // Ignore
  }
  const defaults = createDefaultCasualGames();
  writeCasualGames(defaults);
  return defaults;
}

export function writeCasualGames(games: CasualGameRecord[]): CasualGameRecord[] {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CASUAL_STORE_KEY, JSON.stringify(games));
    } catch {
      // Ignore
    }
    try {
      window.dispatchEvent(new CustomEvent(CASUAL_LOCAL_EVENT));
    } catch {
      // Ignore
    }
    if ("BroadcastChannel" in window) {
      try {
        const ch = new BroadcastChannel(CASUAL_BROADCAST_CHANNEL);
        ch.postMessage({ kind: "casual_sync", count: games.length });
        ch.close();
      } catch {
        // Ignore
      }
    }
  }
  return games;
}

export function startCasualGame(params: {
  playerA1: string;
  playerA2: string;
  playerB1: string;
  playerB2: string;
  targetScore: number | null;
  locationLabel?: string;
}): CasualGameRecord {
  const pA1 = sanitizePlainName(params.playerA1);
  const pA2 = sanitizePlainName(params.playerA2);
  const pB1 = sanitizePlainName(params.playerB1);
  const pB2 = sanitizePlainName(params.playerB2);

  if (pA1.length < 1 || pA2.length < 1 || pB1.length < 1 || pB2.length < 1) {
    throw new Error("Renseignez les 4 joueurs (prénom ou pseudo).");
  }

  const keys = [
    normalizeComparisonKey(pA1),
    normalizeComparisonKey(pA2),
    normalizeComparisonKey(pB1),
    normalizeComparisonKey(pB2),
  ];
  const uniqueKeys = new Set(keys);
  if (uniqueKeys.size < 4) {
    throw new Error("Les 4 joueurs autour de la table doivent être distincts.");
  }

  const game: CasualGameRecord = {
    id: `casual-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
    completedAt: null,
    locationLabel: params.locationLabel ?? "Au BAR",
    targetScore: params.targetScore,
    teamA: [pA1, pA2],
    teamB: [pB1, pB2],
    scoreA: 0,
    scoreB: 0,
    deals: [],
    status: "in_progress",
    winnerSide: null,
  };

  const current = readCasualGames();
  writeCasualGames([game, ...current]);
  return game;
}

export function applyDealToCasualGame(
  game: CasualGameRecord,
  pointsTeamA: number,
  pointsTeamB: number,
  specialTag: CasualSpecialTag,
): CasualGameRecord {
  const nextDealNum = game.deals.length + 1;
  const deal: CasualDealRecord = {
    id: `${game.id}-d${nextDealNum}-${Date.now()}`,
    dealNumber: nextDealNum,
    pointsTeamA,
    pointsTeamB,
    specialTag,
  };
  const nextDeals = [...game.deals, deal];
  let sumA = 0;
  let sumB = 0;
  for (const d of nextDeals) {
    sumA += d.pointsTeamA;
    sumB += d.pointsTeamB;
  }

  let status: "in_progress" | "completed" = "in_progress";
  let winnerSide: "team_a" | "team_b" | null = null;
  let completedAt: string | null = game.completedAt;

  if (
    game.targetScore !== null &&
    (sumA >= game.targetScore || sumB >= game.targetScore) &&
    sumA !== sumB
  ) {
    status = "completed";
    completedAt = new Date().toISOString();
    if (sumA > sumB) {
      winnerSide = "team_a";
    } else {
      winnerSide = "team_b";
    }
  }

  return {
    ...game,
    deals: nextDeals,
    scoreA: sumA,
    scoreB: sumB,
    status,
    winnerSide,
    completedAt,
  };
}

export function addDealToCasualGameInStore(params: {
  gameId: string;
  pointsTeamA: number;
  pointsTeamB: number;
  specialTag: CasualSpecialTag;
}): CasualGameRecord[] {
  const current = readCasualGames();
  const updated = current.map((g) => {
    if (g.id !== params.gameId) {
      return g;
    }
    return applyDealToCasualGame(
      g,
      params.pointsTeamA,
      params.pointsTeamB,
      params.specialTag,
    );
  });
  return writeCasualGames(updated);
}

export function undoLastDealInCasualGameStore(
  gameId: string,
): CasualGameRecord[] {
  const current = readCasualGames();
  const updated = current.map((g) => {
    if (g.id !== gameId || g.deals.length === 0) {
      return g;
    }
    const nextDeals = g.deals.slice(0, g.deals.length - 1);
    let sumA = 0;
    let sumB = 0;
    for (const d of nextDeals) {
      sumA += d.pointsTeamA;
      sumB += d.pointsTeamB;
    }
    return {
      ...g,
      deals: nextDeals,
      scoreA: sumA,
      scoreB: sumB,
      status: "in_progress" as const,
      winnerSide: null,
      completedAt: null,
    };
  });
  return writeCasualGames(updated);
}

export function finishCasualGameInStore(params: {
  gameId: string;
  scoreA?: number;
  scoreB?: number;
}): CasualGameRecord[] {
  const current = readCasualGames();
  const updated = current.map((g) => {
    if (g.id !== params.gameId) {
      return g;
    }
    const finalA = params.scoreA ?? g.scoreA;
    const finalB = params.scoreB ?? g.scoreB;
    if (finalA === finalB) {
      return g;
    }
    let winnerSide: "team_a" | "team_b" = "team_a";
    if (finalB > finalA) {
      winnerSide = "team_b";
    }
    return {
      ...g,
      scoreA: finalA,
      scoreB: finalB,
      status: "completed" as const,
      winnerSide,
      completedAt: new Date().toISOString(),
    };
  });
  return writeCasualGames(updated);
}

export function deleteCasualGameFromStore(gameId: string): CasualGameRecord[] {
  const current = readCasualGames();
  return writeCasualGames(current.filter((g) => g.id !== gameId));
}

/**
 * Construit l'annuaire auto-alimente des joueurs de l'ecole a partir des tournois
 * et de toutes les parties libres enregistrees au BAR.
 */
export function collectKnownSchoolPlayers(
  tournamentState: UnifiedTournamentState,
  casualGames: readonly CasualGameRecord[],
): string[] {
  const byKey = new Map<string, string>();
  const register = (raw: string) => {
    const clean = sanitizePlainName(raw);
    const key = normalizeComparisonKey(clean);
    if (key.length > 0 && !byKey.has(key)) {
      byKey.set(key, clean);
    }
  };

  for (const t of tournamentState.teams) {
    register(t.player1Name);
    register(t.player2Name);
  }
  for (const g of casualGames) {
    register(g.teamA[0]);
    register(g.teamA[1]);
    register(g.teamB[0]);
    register(g.teamB[1]);
  }

  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b, "fr"));
}

/**
 * Retourne toutes les parties libres auxquelles un joueur a participe (historique mutuel).
 */
export function getCasualGamesForPlayer(
  games: readonly CasualGameRecord[],
  rawQuery: string,
): CasualGameRecord[] {
  const q = normalizeComparisonKey(rawQuery);
  if (q.length === 0) {
    return [...games];
  }
  return games.filter((g) => {
    const players = [g.teamA[0], g.teamA[1], g.teamB[0], g.teamB[1]];
    for (const p of players) {
      if (normalizeComparisonKey(p).includes(q)) {
        return true;
      }
    }
    return false;
  });
}

interface InternalPlayerAcc {
  key: string;
  displayName: string;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  casualGames: number;
  tournamentGames: number;
  pointsScored: number;
  pointsConceded: number;
  annualPoints: number;
  capotsCount: number;
  generalesCount: number;
  partners: Map<string, { name: string; wins: number; games: number }>;
  opponentsLostTo: Map<string, { name: string; losses: number; games: number }>;
}

/**
 * Calcule le classement general annuel combine (Parties Libres au BAR + Tournois Officiels).
 * Regles :
 * - Chaque match alimente le bilan net positif/negatif (`pointsScored - pointsConceded`)
 * - Partie libre au BAR : +25 pts par victoire, -10 pts par defaite, + delta net / 20
 * - Tournoi officiel Coinch'Eirb (x3 !) : +80 pts par victoire (+150 en phase finale), + delta net / 8
 *   -> les tournois restent de loin le plus gros levier de classement annuel !
 */
export function computeCombinedAnnualLeaderboard(
  casualGames: readonly CasualGameRecord[],
  tournamentState: UnifiedTournamentState,
): PlayerAnnualStandingLive[] {
  const map = new Map<string, InternalPlayerAcc>();

  const ensurePlayer = (rawName: string): InternalPlayerAcc => {
    const clean = sanitizePlainName(rawName);
    const key = normalizeComparisonKey(clean);
    const existing = map.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const created: InternalPlayerAcc = {
      key,
      displayName: clean,
      gamesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0,
      casualGames: 0,
      tournamentGames: 0,
      pointsScored: 0,
      pointsConceded: 0,
      annualPoints: 0,
      capotsCount: 0,
      generalesCount: 0,
      partners: new Map(),
      opponentsLostTo: new Map(),
    };
    map.set(key, created);
    return created;
  };

  const recordOutcome = (params: {
    sideA: [string, string];
    sideB: [string, string];
    scoreA: number;
    scoreB: number;
    winnerSide: "team_a" | "team_b";
    isTournament: boolean;
    isKnockout: boolean;
    isFinal: boolean;
    capots: number;
    generales: number;
  }) => {
    const sides: Array<{
      players: [string, string];
      opponents: [string, string];
      scored: number;
      conceded: number;
      won: boolean;
    }> = [
      {
        players: params.sideA,
        opponents: params.sideB,
        scored: params.scoreA,
        conceded: params.scoreB,
        won: params.winnerSide === "team_a",
      },
      {
        players: params.sideB,
        opponents: params.sideA,
        scored: params.scoreB,
        conceded: params.scoreA,
        won: params.winnerSide === "team_b",
      },
    ];

    for (const side of sides) {
      const diff = side.scored - side.conceded;
      for (let i = 0; i < 2; i += 1) {
        const playerName = side.players[i] ?? "";
        const partnerName = side.players[1 - i] ?? "";
        if (playerName.length === 0) {
          continue;
        }
        const acc = ensurePlayer(playerName);
        acc.gamesPlayed += 1;
        acc.pointsScored += side.scored;
        acc.pointsConceded += side.conceded;

        if (params.isTournament) {
          acc.tournamentGames += 1;
        } else {
          acc.casualGames += 1;
        }

        if (side.won) {
          acc.gamesWon += 1;
          acc.capotsCount += params.capots;
          acc.generalesCount += params.generales;
          if (params.isTournament) {
            let winBonus = 80;
            if (params.isFinal) {
              winBonus = 260;
            } else if (params.isKnockout) {
              winBonus = 140;
            }
            acc.annualPoints += winBonus + Math.round(diff / 8);
          } else {
            acc.annualPoints += 25 + Math.round(diff / 20);
          }
        } else {
          acc.gamesLost += 1;
          if (params.isTournament) {
            acc.annualPoints += Math.round(diff / 14);
          } else {
            acc.annualPoints += -10 + Math.round(diff / 25);
          }
        }

        const partnerKey = normalizeComparisonKey(partnerName);
        if (partnerKey.length > 0) {
          const pStat = acc.partners.get(partnerKey) ?? {
            name: sanitizePlainName(partnerName),
            wins: 0,
            games: 0,
          };
          pStat.games += 1;
          if (side.won) {
            pStat.wins += 1;
          }
          acc.partners.set(partnerKey, pStat);
        }

        for (const oppName of side.opponents) {
          const oppKey = normalizeComparisonKey(oppName);
          if (oppKey.length === 0) {
            continue;
          }
          const oStat = acc.opponentsLostTo.get(oppKey) ?? {
            name: sanitizePlainName(oppName),
            losses: 0,
            games: 0,
          };
          oStat.games += 1;
          if (!side.won) {
            oStat.losses += 1;
          }
          acc.opponentsLostTo.set(oppKey, oStat);
        }
      }
    }
  };

  // 1. Parties libres terminees au BAR
  for (const game of casualGames) {
    if (game.status !== "completed" || game.winnerSide === null) {
      continue;
    }
    let capots = 0;
    let generales = 0;
    for (const d of game.deals) {
      if (d.specialTag === "capot") {
        capots += 1;
      } else if (d.specialTag === "generale") {
        generales += 1;
      }
    }
    recordOutcome({
      sideA: game.teamA,
      sideB: game.teamB,
      scoreA: game.scoreA,
      scoreB: game.scoreB,
      winnerSide: game.winnerSide,
      isTournament: false,
      isKnockout: false,
      isFinal: false,
      capots,
      generales,
    });
  }

  // 2. Matchs de tournoi officiel Coinch'Eirb (gros multiplicateur annuel)
  for (const match of tournamentState.matches) {
    if (
      (match.status !== "completed" && match.status !== "forfeit") ||
      match.winnerTeamId === null
    ) {
      continue;
    }
    const teamA = findUnifiedTeam(tournamentState.teams, match.teamAId);
    const teamB = findUnifiedTeam(tournamentState.teams, match.teamBId);
    if (teamA === null || teamB === null) {
      continue;
    }
    let winnerSide: "team_a" | "team_b" = "team_a";
    if (match.winnerTeamId === teamB.id) {
      winnerSide = "team_b";
    }
    let capots = 0;
    let generales = 0;
    for (const d of match.deals) {
      if (d.specialAnnouncement === "capot" && d.announcementOutcome === "passed") {
        capots += 1;
      } else if (
        d.specialAnnouncement === "generale" &&
        d.announcementOutcome === "passed"
      ) {
        generales += 1;
      }
    }

    recordOutcome({
      sideA: [teamA.player1Name, teamA.player2Name],
      sideB: [teamB.player1Name, teamB.player2Name],
      scoreA: match.scoreTeamA,
      scoreB: match.scoreTeamB,
      winnerSide,
      isTournament: true,
      isKnockout: match.phase !== "pool",
      isFinal: match.phase === "final",
      capots,
      generales,
    });
  }

  const list: PlayerAnnualStandingLive[] = [];
  for (const acc of map.values()) {
    let bestPartner: { name: string; wins: number; games: number } | null = null;
    for (const p of acc.partners.values()) {
      if (
        bestPartner === null ||
        p.wins > bestPartner.wins ||
        (p.wins === bestPartner.wins && p.games > bestPartner.games)
      ) {
        bestPartner = p;
      }
    }

    let nemesis: { name: string; losses: number; games: number } | null = null;
    for (const o of acc.opponentsLostTo.values()) {
      if (o.losses === 0) {
        continue;
      }
      if (
        nemesis === null ||
        o.losses > nemesis.losses ||
        (o.losses === nemesis.losses && o.games < nemesis.games)
      ) {
        nemesis = o;
      }
    }

    list.push({
      rank: 0,
      playerKey: acc.key,
      displayName: acc.displayName,
      annualPoints: acc.annualPoints,
      netBalance: acc.pointsScored - acc.pointsConceded,
      gamesPlayed: acc.gamesPlayed,
      gamesWon: acc.gamesWon,
      gamesLost: acc.gamesLost,
      casualGames: acc.casualGames,
      tournamentGames: acc.tournamentGames,
      pointsScored: acc.pointsScored,
      pointsConceded: acc.pointsConceded,
      capotsCount: acc.capotsCount,
      generalesCount: acc.generalesCount,
      bestPartner,
      nemesis,
    });
  }

  list.sort((a, b) => {
    if (b.annualPoints !== a.annualPoints) {
      return b.annualPoints - a.annualPoints;
    }
    if (b.netBalance !== a.netBalance) {
      return b.netBalance - a.netBalance;
    }
    return b.gamesWon - a.gamesWon;
  });

  return list.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}
