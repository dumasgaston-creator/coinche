import type { MatchPhase } from "@/types/database";
import type {
  BidMultiplierType,
  CoincheDealCalculationInput,
  CoincheDealCalculationResult,
  TargetScoreConfig,
} from "@/lib/tournament/types";

/** Valeurs officielles des cartes en Tout Atout (Coinch'Eirb) */
export const TOUT_ATOUT_VALUES: Readonly<Record<string, number>> = {
  Valet: 14,
  "9": 9,
  As: 6,
  "10": 5,
  Roi: 3,
  Dame: 1,
  "8": 0,
  "7": 0,
};

/** Valeurs officielles des cartes en Sans Atout (Coinch'Eirb) */
export const SANS_ATOUT_VALUES: Readonly<Record<string, number>> = {
  As: 19,
  "10": 10,
  Roi: 4,
  Dame: 3,
  Valet: 2,
  "9": 0,
  "8": 0,
  "7": 0,
};

export const DEFAULT_TARGET_SCORES: Readonly<TargetScoreConfig> = {
  round_of_16: 500,
  quarterfinals: 600,
  semifinals: 700,
  final: 1000,
};

export const FALL_PENALTY_POINTS = 160;
export const PARLANTE_PENALTY_POINTS = 160;
export const CAPOT_ANNOUNCED_POINTS = 250;
export const GENERALE_ANNOUNCED_POINTS = 500;
export const BELOTE_REDUCTION_POINTS = 20;
export const BELOTE_MIN_CONTRACT_THRESHOLD = 100;

export function resolveBidMultiplier(multiplier: BidMultiplierType): 1 | 2 | 4 {
  if (multiplier === "coinche") {
    return 2;
  }
  if (multiplier === "surcoinche") {
    return 4;
  }
  return 1;
}

/**
 * Regle officielle Coinch'Eirb sur la Belote :
 * La belote vaut 20 pts et fait baisser le contrat requis UNIQUEMENT a partir d'une annonce de 100
 * (ex: contrat 100 + belote -> 80 pts de plis requis ; contrat 90 + belote -> 90 pts requis).
 * Elle reste hors points marques par le preneur au tableau de score.
 */
export function computeEffectiveContractThreshold(
  contractPoints: number,
  takerHasBelote: boolean,
): number {
  if (takerHasBelote && contractPoints >= BELOTE_MIN_CONTRACT_THRESHOLD) {
    return contractPoints - BELOTE_REDUCTION_POINTS;
  }
  return contractPoints;
}

/**
 * Calcule les points marques sur une donne selon le reglement Coinch'Eirb :
 * - Contrat passe : le preneur marque l'annonce multipliee (x1, x2 coinche, x4 surcoinche), l'adversaire 0.
 *   Capot annonce et fait : 250 pts (x multiplicateur). Generale annoncee et faite : 500 pts (x multiplicateur).
 * - Contrat chute : le preneur marque 0, l'adversaire marque 160 x multiplicateur (ex: coinche chutee = 320).
 * - Parlante : chaque parlante est punie par 160 pts attribues a l'equipe adverse.
 */
export function calculateCoincheDealScore(
  input: CoincheDealCalculationInput,
): CoincheDealCalculationResult {
  const appliedMultiplier = resolveBidMultiplier(input.multiplier);
  let baseAnnouncementPoints = 0;
  let effectiveTrickThreshold: number | null = null;

  if (input.contractKind === "capot") {
    baseAnnouncementPoints = CAPOT_ANNOUNCED_POINTS;
  } else if (input.contractKind === "generale") {
    baseAnnouncementPoints = GENERALE_ANNOUNCED_POINTS;
  } else {
    const rawContract = input.contractPoints ?? 0;
    if (
      !Number.isInteger(rawContract) ||
      rawContract < 80 ||
      rawContract > 180 ||
      rawContract % 10 !== 0
    ) {
      throw new Error(
        "Un contrat classique doit etre compris entre 80 et 180 par paliers de 10.",
      );
    }
    baseAnnouncementPoints = rawContract;
    effectiveTrickThreshold = computeEffectiveContractThreshold(
      rawContract,
      Boolean(input.takerHasBelote),
    );
  }

  let takerPoints = 0;
  let defenderPoints = 0;

  if (input.passed) {
    takerPoints = baseAnnouncementPoints * appliedMultiplier;
    defenderPoints = 0;
  } else {
    takerPoints = 0;
    defenderPoints = FALL_PENALTY_POINTS * appliedMultiplier;
  }

  const parlantesAgainstTaker = Math.max(
    0,
    Math.trunc(input.parlanteCountForTakerOpponent ?? 0),
  );
  const parlantesForTaker = Math.max(
    0,
    Math.trunc(input.parlanteCountForTaker ?? 0),
  );

  defenderPoints += parlantesAgainstTaker * PARLANTE_PENALTY_POINTS;
  takerPoints += parlantesForTaker * PARLANTE_PENALTY_POINTS;

  if (input.takerSide === "team_a") {
    return {
      pointsTeamA: takerPoints,
      pointsTeamB: defenderPoints,
      effectiveTrickThreshold,
      appliedMultiplier,
    };
  }

  return {
    pointsTeamA: defenderPoints,
    pointsTeamB: takerPoints,
    effectiveTrickThreshold,
    appliedMultiplier,
  };
}

export interface MatchProgressEvaluation {
  status: "pending" | "in_progress" | "completed";
  winnerSide: "team_a" | "team_b" | null;
  requiresTiebreakerDeal: boolean;
}

/**
 * Determine l'etat d'avancement d'un match :
 * - En poule : 5 donnes reglementaires, plus une 6e donne obligatoire (et suivantes si egalite maintenue)
 *   tant que les deux equipes sont a egalite apres 5 donnes.
 * - En phase finale : premier au score cible (8es: 500, Quarts: 600, Demies: 700, Finale: 1000) sans egalite.
 */
export function evaluateMatchProgress(params: {
  phase: MatchPhase;
  scoreTeamA: number;
  scoreTeamB: number;
  dealsPlayed: number;
  dealsPerPoolMatch?: number;
  targetScore?: number | null;
  isDirectFinalScore?: boolean;
}): MatchProgressEvaluation {
  const { scoreTeamA, scoreTeamB, dealsPlayed } = params;
  const directMode = Boolean(params.isDirectFinalScore);

  if (!directMode && dealsPlayed === 0 && scoreTeamA === 0 && scoreTeamB === 0) {
    return {
      status: "pending",
      winnerSide: null,
      requiresTiebreakerDeal: false,
    };
  }

  if (directMode) {
    if (scoreTeamA === scoreTeamB) {
      throw new Error(
        "Un score final direct ne peut pas etre une egalite : jouez une donne de departage.",
      );
    }
    if (scoreTeamA > scoreTeamB) {
      return {
        status: "completed",
        winnerSide: "team_a",
        requiresTiebreakerDeal: false,
      };
    }
    return {
      status: "completed",
      winnerSide: "team_b",
      requiresTiebreakerDeal: false,
    };
  }

  if (params.phase === "pool") {
    let standardDeals = 5;
    if (params.dealsPerPoolMatch !== undefined) {
      standardDeals = params.dealsPerPoolMatch;
    }

    if (dealsPlayed < standardDeals) {
      return {
        status: "in_progress",
        winnerSide: null,
        requiresTiebreakerDeal: false,
      };
    }

    // Egalite apres la 5e donne : passage obligatoire a la 6e donne de departage
    if (scoreTeamA === scoreTeamB) {
      return {
        status: "in_progress",
        winnerSide: null,
        requiresTiebreakerDeal: true,
      };
    }

    if (scoreTeamA > scoreTeamB) {
      return {
        status: "completed",
        winnerSide: "team_a",
        requiresTiebreakerDeal: false,
      };
    }

    return {
      status: "completed",
      winnerSide: "team_b",
      requiresTiebreakerDeal: false,
    };
  }

  // Phases finales : objectif de points (500 / 600 / 700 / 1000)
  let target = DEFAULT_TARGET_SCORES[params.phase];
  if (params.targetScore !== undefined && params.targetScore !== null) {
    target = params.targetScore;
  }

  const reachedTarget = scoreTeamA >= target || scoreTeamB >= target;
  if (!reachedTarget) {
    return {
      status: "in_progress",
      winnerSide: null,
      requiresTiebreakerDeal: false,
    };
  }

  if (scoreTeamA === scoreTeamB) {
    return {
      status: "in_progress",
      winnerSide: null,
      requiresTiebreakerDeal: true,
    };
  }

  if (scoreTeamA > scoreTeamB) {
    return {
      status: "completed",
      winnerSide: "team_a",
      requiresTiebreakerDeal: false,
    };
  }

  return {
    status: "completed",
    winnerSide: "team_b",
    requiresTiebreakerDeal: false,
  };
}
