import type {
  GeneratedPool,
  GeneratedPoolMatch,
  PoolGenerationPlan,
  TournamentTeamInput,
} from "@/lib/tournament/types";

const DEFAULT_DEALS_PER_MATCH = 5;
const DEFAULT_START_TIME_LABEL = "18h30";

/**
 * Calcule la meilleure repartition deterministe de poules pour tout nombre d'equipes N >= 4
 * (pair ou impair) :
 * - Pour N = 4 : [4] (1 poule de 4)
 * - Pour N = 5 : [5] (1 poule de 5, car [3, 2] creerait une poule de 2)
 * - Pour N >= 6 : P = ceil(N / 4) poules equilibrees de taille 4 et 3 (ecart max de 1).
 *   * N = 20 -> 5 poules de 4 ([4, 4, 4, 4, 4])
 *   * N = 19 -> 4 poules de 4 + 1 poule de 3 ([4, 4, 4, 4, 3])
 *   * N = 21 -> 3 poules de 4 + 3 poules de 3 ([4, 4, 4, 3, 3, 3])
 *   Avantage terrain majeur : chaque poule se joue en exactement 3 tours pour tout N >= 6.
 */
export function computeOptimalPoolSizes(teamCount: number): number[] {
  if (!Number.isInteger(teamCount) || teamCount < 4) {
    throw new Error(
      "Au moins 4 equipes presentes au check-in sont requises pour generer les poules.",
    );
  }

  if (teamCount === 4) {
    return [4];
  }

  if (teamCount === 5) {
    return [5];
  }

  const poolCount = Math.ceil(teamCount / 4);
  const baseSize = Math.floor(teamCount / poolCount);
  const remainder = teamCount % poolCount;

  const sizes: number[] = [];
  for (let i = 0; i < poolCount; i += 1) {
    if (i < remainder) {
      sizes.push(baseSize + 1);
    } else {
      sizes.push(baseSize);
    }
  }

  return sizes;
}

/**
 * Convertit un indice de poule (1..N) en libelle lisible (Poule A .. Poule Z, puis Poule AA...).
 */
export function formatPoolLabel(poolNumber: number): string {
  let n = poolNumber;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return `Poule ${letters}`;
}

/**
 * Genere le calendrier round-robin deterministe (methode du cercle de Berger)
 * pour une poule de taille paire ou impaire.
 * En cas d'effectif impair (ex: poule de 3 ou 5), un exempt virtuel (-1) est insere
 * pour garantir qu'aucune equipe ne joue deux fois dans le meme tour.
 */
export function generateRoundRobinPairings(
  poolSize: number,
): Array<{ roundNumber: number; matches: Array<[number, number]> }> {
  const slots: number[] = [];
  for (let i = 0; i < poolSize; i += 1) {
    slots.push(i);
  }

  if (poolSize % 2 !== 0) {
    slots.push(-1);
  }

  const totalSlots = slots.length;
  const totalRounds = totalSlots - 1;
  const matchesPerRound = totalSlots / 2;
  const schedule: Array<{ roundNumber: number; matches: Array<[number, number]> }> = [];

  const rotating = [...slots];

  for (let round = 0; round < totalRounds; round += 1) {
    const roundMatches: Array<[number, number]> = [];

    for (let m = 0; m < matchesPerRound; m += 1) {
      const home = rotating[m];
      const away = rotating[totalSlots - 1 - m];

      if (
        home !== undefined &&
        away !== undefined &&
        home !== -1 &&
        away !== -1
      ) {
        if (home < away) {
          roundMatches.push([home, away]);
        } else {
          roundMatches.push([away, home]);
        }
      }
    }

    schedule.push({
      roundNumber: round + 1,
      matches: roundMatches,
    });

    // Rotation horaire en gardant le premier element fixe
    const fixedFirst = rotating[0];
    const lastElement = rotating[totalSlots - 1];
    if (fixedFirst !== undefined && lastElement !== undefined) {
      const middle = rotating.slice(1, totalSlots - 1);
      rotating.splice(0, rotating.length, fixedFirst, lastElement, ...middle);
    }
  }

  return schedule;
}

/**
 * Trie les equipes actives de maniere strictement deterministe avant la repartition en serpentin.
 */
function sortActiveTeamsDeterministically(
  teams: TournamentTeamInput[],
): TournamentTeamInput[] {
  return [...teams].sort((a, b) => {
    if (a.seedOrder !== null && b.seedOrder !== null && a.seedOrder !== b.seedOrder) {
      return a.seedOrder - b.seedOrder;
    }
    if (a.seedOrder !== null && b.seedOrder === null) {
      return -1;
    }
    if (a.seedOrder === null && b.seedOrder !== null) {
      return 1;
    }
    const nameCmp = a.normalizedName.localeCompare(b.normalizedName, "fr");
    if (nameCmp !== 0) {
      return nameCmp;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Genere les poules, repartit les equipes validees au check-in en serpentin deterministe
 * et assigne automatiquement les numeros de tables (rythme libre a partir de 18h30).
 */
export function generatePoolsAndSchedule(
  allTeams: TournamentTeamInput[],
  options?: {
    dealsPerMatch?: number;
    startsAtTimeLabel?: string;
    startingTableNumber?: number;
  },
): PoolGenerationPlan {
  const activeTeams = allTeams.filter(
    (team) => team.checkedIn && !team.isForfeit,
  );
  const sortedTeams = sortActiveTeamsDeterministically(activeTeams);
  const poolSizes = computeOptimalPoolSizes(sortedTeams.length);
  const poolCount = poolSizes.length;

  let dealsPerMatch = DEFAULT_DEALS_PER_MATCH;
  if (options?.dealsPerMatch !== undefined) {
    dealsPerMatch = options.dealsPerMatch;
  }

  let startsAtTimeLabel = DEFAULT_START_TIME_LABEL;
  if (options?.startsAtTimeLabel !== undefined) {
    startsAtTimeLabel = options.startsAtTimeLabel;
  }

  let nextTableNumber = 1;
  if (options?.startingTableNumber !== undefined) {
    nextTableNumber = options.startingTableNumber;
  }

  const bucketedTeams: TournamentTeamInput[][] = poolSizes.map(() => []);

  // Distribution en serpentin (0..P-1 puis P-1..0) en respectant la capacite exacte de chaque poule
  let teamIdx = 0;
  let passNumber = 0;

  while (teamIdx < sortedTeams.length) {
    const indices: number[] = [];
    if (passNumber % 2 === 0) {
      for (let p = 0; p < poolCount; p += 1) {
        indices.push(p);
      }
    } else {
      for (let p = poolCount - 1; p >= 0; p -= 1) {
        indices.push(p);
      }
    }

    for (const poolIdx of indices) {
      if (teamIdx >= sortedTeams.length) {
        break;
      }
      const bucket = bucketedTeams[poolIdx];
      const targetSize = poolSizes[poolIdx];
      const currentTeam = sortedTeams[teamIdx];

      if (
        bucket !== undefined &&
        targetSize !== undefined &&
        currentTeam !== undefined &&
        bucket.length < targetSize
      ) {
        bucket.push(currentTeam);
        teamIdx += 1;
      }
    }

    passNumber += 1;
  }

  const pools: GeneratedPool[] = [];
  const matches: GeneratedPoolMatch[] = [];

  for (let p = 0; p < poolCount; p += 1) {
    const poolNumber = p + 1;
    const bucket = bucketedTeams[p] ?? [];
    const size = bucket.length;
    const simultaneousTables = Math.max(1, Math.floor(size / 2));
    const assignedTableStart = nextTableNumber;
    nextTableNumber += simultaneousTables;

    pools.push({
      poolNumber,
      poolLabel: formatPoolLabel(poolNumber),
      size,
      assignedTableStart,
      assignedTableCount: simultaneousTables,
      teams: bucket.map((team, idx) => ({
        teamId: team.id,
        teamName: team.teamName,
        positionInPool: idx + 1,
      })),
    });

    const roundSchedule = generateRoundRobinPairings(size);
    for (const round of roundSchedule) {
      for (let matchOffset = 0; matchOffset < round.matches.length; matchOffset += 1) {
        const pair = round.matches[matchOffset];
        if (pair === undefined) {
          continue;
        }
        const teamA = bucket[pair[0]];
        const teamB = bucket[pair[1]];
        if (teamA === undefined || teamB === undefined) {
          continue;
        }

        matches.push({
          poolNumber,
          roundNumber: round.roundNumber,
          tableNumber: assignedTableStart + matchOffset,
          teamAId: teamA.id,
          teamBId: teamB.id,
          maxDeals: dealsPerMatch,
        });
      }
    }
  }

  return {
    startsAtTimeLabel,
    totalActiveTeams: sortedTeams.length,
    pools,
    matches,
  };
}
