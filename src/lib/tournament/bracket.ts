import type { MatchPhase } from "@/types/database";
import { DEFAULT_TARGET_SCORES } from "@/lib/tournament/scoring";
import type {
  GeneratedBracketNode,
  KnockoutFormatDecision,
  QualifiedTeamSeed,
  TargetScoreConfig,
} from "@/lib/tournament/types";

/**
 * Genere l'ordre standard replie des tetes de serie d'un tableau (ex: 16 -> [1,16, 8,9, 5,12, 4,13, 3,14, 6,11, 7,10, 2,15])
 * afin que les tetes de serie #1 et #2 ne puissent se croiser qu'en Finale.
 */
export function buildFoldedBracketPairs(
  bracketSize: 2 | 4 | 8 | 16,
): Array<[number, number]> {
  let seeds = [1, 2];

  while (seeds.length < bracketSize) {
    const nextSize = seeds.length * 2;
    const expanded: number[] = [];
    for (const s of seeds) {
      expanded.push(s);
      expanded.push(nextSize + 1 - s);
    }
    seeds = expanded;
  }

  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < seeds.length; i += 2) {
    const sA = seeds[i];
    const sB = seeds[i + 1];
    if (sA !== undefined && sB !== undefined) {
      pairs.push([sA, sB]);
    }
  }
  return pairs;
}

function getOrderedPhasesFrom(
  startingPhase: Exclude<MatchPhase, "pool">,
): Array<Exclude<MatchPhase, "pool">> {
  const allPhases: Array<Exclude<MatchPhase, "pool">> = [
    "round_of_16",
    "quarterfinals",
    "semifinals",
    "final",
  ];
  const startIndex = allPhases.indexOf(startingPhase);
  return allPhases.slice(startIndex);
}

/**
 * Construit l'arbre complet de la phase finale (Huitiemes -> Quarts -> Demies -> Finale)
 * avec chainage `nextMatchTempId`, scores cibles (500 / 600 / 700 / 1000), numeros de tables
 * et avancement automatique des exempts (`bye`) lorsque 13 <= N <= 15 en Huitiemes.
 */
export function generateKnockoutBracket(params: {
  format: KnockoutFormatDecision;
  qualifiedTeams: QualifiedTeamSeed[];
  targetScores?: Partial<TargetScoreConfig>;
  startingTableNumber?: number;
}): GeneratedBracketNode[] {
  const { format, qualifiedTeams } = params;
  const targets: TargetScoreConfig = {
    round_of_16:
      params.targetScores?.round_of_16 ?? DEFAULT_TARGET_SCORES.round_of_16,
    quarterfinals:
      params.targetScores?.quarterfinals ?? DEFAULT_TARGET_SCORES.quarterfinals,
    semifinals:
      params.targetScores?.semifinals ?? DEFAULT_TARGET_SCORES.semifinals,
    final: params.targetScores?.final ?? DEFAULT_TARGET_SCORES.final,
  };

  let nextTable = 1;
  if (params.startingTableNumber !== undefined) {
    nextTable = params.startingTableNumber;
  }

  const seedMap = new Map<number, QualifiedTeamSeed>();
  for (const team of qualifiedTeams) {
    if (team.bracketSeed !== null) {
      seedMap.set(team.bracketSeed, team);
    }
  }

  const phases = getOrderedPhasesFrom(format.startingPhase);
  const phaseNodesMap = new Map<
    Exclude<MatchPhase, "pool">,
    GeneratedBracketNode[]
  >();

  let currentMatchCount = format.bracketSize / 2;

  for (let pIdx = 0; pIdx < phases.length; pIdx += 1) {
    const phase = phases[pIdx];
    if (phase === undefined) {
      continue;
    }

    const nodes: GeneratedBracketNode[] = [];
    for (let slot = 1; slot <= currentMatchCount; slot += 1) {
      nodes.push({
        tempId: `${phase}_${slot}`,
        phase,
        roundNumber: pIdx + 1,
        bracketSlot: slot,
        tableNumber: null,
        targetScore: targets[phase],
        teamAId: null,
        teamBId: null,
        seedA: null,
        seedB: null,
        status: "pending",
        winnerTeamId: null,
        nextMatchTempId: null,
        nextMatchSlot: null,
      });
    }

    phaseNodesMap.set(phase, nodes);
    currentMatchCount = Math.floor(currentMatchCount / 2);
  }

  // Chainage de chaque tour vers le tour suivant
  for (let pIdx = 0; pIdx < phases.length - 1; pIdx += 1) {
    const currentPhase = phases[pIdx];
    const nextPhase = phases[pIdx + 1];
    if (currentPhase === undefined || nextPhase === undefined) {
      continue;
    }

    const currentNodes = phaseNodesMap.get(currentPhase) ?? [];
    const nextNodes = phaseNodesMap.get(nextPhase) ?? [];

    for (let i = 0; i < currentNodes.length; i += 1) {
      const node = currentNodes[i];
      const targetNextNode = nextNodes[Math.floor(i / 2)];
      if (node === undefined || targetNextNode === undefined) {
        continue;
      }

      node.nextMatchTempId = targetNextNode.tempId;
      if (i % 2 === 0) {
        node.nextMatchSlot = "team_a";
      } else {
        node.nextMatchSlot = "team_b";
      }
    }
  }

  // Placement initial dans le premier tour (ex: Huitiemes de finale)
  const firstPhase = phases[0];
  if (firstPhase !== undefined) {
    const firstNodes = phaseNodesMap.get(firstPhase) ?? [];
    const pairs = buildFoldedBracketPairs(format.bracketSize);
    const secondPhase = phases[1];
    let secondNodes: GeneratedBracketNode[] = [];
    if (secondPhase !== undefined) {
      secondNodes = phaseNodesMap.get(secondPhase) ?? [];
    }

    for (let i = 0; i < firstNodes.length; i += 1) {
      const node = firstNodes[i];
      const pair = pairs[i];
      if (node === undefined || pair === undefined) {
        continue;
      }

      const seedA = pair[0];
      const seedB = pair[1];
      const teamA = seedMap.get(seedA) ?? null;
      const teamB = seedMap.get(seedB) ?? null;

      node.seedA = seedA;
      node.seedB = seedB;

      if (teamA !== null) {
        node.teamAId = teamA.teamId;
      }
      if (teamB !== null) {
        node.teamBId = teamB.teamId;
      }

      // Gestion des exempts (ex: 13, 14 ou 15 equipes qualifiees en Huitiemes de finale)
      if (teamA !== null && teamB === null) {
        node.status = "bye";
        node.winnerTeamId = teamA.teamId;
        const nextNode = secondNodes[Math.floor(i / 2)];
        if (nextNode !== undefined) {
          if (node.nextMatchSlot === "team_a") {
            nextNode.teamAId = teamA.teamId;
          } else if (node.nextMatchSlot === "team_b") {
            nextNode.teamBId = teamA.teamId;
          }
        }
      } else if (teamA === null && teamB !== null) {
        node.status = "bye";
        node.winnerTeamId = teamB.teamId;
        const nextNode = secondNodes[Math.floor(i / 2)];
        if (nextNode !== undefined) {
          if (node.nextMatchSlot === "team_a") {
            nextNode.teamAId = teamB.teamId;
          } else if (node.nextMatchSlot === "team_b") {
            nextNode.teamBId = teamB.teamId;
          }
        }
      } else if (teamA !== null && teamB !== null) {
        node.tableNumber = nextTable;
        nextTable += 1;
      }
    }
  }

  const allNodes: GeneratedBracketNode[] = [];
  for (const phase of phases) {
    const nodes = phaseNodesMap.get(phase) ?? [];
    allNodes.push(...nodes);
  }

  return allNodes;
}
