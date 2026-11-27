import {
  normalizeComparisonKey,
  sanitizePlainName,
} from "@/lib/security/sanitize";
import {
  findUnifiedTeam,
  formatOptionalTeamNickname,
  formatPlayersPrimaryName,
  type UnifiedTournamentState,
} from "@/lib/tournament/live-store-types";

export const CASUAL_STORE_KEY = "coincheirb-casual-games-v2";
export const PLAYER_DIRECTORY_STORE_KEY = "coincheirb-player-directory-v1";
export const CASUAL_BROADCAST_CHANNEL = "coincheirb-casual-sync";
export const CASUAL_LOCAL_EVENT = "coincheirb-casual-updated";

export type CasualSpecialTag =
  | "capot"
  | "generale"
  | "coinche"
  | "surcoinche"
  | "parlante"
  | null;

export type EnseirbDepartment =
  | "Informatique"
  | "Électronique"
  | "Télécoms"
  | "Matmeca"
  | "RSI"
  | "ENSEIRB";

export type EnseirbPromoYear = "1A" | "2A" | "3A" | "Alumni";

export interface SchoolPlayerDirectoryEntry {
  id: string;
  name: string;
  normalizedKey: string;
  department: EnseirbDepartment;
  promoYear: EnseirbPromoYear;
  playStyle: string;
  favoriteAnnouncement: string;
  addedByPseudo: string | null;
  createdAt: string;
}

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
  department: EnseirbDepartment;
  promoYear: EnseirbPromoYear;
  playStyle: string;
  addedByPseudo: string | null;
  annualPoints: number;
  netBalance: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  winRatePercent: number;
  currentStreak: number;
  casualGames: number;
  tournamentGames: number;
  pointsScored: number;
  pointsConceded: number;
  capotsCount: number;
  generalesCount: number;
  coinchesCount: number;
  bestPartner: { name: string; wins: number; games: number } | null;
  nemesis: { name: string; losses: number; games: number } | null;
}

export interface TeamAnnualStandingLive {
  rank: number;
  teamKey: string;
  player1Name: string;
  player2Name: string;
  pairLabel: string;
  teamNickname: string | null;
  promotionLabel: string;
  teamPoints: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  winRatePercent: number;
  tournamentMatchesPlayed: number;
  tournamentMatchesWon: number;
  casualMatchesPlayed: number;
  casualMatchesWon: number;
  tournamentsFinalWon: number;
  pointsScored: number;
  pointsConceded: number;
  netBalance: number;
  capotsCount: number;
  generalesCount: number;
  coinchesCount: number;
  currentWinStreak: number;
  bestWinStreak: number;
}

export interface PartnerCompatibilityProfile {
  playerKey: string;
  displayName: string;
  isKnownInDirectory: boolean;
  department: EnseirbDepartment;
  promoYear: EnseirbPromoYear;
  playStyle: string;
  favoriteAnnouncement: string;
  addedByPseudo: string | null;
  overallGames: number;
  overallWins: number;
  overallLosses: number;
  overallWinRatePercent: number;
  overallNetBalance: number;
  overallCapots: number;
  overallGenerales: number;
  gamesTogether: number;
  winsTogether: number;
  lossesTogether: number;
  winRateTogetherPercent: number;
  netPointsTogether: number;
  capotsTogether: number;
  generalesTogether: number;
  chemistryLabel: string;
  chemistryTone: "pass" | "amber" | "terracotta" | "neutral";
  gamesAgainst: number;
  myWinsAgainst: number;
  myLossesAgainst: number;
}

/**
 * Demarre a zero partie fictive : le classement se construit exclusivement
 * avec les vrais joueurs et binomes de l'ENSEIRB.
 */
export function createDefaultCasualGames(): CasualGameRecord[] {
  return [];
}

function notifyCasualListeners(count: number): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.dispatchEvent(new CustomEvent(CASUAL_LOCAL_EVENT));
  } catch {
    // Ignore
  }
  if ("BroadcastChannel" in window) {
    try {
      const ch = new BroadcastChannel(CASUAL_BROADCAST_CHANNEL);
      ch.postMessage({ kind: "casual_sync", count });
      ch.close();
    } catch {
      // Ignore
    }
  }
}

export function readCasualGames(): CasualGameRecord[] {
  if (typeof window === "undefined") {
    return createDefaultCasualGames();
  }
  try {
    // Purge de l'ancienne cle contenant des parties fictives
    window.localStorage.removeItem("coincheirb-casual-games-v1");
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
    notifyCasualListeners(games.length);
  }
  return games;
}

export function readPlayerDirectory(): SchoolPlayerDirectoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(PLAYER_DIRECTORY_STORE_KEY);
    if (raw !== null && raw.length > 0) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as SchoolPlayerDirectoryEntry[];
      }
    }
  } catch {
    // Ignore
  }
  return [];
}

export function writePlayerDirectory(
  entries: SchoolPlayerDirectoryEntry[],
): SchoolPlayerDirectoryEntry[] {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        PLAYER_DIRECTORY_STORE_KEY,
        JSON.stringify(entries),
      );
    } catch {
      // Ignore
    }
    notifyCasualListeners(entries.length);
  }
  return entries;
}

/**
 * Permet a un joueur connecte d'ajouter ou d'enrichir la fiche d'un partenaire / joueur de l'ENSEIRB
 * meme s'il n'est pas cette personne, afin de le connaitre, le selectionner et construire le classement.
 */
export function registerOrUpdateDirectoryPlayer(params: {
  name: string;
  department?: EnseirbDepartment;
  promoYear?: EnseirbPromoYear;
  playStyle?: string;
  favoriteAnnouncement?: string;
  addedByPseudo: string | null;
}): SchoolPlayerDirectoryEntry {
  const cleanName = sanitizePlainName(params.name);
  const normKey = normalizeComparisonKey(cleanName);
  if (normKey.length < 2) {
    throw new Error("Le prénom ou pseudo du joueur doit contenir au moins 2 caractères.");
  }

  let dept: EnseirbDepartment = "ENSEIRB";
  if (params.department !== undefined) {
    dept = params.department;
  }

  let promo: EnseirbPromoYear = "2A";
  if (params.promoYear !== undefined) {
    promo = params.promoYear;
  }

  let style = "Régulier au BAR";
  if (params.playStyle !== undefined && params.playStyle.trim().length > 0) {
    style = sanitizePlainName(params.playStyle).slice(0, 48);
  }

  let fav = "Coinche ×2";
  if (
    params.favoriteAnnouncement !== undefined &&
    params.favoriteAnnouncement.trim().length > 0
  ) {
    fav = sanitizePlainName(params.favoriteAnnouncement).slice(0, 36);
  }

  let addedBy: string | null = null;
  if (params.addedByPseudo !== null && params.addedByPseudo.trim().length > 0) {
    addedBy = sanitizePlainName(params.addedByPseudo).slice(0, 40);
  }

  const current = readPlayerDirectory();
  const existingIdx = current.findIndex((p) => p.normalizedKey === normKey);

  if (existingIdx >= 0) {
    const existing = current[existingIdx];
    if (existing !== undefined) {
      const updatedEntry: SchoolPlayerDirectoryEntry = {
        ...existing,
        name: cleanName,
        department: dept,
        promoYear: promo,
        playStyle: style,
        favoriteAnnouncement: fav,
        addedByPseudo: addedBy ?? existing.addedByPseudo,
      };
      const nextList = [...current];
      nextList[existingIdx] = updatedEntry;
      writePlayerDirectory(nextList);
      if (typeof window !== "undefined") {
        void fetch("/api/casual/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "upsert_player", player: updatedEntry }),
        }).catch(() => {});
      }
      return updatedEntry;
    }
  }

  const created: SchoolPlayerDirectoryEntry = {
    id: `dir-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: cleanName,
    normalizedKey: normKey,
    department: dept,
    promoYear: promo,
    playStyle: style,
    favoriteAnnouncement: fav,
    addedByPseudo: addedBy,
    createdAt: new Date().toISOString(),
  };

  writePlayerDirectory([created, ...current]);
  if (typeof window !== "undefined") {
    void fetch("/api/casual/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert_player", player: created }),
    }).catch(() => {});
  }
  return created;
}

export function removeDirectoryPlayer(playerId: string): SchoolPlayerDirectoryEntry[] {
  const current = readPlayerDirectory();
  return writePlayerDirectory(current.filter((p) => p.id !== playerId));
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
 * Construit l'annuaire auto-alimente des joueurs de l'ecole a partir de l'annuaire ENSEIRB,
 * des tournois et de toutes les parties libres enregistrees au BAR.
 */
export function collectKnownSchoolPlayers(
  tournamentState: UnifiedTournamentState,
  casualGames: readonly CasualGameRecord[],
  directoryEntries?: readonly SchoolPlayerDirectoryEntry[],
): string[] {
  const byKey = new Map<string, string>();
  const register = (raw: string) => {
    const clean = sanitizePlainName(raw);
    const key = normalizeComparisonKey(clean);
    if (key.length > 0 && !byKey.has(key)) {
      byKey.set(key, clean);
    }
  };

  const dir = directoryEntries ?? readPlayerDirectory();
  for (const entry of dir) {
    register(entry.name);
  }
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
  department: EnseirbDepartment;
  promoYear: EnseirbPromoYear;
  playStyle: string;
  addedByPseudo: string | null;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  currentStreak: number;
  casualGames: number;
  tournamentGames: number;
  pointsScored: number;
  pointsConceded: number;
  annualPoints: number;
  capotsCount: number;
  generalesCount: number;
  coinchesCount: number;
  partners: Map<string, { name: string; wins: number; games: number }>;
  opponentsLostTo: Map<string, { name: string; losses: number; games: number }>;
}

/**
 * Calcule le classement general INDIVIDUEL annuel combine (Parties Libres au BAR + Tournois Officiels + Annuaire ENSEIRB).
 */
export function computeCombinedAnnualLeaderboard(
  casualGames: readonly CasualGameRecord[],
  tournamentState: UnifiedTournamentState,
  directoryEntries?: readonly SchoolPlayerDirectoryEntry[],
): PlayerAnnualStandingLive[] {
  const map = new Map<string, InternalPlayerAcc>();
  const dir = directoryEntries ?? readPlayerDirectory();
  const dirByKey = new Map<string, SchoolPlayerDirectoryEntry>();
  for (const entry of dir) {
    dirByKey.set(entry.normalizedKey, entry);
  }

  const ensurePlayer = (rawName: string): InternalPlayerAcc => {
    const clean = sanitizePlainName(rawName);
    const key = normalizeComparisonKey(clean);
    const existing = map.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const dirMeta = dirByKey.get(key);
    let department: EnseirbDepartment = "ENSEIRB";
    let promoYear: EnseirbPromoYear = "2A";
    let playStyle = "Joueur du BAR";
    let addedByPseudo: string | null = null;
    if (dirMeta !== undefined) {
      department = dirMeta.department;
      promoYear = dirMeta.promoYear;
      playStyle = dirMeta.playStyle;
      addedByPseudo = dirMeta.addedByPseudo;
    }

    const created: InternalPlayerAcc = {
      key,
      displayName: dirMeta?.name ?? clean,
      department,
      promoYear,
      playStyle,
      addedByPseudo,
      gamesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0,
      currentStreak: 0,
      casualGames: 0,
      tournamentGames: 0,
      pointsScored: 0,
      pointsConceded: 0,
      annualPoints: 0,
      capotsCount: 0,
      generalesCount: 0,
      coinchesCount: 0,
      partners: new Map(),
      opponentsLostTo: new Map(),
    };
    map.set(key, created);
    return created;
  };

  // Pre-enregistre les joueurs ajoutes dans l'annuaire et les equipes inscrites au check-in
  for (const entry of dir) {
    ensurePlayer(entry.name);
  }
  for (const team of tournamentState.teams) {
    if (team.player1Name.trim().length > 0) {
      ensurePlayer(team.player1Name);
    }
    if (team.player2Name.trim().length > 0) {
      ensurePlayer(team.player2Name);
    }
  }

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
    coinches: number;
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
          acc.currentStreak += 1;
          acc.capotsCount += params.capots;
          acc.generalesCount += params.generales;
          acc.coinchesCount += params.coinches;
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
          acc.currentStreak = 0;
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

  // 1. Parties libres terminees au BAR (du plus ancien au plus recent pour le calcul de serie)
  const orderedCasual = [...casualGames].reverse();
  for (const game of orderedCasual) {
    if (game.status !== "completed" || game.winnerSide === null) {
      continue;
    }
    let capots = 0;
    let generales = 0;
    let coinches = 0;
    for (const d of game.deals) {
      if (d.specialTag === "capot") {
        capots += 1;
      } else if (d.specialTag === "generale") {
        generales += 1;
      } else if (d.specialTag === "coinche" || d.specialTag === "surcoinche") {
        coinches += 1;
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
      coinches,
    });
  }

  // 2. Matchs de tournoi officiel Coinch'Eirb
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
    let coinches = 0;
    for (const d of match.deals) {
      if (d.specialAnnouncement === "capot" && d.announcementOutcome === "passed") {
        capots += 1;
      } else if (
        d.specialAnnouncement === "generale" &&
        d.announcementOutcome === "passed"
      ) {
        generales += 1;
      } else if (
        (d.specialAnnouncement === "coinche" ||
          d.specialAnnouncement === "surcoinche") &&
        d.announcementOutcome === "passed"
      ) {
        coinches += 1;
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
      coinches,
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

    let winRatePercent = 0;
    if (acc.gamesPlayed > 0) {
      winRatePercent = Math.round((acc.gamesWon * 100) / acc.gamesPlayed);
    }

    list.push({
      rank: 0,
      playerKey: acc.key,
      displayName: acc.displayName,
      department: acc.department,
      promoYear: acc.promoYear,
      playStyle: acc.playStyle,
      addedByPseudo: acc.addedByPseudo,
      annualPoints: acc.annualPoints,
      netBalance: acc.pointsScored - acc.pointsConceded,
      gamesPlayed: acc.gamesPlayed,
      gamesWon: acc.gamesWon,
      gamesLost: acc.gamesLost,
      winRatePercent,
      currentStreak: acc.currentStreak,
      casualGames: acc.casualGames,
      tournamentGames: acc.tournamentGames,
      pointsScored: acc.pointsScored,
      pointsConceded: acc.pointsConceded,
      capotsCount: acc.capotsCount,
      generalesCount: acc.generalesCount,
      coinchesCount: acc.coinchesCount,
      bestPartner,
      nemesis,
    });
  }

  list.sort((a, b) => {
    if (b.gamesWon !== a.gamesWon) {
      return b.gamesWon - a.gamesWon;
    }
    if (b.annualPoints !== a.annualPoints) {
      return b.annualPoints - a.annualPoints;
    }
    if (b.netBalance !== a.netBalance) {
      return b.netBalance - a.netBalance;
    }
    return a.displayName.localeCompare(b.displayName, "fr");
  });

  return list.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}

interface InternalTeamAcc {
  teamKey: string;
  player1Name: string;
  player2Name: string;
  teamNickname: string | null;
  promotionLabel: string;
  teamPoints: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  tournamentMatchesPlayed: number;
  tournamentMatchesWon: number;
  casualMatchesPlayed: number;
  casualMatchesWon: number;
  tournamentsFinalWon: number;
  pointsScored: number;
  pointsConceded: number;
  capotsCount: number;
  generalesCount: number;
  coinchesCount: number;
  currentWinStreak: number;
  bestWinStreak: number;
}

function makeCanonicalPairKey(nameA: string, nameB: string): {
  key: string;
  ordered: [string, string];
} {
  const cleanA = sanitizePlainName(nameA);
  const cleanB = sanitizePlainName(nameB);
  const keyA = normalizeComparisonKey(cleanA);
  const keyB = normalizeComparisonKey(cleanB);
  if (keyA.localeCompare(keyB, "fr") <= 0) {
    return { key: `${keyA}::${keyB}`, ordered: [cleanA, cleanB] };
  }
  return { key: `${keyB}::${keyA}`, ordered: [cleanB, cleanA] };
}

/**
 * Calcule le CLASSEMENT EN EQUIPE (Binomes ENSEIRB) :
 * Identifie quelles sont les equipes / paires de joueurs qui gagnent le plus a l'ENSEIRB
 * en cumulant les tournois officiels et les parties libres au BAR.
 */
export function computeEnseirbTeamLeaderboard(
  casualGames: readonly CasualGameRecord[],
  tournamentState: UnifiedTournamentState,
  directoryEntries?: readonly SchoolPlayerDirectoryEntry[],
): TeamAnnualStandingLive[] {
  const map = new Map<string, InternalTeamAcc>();
  const dir = directoryEntries ?? readPlayerDirectory();
  const dirByKey = new Map<string, SchoolPlayerDirectoryEntry>();
  for (const entry of dir) {
    dirByKey.set(entry.normalizedKey, entry);
  }

  const ensureTeam = (
    rawP1: string,
    rawP2: string,
    optionalNickname?: string | null,
    optionalPromo?: string | null,
  ): InternalTeamAcc | null => {
    const clean1 = sanitizePlainName(rawP1);
    const clean2 = sanitizePlainName(rawP2);
    if (clean1.length === 0 || clean2.length === 0) {
      return null;
    }
    const canonical = makeCanonicalPairKey(clean1, clean2);
    const existing = map.get(canonical.key);
    if (existing !== undefined) {
      if (
        existing.teamNickname === null &&
        optionalNickname !== undefined &&
        optionalNickname !== null &&
        optionalNickname.trim().length > 0
      ) {
        existing.teamNickname = optionalNickname.trim();
      }
      return existing;
    }

    const p1Meta = dirByKey.get(normalizeComparisonKey(canonical.ordered[0]));
    const p2Meta = dirByKey.get(normalizeComparisonKey(canonical.ordered[1]));
    let promoLabel = optionalPromo ?? "ENSEIRB-MATMECA";
    if (p1Meta !== undefined && p2Meta !== undefined) {
      promoLabel = `${p1Meta.promoYear} ${p1Meta.department} · ${p2Meta.promoYear} ${p2Meta.department}`;
    } else if (p1Meta !== undefined) {
      promoLabel = `${p1Meta.promoYear} ${p1Meta.department}`;
    } else if (p2Meta !== undefined) {
      promoLabel = `${p2Meta.promoYear} ${p2Meta.department}`;
    }

    const created: InternalTeamAcc = {
      teamKey: canonical.key,
      player1Name: canonical.ordered[0],
      player2Name: canonical.ordered[1],
      teamNickname: optionalNickname ?? null,
      promotionLabel: promoLabel,
      teamPoints: 0,
      matchesPlayed: 0,
      matchesWon: 0,
      matchesLost: 0,
      tournamentMatchesPlayed: 0,
      tournamentMatchesWon: 0,
      casualMatchesPlayed: 0,
      casualMatchesWon: 0,
      tournamentsFinalWon: 0,
      pointsScored: 0,
      pointsConceded: 0,
      capotsCount: 0,
      generalesCount: 0,
      coinchesCount: 0,
      currentWinStreak: 0,
      bestWinStreak: 0,
    };
    map.set(canonical.key, created);
    return created;
  };

  // 1. Pre-enregistre tous les binomes inscrits au tournoi
  for (const t of tournamentState.teams) {
    const nick = formatOptionalTeamNickname(
      t.teamName,
      t.player1Name,
      t.player2Name,
    );
    ensureTeam(t.player1Name, t.player2Name, nick, t.promotionLabel);
  }

  const recordTeamMatch = (params: {
    pairA: [string, string];
    pairB: [string, string];
    nickA: string | null;
    nickB: string | null;
    scoreA: number;
    scoreB: number;
    winnerSide: "team_a" | "team_b";
    isTournament: boolean;
    isKnockout: boolean;
    isFinal: boolean;
    capotsA: number;
    capotsB: number;
    generalesA: number;
    generalesB: number;
    coinchesA: number;
    coinchesB: number;
  }) => {
    const accA = ensureTeam(params.pairA[0], params.pairA[1], params.nickA);
    const accB = ensureTeam(params.pairB[0], params.pairB[1], params.nickB);

    const applySide = (
      acc: InternalTeamAcc | null,
      scored: number,
      conceded: number,
      won: boolean,
      capots: number,
      generales: number,
      coinches: number,
    ) => {
      if (acc === null) {
        return;
      }
      const diff = scored - conceded;
      acc.matchesPlayed += 1;
      acc.pointsScored += scored;
      acc.pointsConceded += conceded;
      acc.capotsCount += capots;
      acc.generalesCount += generales;
      acc.coinchesCount += coinches;

      if (params.isTournament) {
        acc.tournamentMatchesPlayed += 1;
      } else {
        acc.casualMatchesPlayed += 1;
      }

      if (won) {
        acc.matchesWon += 1;
        acc.currentWinStreak += 1;
        if (acc.currentWinStreak > acc.bestWinStreak) {
          acc.bestWinStreak = acc.currentWinStreak;
        }
        if (params.isTournament) {
          acc.tournamentMatchesWon += 1;
          let bonus = 100;
          if (params.isFinal) {
            bonus = 300;
            acc.tournamentsFinalWon += 1;
          } else if (params.isKnockout) {
            bonus = 160;
          }
          acc.teamPoints += bonus + Math.round(diff / 8);
        } else {
          acc.casualMatchesWon += 1;
          acc.teamPoints += 35 + Math.round(diff / 18);
        }
      } else {
        acc.matchesLost += 1;
        acc.currentWinStreak = 0;
        if (params.isTournament) {
          acc.teamPoints += Math.round(diff / 15);
        } else {
          acc.teamPoints += -10 + Math.round(diff / 25);
        }
      }
    };

    applySide(
      accA,
      params.scoreA,
      params.scoreB,
      params.winnerSide === "team_a",
      params.capotsA,
      params.generalesA,
      params.coinchesA,
    );
    applySide(
      accB,
      params.scoreB,
      params.scoreA,
      params.winnerSide === "team_b",
      params.capotsB,
      params.generalesB,
      params.coinchesB,
    );
  };

  // 2. Parties libres au BAR
  const orderedCasual = [...casualGames].reverse();
  for (const game of orderedCasual) {
    if (game.status !== "completed" || game.winnerSide === null) {
      continue;
    }
    let capotsA = 0;
    let capotsB = 0;
    let generalesA = 0;
    let generalesB = 0;
    let coinchesA = 0;
    let coinchesB = 0;

    for (const d of game.deals) {
      const aWonDeal = d.pointsTeamA >= d.pointsTeamB;
      if (d.specialTag === "capot") {
        if (aWonDeal) {
          capotsA += 1;
        } else {
          capotsB += 1;
        }
      } else if (d.specialTag === "generale") {
        if (aWonDeal) {
          generalesA += 1;
        } else {
          generalesB += 1;
        }
      } else if (d.specialTag === "coinche" || d.specialTag === "surcoinche") {
        if (aWonDeal) {
          coinchesA += 1;
        } else {
          coinchesB += 1;
        }
      }
    }

    recordTeamMatch({
      pairA: game.teamA,
      pairB: game.teamB,
      nickA: null,
      nickB: null,
      scoreA: game.scoreA,
      scoreB: game.scoreB,
      winnerSide: game.winnerSide,
      isTournament: false,
      isKnockout: false,
      isFinal: false,
      capotsA,
      capotsB,
      generalesA,
      generalesB,
      coinchesA,
      coinchesB,
    });
  }

  // 3. Matchs de tournoi officiel Coinch'Eirb
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

    let capotsA = 0;
    let capotsB = 0;
    let generalesA = 0;
    let generalesB = 0;
    let coinchesA = 0;
    let coinchesB = 0;

    for (const d of match.deals) {
      const aWonDeal = d.pointsTeamA >= d.pointsTeamB;
      if (d.specialAnnouncement === "capot" && d.announcementOutcome === "passed") {
        if (aWonDeal) {
          capotsA += 1;
        } else {
          capotsB += 1;
        }
      } else if (
        d.specialAnnouncement === "generale" &&
        d.announcementOutcome === "passed"
      ) {
        if (aWonDeal) {
          generalesA += 1;
        } else {
          generalesB += 1;
        }
      } else if (
        (d.specialAnnouncement === "coinche" ||
          d.specialAnnouncement === "surcoinche") &&
        d.announcementOutcome === "passed"
      ) {
        if (aWonDeal) {
          coinchesA += 1;
        } else {
          coinchesB += 1;
        }
      }
    }

    const nickA = formatOptionalTeamNickname(
      teamA.teamName,
      teamA.player1Name,
      teamA.player2Name,
    );
    const nickB = formatOptionalTeamNickname(
      teamB.teamName,
      teamB.player1Name,
      teamB.player2Name,
    );

    recordTeamMatch({
      pairA: [teamA.player1Name, teamA.player2Name],
      pairB: [teamB.player1Name, teamB.player2Name],
      nickA,
      nickB,
      scoreA: match.scoreTeamA,
      scoreB: match.scoreTeamB,
      winnerSide,
      isTournament: true,
      isKnockout: match.phase !== "pool",
      isFinal: match.phase === "final",
      capotsA,
      capotsB,
      generalesA,
      generalesB,
      coinchesA,
      coinchesB,
    });
  }

  const out: TeamAnnualStandingLive[] = [];
  for (const acc of map.values()) {
    let winRatePercent = 0;
    if (acc.matchesPlayed > 0) {
      winRatePercent = Math.round((acc.matchesWon * 100) / acc.matchesPlayed);
    }
    out.push({
      rank: 0,
      teamKey: acc.teamKey,
      player1Name: acc.player1Name,
      player2Name: acc.player2Name,
      pairLabel: formatPlayersPrimaryName(acc.player1Name, acc.player2Name),
      teamNickname: acc.teamNickname,
      promotionLabel: acc.promotionLabel,
      teamPoints: acc.teamPoints,
      matchesPlayed: acc.matchesPlayed,
      matchesWon: acc.matchesWon,
      matchesLost: acc.matchesLost,
      winRatePercent,
      tournamentMatchesPlayed: acc.tournamentMatchesPlayed,
      tournamentMatchesWon: acc.tournamentMatchesWon,
      casualMatchesPlayed: acc.casualMatchesPlayed,
      casualMatchesWon: acc.casualMatchesWon,
      tournamentsFinalWon: acc.tournamentsFinalWon,
      pointsScored: acc.pointsScored,
      pointsConceded: acc.pointsConceded,
      netBalance: acc.pointsScored - acc.pointsConceded,
      capotsCount: acc.capotsCount,
      generalesCount: acc.generalesCount,
      coinchesCount: acc.coinchesCount,
      currentWinStreak: acc.currentWinStreak,
      bestWinStreak: acc.bestWinStreak,
    });
  }

  out.sort((a, b) => {
    if (b.matchesWon !== a.matchesWon) {
      return b.matchesWon - a.matchesWon;
    }
    if (b.teamPoints !== a.teamPoints) {
      return b.teamPoints - a.teamPoints;
    }
    if (b.winRatePercent !== a.winRatePercent) {
      return b.winRatePercent - a.winRatePercent;
    }
    if (b.netBalance !== a.netBalance) {
      return b.netBalance - a.netBalance;
    }
    return a.pairLabel.localeCompare(b.pairLabel, "fr");
  });

  return out.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

/**
 * Permet de CONNAITRE LA PERSONNE AVEC QUI ON JOUE :
 * Calcule la fiche complete d'un partenaire (son profil ENSEIRB, son style de jeu,
 * votre alchimie en duo et votre face-a-face).
 */
export function computePartnerCompatibilityProfile(params: {
  partnerName: string;
  myName?: string | null;
  casualGames: readonly CasualGameRecord[];
  tournamentState: UnifiedTournamentState;
  directoryEntries?: readonly SchoolPlayerDirectoryEntry[];
}): PartnerCompatibilityProfile | null {
  const cleanPartner = sanitizePlainName(params.partnerName);
  const partnerKey = normalizeComparisonKey(cleanPartner);
  if (partnerKey.length < 2) {
    return null;
  }

  const myKey = normalizeComparisonKey(sanitizePlainName(params.myName ?? ""));
  const dir = params.directoryEntries ?? readPlayerDirectory();
  const dirEntry = dir.find((d) => d.normalizedKey === partnerKey);

  const individualList = computeCombinedAnnualLeaderboard(
    params.casualGames,
    params.tournamentState,
    dir,
  );
  const standing = individualList.find((p) => p.playerKey === partnerKey);

  let gamesTogether = 0;
  let winsTogether = 0;
  let lossesTogether = 0;
  let netPointsTogether = 0;
  let capotsTogether = 0;
  let generalesTogether = 0;

  let gamesAgainst = 0;
  let myWinsAgainst = 0;
  let myLossesAgainst = 0;

  if (myKey.length >= 2 && myKey !== partnerKey) {
    const inspectMatch = (
      sideA: [string, string],
      sideB: [string, string],
      scoreA: number,
      scoreB: number,
      winnerSide: "team_a" | "team_b",
      capotsA: number,
      capotsB: number,
      generalesA: number,
      generalesB: number,
    ) => {
      const keysA = [
        normalizeComparisonKey(sideA[0]),
        normalizeComparisonKey(sideA[1]),
      ];
      const keysB = [
        normalizeComparisonKey(sideB[0]),
        normalizeComparisonKey(sideB[1]),
      ];

      const meInA = keysA.includes(myKey);
      const meInB = keysB.includes(myKey);
      const partnerInA = keysA.includes(partnerKey);
      const partnerInB = keysB.includes(partnerKey);

      if (meInA && partnerInA) {
        gamesTogether += 1;
        netPointsTogether += scoreA - scoreB;
        capotsTogether += capotsA;
        generalesTogether += generalesA;
        if (winnerSide === "team_a") {
          winsTogether += 1;
        } else {
          lossesTogether += 1;
        }
      } else if (meInB && partnerInB) {
        gamesTogether += 1;
        netPointsTogether += scoreB - scoreA;
        capotsTogether += capotsB;
        generalesTogether += generalesB;
        if (winnerSide === "team_b") {
          winsTogether += 1;
        } else {
          lossesTogether += 1;
        }
      } else if (meInA && partnerInB) {
        gamesAgainst += 1;
        if (winnerSide === "team_a") {
          myWinsAgainst += 1;
        } else {
          myLossesAgainst += 1;
        }
      } else if (meInB && partnerInA) {
        gamesAgainst += 1;
        if (winnerSide === "team_b") {
          myWinsAgainst += 1;
        } else {
          myLossesAgainst += 1;
        }
      }
    };

    for (const g of params.casualGames) {
      if (g.status !== "completed" || g.winnerSide === null) {
        continue;
      }
      let cA = 0;
      let cB = 0;
      let genA = 0;
      let genB = 0;
      for (const d of g.deals) {
        if (d.specialTag === "capot") {
          if (d.pointsTeamA >= d.pointsTeamB) {
            cA += 1;
          } else {
            cB += 1;
          }
        } else if (d.specialTag === "generale") {
          if (d.pointsTeamA >= d.pointsTeamB) {
            genA += 1;
          } else {
            genB += 1;
          }
        }
      }
      inspectMatch(
        g.teamA,
        g.teamB,
        g.scoreA,
        g.scoreB,
        g.winnerSide,
        cA,
        cB,
        genA,
        genB,
      );
    }

    for (const m of params.tournamentState.matches) {
      if (
        (m.status !== "completed" && m.status !== "forfeit") ||
        m.winnerTeamId === null
      ) {
        continue;
      }
      const tA = findUnifiedTeam(params.tournamentState.teams, m.teamAId);
      const tB = findUnifiedTeam(params.tournamentState.teams, m.teamBId);
      if (tA === null || tB === null) {
        continue;
      }
      let winSide: "team_a" | "team_b" = "team_a";
      if (m.winnerTeamId === tB.id) {
        winSide = "team_b";
      }
      let cA = 0;
      let cB = 0;
      let genA = 0;
      let genB = 0;
      for (const d of m.deals) {
        if (d.specialAnnouncement === "capot" && d.announcementOutcome === "passed") {
          if (d.pointsTeamA >= d.pointsTeamB) {
            cA += 1;
          } else {
            cB += 1;
          }
        } else if (
          d.specialAnnouncement === "generale" &&
          d.announcementOutcome === "passed"
        ) {
          if (d.pointsTeamA >= d.pointsTeamB) {
            genA += 1;
          } else {
            genB += 1;
          }
        }
      }
      inspectMatch(
        [tA.player1Name, tA.player2Name],
        [tB.player1Name, tB.player2Name],
        m.scoreTeamA,
        m.scoreTeamB,
        winSide,
        cA,
        cB,
        genA,
        genB,
      );
    }
  }

  let winRateTogetherPercent = 0;
  if (gamesTogether > 0) {
    winRateTogetherPercent = Math.round((winsTogether * 100) / gamesTogether);
  }

  let chemistryLabel = "Nouveau duo à former";
  let chemistryTone: "pass" | "amber" | "terracotta" | "neutral" = "neutral";

  if (gamesTogether >= 2 && winRateTogetherPercent >= 75) {
    chemistryLabel = `Duo Dominant (${winRateTogetherPercent}% de victoires)`;
    chemistryTone = "pass";
  } else if (gamesTogether >= 1 && winRateTogetherPercent >= 50) {
    chemistryLabel = `Alchimie Positive (${winsTogether}V–${lossesTogether}D ensemble)`;
    chemistryTone = "amber";
  } else if (gamesTogether >= 1) {
    chemistryLabel = `Duo en rodage (${winsTogether}V–${lossesTogether}D ensemble)`;
    chemistryTone = "terracotta";
  }

  let overallGames = 0;
  let overallWins = 0;
  let overallLosses = 0;
  let overallWinRate = 0;
  let overallNet = 0;
  let overallCapots = 0;
  let overallGenerales = 0;

  if (standing !== undefined) {
    overallGames = standing.gamesPlayed;
    overallWins = standing.gamesWon;
    overallLosses = standing.gamesLost;
    overallWinRate = standing.winRatePercent;
    overallNet = standing.netBalance;
    overallCapots = standing.capotsCount;
    overallGenerales = standing.generalesCount;
  }

  return {
    playerKey: partnerKey,
    displayName: dirEntry?.name ?? standing?.displayName ?? cleanPartner,
    isKnownInDirectory: dirEntry !== undefined || standing !== undefined,
    department: dirEntry?.department ?? standing?.department ?? "ENSEIRB",
    promoYear: dirEntry?.promoYear ?? standing?.promoYear ?? "2A",
    playStyle: dirEntry?.playStyle ?? standing?.playStyle ?? "Joueur ENSEIRB",
    favoriteAnnouncement: dirEntry?.favoriteAnnouncement ?? "Coinche ×2",
    addedByPseudo: dirEntry?.addedByPseudo ?? standing?.addedByPseudo ?? null,
    overallGames,
    overallWins,
    overallLosses,
    overallWinRatePercent: overallWinRate,
    overallNetBalance: overallNet,
    overallCapots,
    overallGenerales,
    gamesTogether,
    winsTogether,
    lossesTogether,
    winRateTogetherPercent,
    netPointsTogether,
    capotsTogether,
    generalesTogether,
    chemistryLabel,
    chemistryTone,
    gamesAgainst,
    myWinsAgainst,
    myLossesAgainst,
  };
}
