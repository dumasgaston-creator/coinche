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

export type PoolDrawMode = "deterministic" | "random" | "seeded_random";

function shuffleArray<T>(
  items: readonly T[],
  randomFn: () => number = Math.random,
): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1));
    const tmp = copy[i];
    const swapVal = copy[j];
    if (tmp !== undefined && swapVal !== undefined) {
      copy[i] = swapVal;
      copy[j] = tmp;
    }
  }
  return copy;
}

function buildPlanFromBuckets(
  bucketedTeams: TournamentTeamInput[][],
  options?: {
    dealsPerMatch?: number;
    startsAtTimeLabel?: string;
    startingTableNumber?: number;
  },
): PoolGenerationPlan {
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

  const nonEmptyBuckets = bucketedTeams.filter((b) => b.length > 0);
  const pools: GeneratedPool[] = [];
  const matches: GeneratedPoolMatch[] = [];
  let totalActiveTeams = 0;

  for (let p = 0; p < nonEmptyBuckets.length; p += 1) {
    const poolNumber = p + 1;
    const bucket = nonEmptyBuckets[p] ?? [];
    const size = bucket.length;
    totalActiveTeams += size;
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

    if (size >= 2) {
      const roundSchedule = generateRoundRobinPairings(size);
      for (const round of roundSchedule) {
        for (
          let matchOffset = 0;
          matchOffset < round.matches.length;
          matchOffset += 1
        ) {
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
  }

  return {
    startsAtTimeLabel,
    totalActiveTeams,
    pools,
    matches,
  };
}

/**
 * Genere les poules selon le mode choisi :
 * - `deterministic` (defaut) : serpentin deterministe par seedOrder
 * - `random` : tirage 100 % aleatoire (Fisher-Yates)
 * - `seeded_random` : place chaque Tete de serie (`seededTeamIds`) dans une poule differente
 *   (position #1 en priorite) et complete aleatoirement avec le reste des equipes.
 */
export function generatePoolsAndSchedule(
  allTeams: TournamentTeamInput[],
  options?: {
    dealsPerMatch?: number;
    startsAtTimeLabel?: string;
    startingTableNumber?: number;
    mode?: PoolDrawMode;
    seededTeamIds?: readonly string[];
    randomFn?: () => number;
  },
): PoolGenerationPlan {
  const activeTeams = allTeams.filter(
    (team) => team.checkedIn && !team.isForfeit,
  );
  const mode: PoolDrawMode = options?.mode ?? "deterministic";
  const randomFn = options?.randomFn ?? Math.random;

  let orderedTeams: TournamentTeamInput[] = [];
  if (mode === "random") {
    orderedTeams = shuffleArray(activeTeams, randomFn);
  } else if (mode === "seeded_random") {
    const seedSet = new Set<string>(options?.seededTeamIds ?? []);
    const seededTeams: TournamentTeamInput[] = [];
    const unseededTeams: TournamentTeamInput[] = [];
    for (const team of activeTeams) {
      if (seedSet.has(team.id)) {
        seededTeams.push(team);
      } else {
        unseededTeams.push(team);
      }
    }
    orderedTeams = [
      ...shuffleArray(seededTeams, randomFn),
      ...shuffleArray(unseededTeams, randomFn),
    ];
  } else {
    orderedTeams = sortActiveTeamsDeterministically(activeTeams);
  }

  const poolSizes = computeOptimalPoolSizes(orderedTeams.length);
  const poolCount = poolSizes.length;
  const bucketedTeams: TournamentTeamInput[][] = poolSizes.map(() => []);

  // Distribution en serpentin (0..P-1 puis P-1..0) :
  // En mode `seeded_random`, les P premieres Tetes de serie tombent exactement en slot 0 de chaque poule.
  let teamIdx = 0;
  let passNumber = 0;

  while (teamIdx < orderedTeams.length) {
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
      if (teamIdx >= orderedTeams.length) {
        break;
      }
      const bucket = bucketedTeams[poolIdx];
      const targetSize = poolSizes[poolIdx];
      const currentTeam = orderedTeams[teamIdx];

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

  return buildPlanFromBuckets(bucketedTeams, options);
}

/**
 * Construit le calendrier complet des matchs et tables a partir de poules
 * composees ou modifiees manuellement par l'administrateur.
 */
export function buildScheduleFromManualPools(
  allTeams: TournamentTeamInput[],
  manualPoolTeamIds: ReadonlyArray<readonly string[]>,
  options?: {
    dealsPerMatch?: number;
    startsAtTimeLabel?: string;
    startingTableNumber?: number;
  },
): PoolGenerationPlan {
  const teamById = new Map<string, TournamentTeamInput>();
  for (const team of allTeams) {
    if (team.checkedIn && !team.isForfeit) {
      teamById.set(team.id, team);
    }
  }

  const seenTeamIds = new Set<string>();
  const bucketedTeams: TournamentTeamInput[][] = [];

  for (const poolIds of manualPoolTeamIds) {
    const bucket: TournamentTeamInput[] = [];
    for (const id of poolIds) {
      if (seenTeamIds.has(id)) {
        continue;
      }
      const found = teamById.get(id);
      if (found !== undefined) {
        seenTeamIds.add(id);
        bucket.push(found);
      }
    }
    if (bucket.length > 0) {
      bucketedTeams.push(bucket);
    }
  }

  // Si des equipes actives n'etaient pas encore assignees, les ajouter dans la poule la moins remplie
  for (const [id, team] of teamById.entries()) {
    if (seenTeamIds.has(id)) {
      continue;
    }
    if (bucketedTeams.length === 0) {
      bucketedTeams.push([team]);
    } else {
      let smallestIdx = 0;
      for (let i = 1; i < bucketedTeams.length; i += 1) {
        const currentLen = bucketedTeams[i]?.length ?? 999;
        const smallestLen = bucketedTeams[smallestIdx]?.length ?? 999;
        if (currentLen < smallestLen) {
          smallestIdx = i;
        }
      }
      bucketedTeams[smallestIdx]?.push(team);
    }
  }

  if (bucketedTeams.length === 0) {
    throw new Error("Aucune poule valide à générer.");
  }

  for (const bucket of bucketedTeams) {
    if (bucket.length < 2) {
      throw new Error(
        "Chaque poule doit contenir au moins 2 équipes pour générer les matchs.",
      );
    }
  }

  return buildPlanFromBuckets(bucketedTeams, options);
}
