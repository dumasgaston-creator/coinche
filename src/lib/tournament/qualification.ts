import { computeOptimalPoolSizes } from "@/lib/tournament/pool-generator";
import type {
  CompletedPoolMatchInput,
  GeneratedPool,
  KnockoutFormatDecision,
  PoolStandingSummary,
  QualificationOutcome,
  QualifiedTeamSeed,
  RankedPoolTeam,
  TournamentTeamInput,
} from "@/lib/tournament/types";

export const DEFAULT_ROUND_OF_16_THRESHOLD = 12;

/**
 * Regle du seuil des Huitiemes (12 equipes par defaut) :
 * - Au-dela strictement du seuil (`activeTeamCount > roundOf16Threshold`, donc des 13 equipes par defaut),
 *   le tournoi passe OBLIGATOIREMENT par les Huitiemes de finale (arbre de 16 places, avec exempts
 *   automatiques au 1er tour si 13..15 equipes), sans jamais sauter directement en Quarts.
 * - En dessous ou egal au seuil (`<= 12`), passage en Quarts (8), Demies (4) ou Finale (2).
 */
export function determineKnockoutFormat(
  activeTeamCount: number,
  roundOf16Threshold: number = DEFAULT_ROUND_OF_16_THRESHOLD,
): KnockoutFormatDecision {
  if (activeTeamCount < 2) {
    throw new Error(
      "Au moins 2 equipes non forfaits sont necessaires pour generer la phase finale.",
    );
  }

  if (activeTeamCount > roundOf16Threshold) {
    return {
      startingPhase: "round_of_16",
      bracketSize: 16,
      qualifierCount: Math.min(16, activeTeamCount),
    };
  }

  if (activeTeamCount >= 8) {
    return {
      startingPhase: "quarterfinals",
      bracketSize: 8,
      qualifierCount: 8,
    };
  }

  if (activeTeamCount >= 4) {
    return {
      startingPhase: "semifinals",
      bracketSize: 4,
      qualifierCount: 4,
    };
  }

  return {
    startingPhase: "final",
    bracketSize: 2,
    qualifierCount: 2,
  };
}

function findHeadToHeadWinner(
  teamAId: string,
  teamBId: string,
  poolMatches: CompletedPoolMatchInput[],
): string | null {
  for (const match of poolMatches) {
    const isDirectPair =
      (match.teamAId === teamAId && match.teamBId === teamBId) ||
      (match.teamAId === teamBId && match.teamBId === teamAId);

    if (
      isDirectPair &&
      (match.status === "completed" || match.status === "forfeit") &&
      match.winnerTeamId !== null
    ) {
      return match.winnerTeamId;
    }
  }
  return null;
}

/**
 * Calcule le classement interne de chaque poule ainsi que la force totale de chaque poule
 * (`poolTotalPoints` = somme cumulee de tous les points marques dans la poule).
 *
 * Ordre de tri intra-poule :
 * 1. Equipe active devant equipe forfait
 * 2. Nombre de victoires (`matchesWon`) decroissant
 * 3. Goal-average = total des points marques (`pointsScored`) decroissant
 * 4. Confrontation directe si egalite entre deux equipes
 * 5. Difference de points (`pointsDiff`) puis ordre initial deterministe
 */
export function computePoolStandings(
  pools: GeneratedPool[],
  teams: TournamentTeamInput[],
  matches: CompletedPoolMatchInput[],
): PoolStandingSummary[] {
  const teamById = new Map<string, TournamentTeamInput>();
  for (const team of teams) {
    teamById.set(team.id, team);
  }

  const summaries: PoolStandingSummary[] = [];

  for (const pool of pools) {
    const poolMatches = matches.filter((m) => m.poolNumber === pool.poolNumber);
    const statsMap = new Map<
      string,
      {
        played: number;
        won: number;
        lost: number;
        scored: number;
        conceded: number;
      }
    >();

    for (const member of pool.teams) {
      statsMap.set(member.teamId, {
        played: 0,
        won: 0,
        lost: 0,
        scored: 0,
        conceded: 0,
      });
    }

    let poolTotalPoints = 0;

    for (const match of poolMatches) {
      if (match.status !== "completed" && match.status !== "forfeit") {
        continue;
      }

      const statsA = statsMap.get(match.teamAId);
      const statsB = statsMap.get(match.teamBId);
      if (statsA === undefined || statsB === undefined) {
        continue;
      }

      statsA.played += 1;
      statsB.played += 1;
      statsA.scored += match.scoreTeamA;
      statsA.conceded += match.scoreTeamB;
      statsB.scored += match.scoreTeamB;
      statsB.conceded += match.scoreTeamA;

      poolTotalPoints += match.scoreTeamA + match.scoreTeamB;

      if (match.winnerTeamId === match.teamAId) {
        statsA.won += 1;
        statsB.lost += 1;
      } else if (match.winnerTeamId === match.teamBId) {
        statsB.won += 1;
        statsA.lost += 1;
      } else if (match.scoreTeamA > match.scoreTeamB) {
        statsA.won += 1;
        statsB.lost += 1;
      } else if (match.scoreTeamB > match.scoreTeamA) {
        statsB.won += 1;
        statsA.lost += 1;
      }
    }

    const unranked: RankedPoolTeam[] = pool.teams.map((member) => {
      const st = statsMap.get(member.teamId) ?? {
        played: 0,
        won: 0,
        lost: 0,
        scored: 0,
        conceded: 0,
      };
      const meta = teamById.get(member.teamId);
      let isForfeit = false;
      let seedOrder: number | null = null;
      if (meta !== undefined) {
        isForfeit = meta.isForfeit;
        seedOrder = meta.seedOrder;
      }

      return {
        teamId: member.teamId,
        teamName: member.teamName,
        poolNumber: pool.poolNumber,
        poolLabel: pool.poolLabel,
        positionInPool: member.positionInPool,
        seedOrder,
        isForfeit,
        matchesPlayed: st.played,
        matchesWon: st.won,
        matchesLost: st.lost,
        pointsScored: st.scored,
        pointsConceded: st.conceded,
        pointsDiff: st.scored - st.conceded,
        poolTotalPoints,
        poolRank: 0,
      };
    });

    unranked.sort((a, b) => {
      if (a.isForfeit !== b.isForfeit) {
        if (a.isForfeit) {
          return 1;
        }
        return -1;
      }
      if (b.matchesWon !== a.matchesWon) {
        return b.matchesWon - a.matchesWon;
      }
      if (b.pointsScored !== a.pointsScored) {
        return b.pointsScored - a.pointsScored;
      }
      const h2hWinner = findHeadToHeadWinner(a.teamId, b.teamId, poolMatches);
      if (h2hWinner === a.teamId) {
        return -1;
      }
      if (h2hWinner === b.teamId) {
        return 1;
      }
      if (b.pointsDiff !== a.pointsDiff) {
        return b.pointsDiff - a.pointsDiff;
      }
      return a.positionInPool - b.positionInPool;
    });

    const standings: RankedPoolTeam[] = unranked.map((entry, idx) => ({
      ...entry,
      poolRank: idx + 1,
    }));

    summaries.push({
      poolNumber: pool.poolNumber,
      poolLabel: pool.poolLabel,
      poolTotalPoints,
      standings,
    });
  }

  return summaries;
}

/**
 * Comparateur inter-poules officiel Coinch'Eirb (utilise pour les meilleurs 4es / wildcards
 * et l'attribution des tetes de serie) :
 * 1. Equipe non forfait devant forfait
 * 2. Nombre de victoires decroissant
 * 3. Goal-average : nombre total de points marques decroissant (`pointsScored`)
 * 4. Egalite parfaite : avantage automatique a l'equipe issue de la POULE LA PLUS FORTE,
 *    c'est-a-dire celle ayant cumule le plus de points (`poolTotalPoints`)
 * 5. Repli deterministe : difference de points, ordre initial, identifiant.
 */
export function compareTeamsAcrossPools(
  a: RankedPoolTeam,
  b: RankedPoolTeam,
): number {
  if (a.isForfeit !== b.isForfeit) {
    if (a.isForfeit) {
      return 1;
    }
    return -1;
  }

  if (b.matchesWon !== a.matchesWon) {
    return b.matchesWon - a.matchesWon;
  }

  if (b.pointsScored !== a.pointsScored) {
    return b.pointsScored - a.pointsScored;
  }

  if (b.poolTotalPoints !== a.poolTotalPoints) {
    return b.poolTotalPoints - a.poolTotalPoints;
  }

  if (b.pointsDiff !== a.pointsDiff) {
    return b.pointsDiff - a.pointsDiff;
  }

  if (a.seedOrder !== null && b.seedOrder !== null && a.seedOrder !== b.seedOrder) {
    return a.seedOrder - b.seedOrder;
  }

  if (a.poolNumber !== b.poolNumber) {
    return a.poolNumber - b.poolNumber;
  }

  return a.teamId.localeCompare(b.teamId);
}

/**
 * Selectionne les equipes qualifiees et eliminees a l'issue des poules (sans mini-consolante).
 *
 * Exemple canonique a 20 equipes (5 poules de 4, seuil 12) :
 * - Format : Huitiemes de finale obligatoires (16 qualifiees)
 * - Rangs 1, 2 et 3 des 5 poules = 15 qualifiees directes (`direct_top_n`)
 * - Rang 4 : le meilleur 4e selon `compareTeamsAcrossPools` = 16e qualifiee (`best_wildcards`),
 *   les 4 autres 4es sont eliminees (`eliminated`).
 */
export function resolvePoolQualifications(
  poolStandings: PoolStandingSummary[],
  roundOf16Threshold: number = DEFAULT_ROUND_OF_16_THRESHOLD,
): QualificationOutcome {
  const allTeams: RankedPoolTeam[] = [];
  let maxRank = 0;

  for (const pool of poolStandings) {
    for (const entry of pool.standings) {
      allTeams.push(entry);
      if (entry.poolRank > maxRank) {
        maxRank = entry.poolRank;
      }
    }
  }

  const nonForfeitCount = allTeams.filter((t) => !t.isForfeit).length;
  const format = determineKnockoutFormat(nonForfeitCount, roundOf16Threshold);

  const qualifiedSeeds: QualifiedTeamSeed[] = [];
  const eliminatedSeeds: QualifiedTeamSeed[] = [];
  let wildcardRank: number | null = null;
  let wildcardCandidatesRanked: QualifiedTeamSeed[] = [];

  for (let rank = 1; rank <= maxRank; rank += 1) {
    const tierTeams = allTeams.filter((t) => t.poolRank === rank);
    const activeTier = tierTeams
      .filter((t) => !t.isForfeit)
      .sort(compareTeamsAcrossPools);
    const forfeitTier = tierTeams.filter((t) => t.isForfeit);

    for (const forfeited of forfeitTier) {
      eliminatedSeeds.push({
        ...forfeited,
        qualified: false,
        qualificationReason: "forfeit",
        bracketSeed: null,
      });
    }

    const remainingSlots = format.qualifierCount - qualifiedSeeds.length;

    if (remainingSlots <= 0) {
      for (const team of activeTier) {
        eliminatedSeeds.push({
          ...team,
          qualified: false,
          qualificationReason: "eliminated",
          bracketSeed: null,
        });
      }
    } else if (activeTier.length <= remainingSlots) {
      for (const team of activeTier) {
        qualifiedSeeds.push({
          ...team,
          qualified: true,
          qualificationReason: "direct_top_n",
          bracketSeed: qualifiedSeeds.length + 1,
        });
      }
    } else {
      // Ce rang est le rang charniere des meilleurs N-iemes (ex: meilleur 4e pour 20 equipes)
      wildcardRank = rank;
      const tierSnapshot: QualifiedTeamSeed[] = [];

      for (let i = 0; i < activeTier.length; i += 1) {
        const candidate = activeTier[i];
        if (candidate === undefined) {
          continue;
        }
        if (i < remainingSlots) {
          const seedNumber = qualifiedSeeds.length + 1;
          const qualifiedEntry: QualifiedTeamSeed = {
            ...candidate,
            qualified: true,
            qualificationReason: "best_wildcards",
            bracketSeed: seedNumber,
          };
          qualifiedSeeds.push(qualifiedEntry);
          tierSnapshot.push(qualifiedEntry);
        } else {
          const eliminatedEntry: QualifiedTeamSeed = {
            ...candidate,
            qualified: false,
            qualificationReason: "eliminated",
            bracketSeed: null,
          };
          eliminatedSeeds.push(eliminatedEntry);
          tierSnapshot.push(eliminatedEntry);
        }
      }

      wildcardCandidatesRanked = tierSnapshot;
    }
  }

  return {
    format,
    pools: poolStandings,
    qualifiedTeams: qualifiedSeeds,
    eliminatedTeams: eliminatedSeeds,
    wildcardRank,
    wildcardCandidatesRanked,
  };
}

export interface QualificationFormulaSummary {
  poolCount: number;
  poolSizes: number[];
  directTopRank: number;
  wildcardRank: number | null;
  wildcardCount: number;
  qualifierCount: number;
  startingPhaseLabel: string;
  shortLabel: string;
}

/**
 * Calcule et decrit dynamiquement la formule de poules et de qualification
 * pour N'IMPORTE QUEL nombre d'equipes N >= 4 (ex. 20, 22, 24, 28, 32...),
 * en garantissant un plafond aux Huitiemes (16 places max) avec selection
 * automatique des meilleurs 3es ou meilleurs 4es selon l'effectif.
 */
export function describeQualificationFormula(
  teamCount: number,
  roundOf16Threshold: number = DEFAULT_ROUND_OF_16_THRESHOLD,
): QualificationFormulaSummary | null {
  if (!Number.isInteger(teamCount) || teamCount < 4) {
    return null;
  }

  const poolSizes = computeOptimalPoolSizes(teamCount);
  const poolCount = poolSizes.length;
  const format = determineKnockoutFormat(teamCount, roundOf16Threshold);

  let directTopRank = 0;
  let remaining = format.qualifierCount;
  let wildcardRank: number | null = null;
  let wildcardCount = 0;

  const maxPoolSize = Math.max(...poolSizes);
  for (let rank = 1; rank <= maxPoolSize; rank += 1) {
    const teamsAtRank = poolSizes.filter((size) => size >= rank).length;
    if (remaining <= 0) {
      break;
    }
    if (teamsAtRank <= remaining) {
      directTopRank = rank;
      remaining -= teamsAtRank;
    } else {
      wildcardRank = rank;
      wildcardCount = remaining;
      remaining = 0;
      break;
    }
  }

  let startingPhaseLabel = "Huitièmes (16)";
  if (format.startingPhase === "quarterfinals") {
    startingPhaseLabel = "Quarts (8)";
  } else if (format.startingPhase === "semifinals") {
    startingPhaseLabel = "Demies (4)";
  } else if (format.startingPhase === "final") {
    startingPhaseLabel = "Finale (2)";
  }

  let directText = `Top ${directTopRank} par poule`;
  if (directTopRank === 1) {
    directText = "1er de chaque poule";
  }

  let wildcardText = "";
  if (wildcardRank !== null && wildcardCount > 0) {
    if (wildcardCount === 1) {
      wildcardText = ` + 1 meilleur ${wildcardRank}e`;
    } else {
      wildcardText = ` + ${wildcardCount} meilleurs ${wildcardRank}es`;
    }
  }

  const shortLabel = `${poolCount} poules · ${directText}${wildcardText} -> ${startingPhaseLabel}`;

  return {
    poolCount,
    poolSizes,
    directTopRank,
    wildcardRank,
    wildcardCount,
    qualifierCount: format.qualifierCount,
    startingPhaseLabel,
    shortLabel,
  };
}
