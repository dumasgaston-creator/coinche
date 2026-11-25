import {
  computePoolStandings,
  resolvePoolQualifications,
} from "@/lib/tournament/qualification";
import type {
  CompletedPoolMatchInput,
  GeneratedPool,
  QualificationOutcome,
  QualifiedTeamSeed,
  TournamentTeamInput,
} from "@/lib/tournament/types";

export interface TeamBinomeMeta {
  teamId: string;
  teamName: string;
  player1Name: string;
  player2Name: string;
  promotionLabel: string;
  tableNumber: number;
}

export interface KnockoutMatchView {
  id: string;
  phase: "round_of_16" | "quarterfinals" | "semifinals" | "final";
  slot: number;
  tableNumber: number;
  targetScore: 500 | 600 | 700 | 1000;
  seedA: number;
  seedB: number;
  teamAId: string;
  teamAName: string;
  teamABinome: string;
  teamBId: string;
  teamBName: string;
  teamBBinome: string;
  scoreTeamA: number;
  scoreTeamB: number;
  status: "completed" | "in_progress" | "pending";
  winnerTeamId: string | null;
  highlightNote: string | null;
}

export interface AnnualPlayerStanding {
  rank: number;
  profileId: string;
  displayName: string;
  department: "Informatique" | "Électronique" | "Télécoms" | "Matmeca" | "RSI";
  promotionYear: "1A (2028)" | "2A (2027)" | "3A (2026)" | "Alumni";
  schoolYear: "2026-2027" | "2025-2026";
  rankingPoints: number;
  tournamentsPlayed: number;
  tournamentsWon: number;
  matchesPlayed: number;
  matchesWon: number;
  totalPointsScored: number;
  capotsPassed: number;
  generalesPassed: number;
  coinchesPassed: number;
  bestFinishLabel: string;
}

export interface EveningDistinction {
  id: string;
  categoryLabel: string;
  title: string;
  valueLabel: string;
  recipientName: string;
  subLabel: string;
  accentTone: "amber" | "terracotta" | "pass" | "fail";
}

export interface EveningStatsSummary {
  tournamentTitle: string;
  eventDateLabel: string;
  schoolYear: string;
  totalTeams: number;
  qualifiedCount: number;
  eliminatedCount: number;
  totalDealsPlayed: number;
  totalPointsScoredAllMatches: number;
  mostOffensivePoolLabel: string;
  mostOffensivePoolPoints: number;
  highestPoolTeamName: string;
  highestPoolTeamBinome: string;
  highestPoolTeamPoints: number;
  capotsAnnounced: number;
  capotsPassed: number;
  generalesAnnounced: number;
  generalesPassed: number;
  coinchesAnnounced: number;
  coinchesPassed: number;
  surcoinchesAnnounced: number;
  surcoinchesPassed: number;
  parlantesPenalized: number;
  podium: {
    winner: {
      teamName: string;
      binome: string;
      seed: number;
      finalScore: string;
      totalEveningPoints: number;
    };
    finalist: {
      teamName: string;
      binome: string;
      seed: number;
      finalScore: string;
      totalEveningPoints: number;
    };
    semifinalists: Array<{
      teamName: string;
      binome: string;
      seed: number;
      semiScore: string;
      totalEveningPoints: number;
    }>;
  };
  distinctions: EveningDistinction[];
}

export interface ClassementFullDataset {
  tournamentTitle: string;
  eventDateLabel: string;
  schoolYear: string;
  teams: TournamentTeamInput[];
  teamMetaById: Record<string, TeamBinomeMeta>;
  pools: GeneratedPool[];
  poolMatches: CompletedPoolMatchInput[];
  qualification: QualificationOutcome;
  qualifiedLookup: Record<string, QualifiedTeamSeed>;
  knockoutMatches: KnockoutMatchView[];
  annualPlayers: AnnualPlayerStanding[];
  eveningStats: EveningStatsSummary;
}

const RAW_TEAMS: Array<{
  id: string;
  teamName: string;
  player1Name: string;
  player2Name: string;
  promotionLabel: string;
  poolNumber: number;
  positionInPool: number;
  seedOrder: number;
}> = [
  // Poule A (Tables 1 et 2)
  {
    id: "team-a1",
    teamName: "Les Atouts d'Or",
    player1Name: "Maxime L.",
    player2Name: "Clara V.",
    promotionLabel: "2A Info",
    poolNumber: 1,
    positionInPool: 1,
    seedOrder: 1,
  },
  {
    id: "team-a2",
    teamName: "Sans Atout Matmeca",
    player1Name: "Hugo B.",
    player2Name: "Inès R.",
    promotionLabel: "3A Matmeca",
    poolNumber: 1,
    positionInPool: 2,
    seedOrder: 6,
  },
  {
    id: "team-a3",
    teamName: "Belote & Rebelle",
    player1Name: "Théo M.",
    player2Name: "Léa G.",
    promotionLabel: "1A Élec",
    poolNumber: 1,
    positionInPool: 3,
    seedOrder: 11,
  },
  {
    id: "team-a4",
    teamName: "Dix de Der Télécom",
    player1Name: "Yanis K.",
    player2Name: "Sarah P.",
    promotionLabel: "2A Télécoms",
    poolNumber: 1,
    positionInPool: 4,
    seedOrder: 16,
  },

  // Poule B (Tables 3 et 4)
  {
    id: "team-b1",
    teamName: "Capot Eirb",
    player1Name: "Antoine D.",
    player2Name: "Camille F.",
    promotionLabel: "3A Info",
    poolNumber: 2,
    positionInPool: 1,
    seedOrder: 2,
  },
  {
    id: "team-b2",
    teamName: "Valet de Pique",
    player1Name: "Romain T.",
    player2Name: "Manon S.",
    promotionLabel: "2A Élec",
    poolNumber: 2,
    positionInPool: 2,
    seedOrder: 7,
  },
  {
    id: "team-b3",
    teamName: "Les Surcoincheurs",
    player1Name: "Bastien C.",
    player2Name: "Chloé N.",
    promotionLabel: "2A Matmeca",
    poolNumber: 2,
    positionInPool: 3,
    seedOrder: 12,
  },
  {
    id: "team-b4",
    teamName: "Quatorze de Neuf",
    player1Name: "Julien H.",
    player2Name: "Emma J.",
    promotionLabel: "1A Info",
    poolNumber: 2,
    positionInPool: 4,
    seedOrder: 17,
  },

  // Poule C (Tables 5 et 6)
  {
    id: "team-c1",
    teamName: "Générale Impériale",
    player1Name: "Lucas P.",
    player2Name: "Juliette M.",
    promotionLabel: "3A Télécoms",
    poolNumber: 3,
    positionInPool: 1,
    seedOrder: 3,
  },
  {
    id: "team-c2",
    teamName: "Pli Maitre",
    player1Name: "Paul R.",
    player2Name: "Alice B.",
    promotionLabel: "2A Info",
    poolNumber: 3,
    positionInPool: 2,
    seedOrder: 8,
  },
  {
    id: "team-c3",
    teamName: "Trèfle Mécanique",
    player1Name: "Clément V.",
    player2Name: "Zoé L.",
    promotionLabel: "1A Matmeca",
    poolNumber: 3,
    positionInPool: 3,
    seedOrder: 13,
  },
  {
    id: "team-c4",
    teamName: "Les Parlantes",
    player1Name: "Mehdi A.",
    player2Name: "Nina D.",
    promotionLabel: "2A RSI",
    poolNumber: 3,
    positionInPool: 4,
    seedOrder: 18,
  },

  // Poule D (Tables 7 et 8)
  {
    id: "team-d1",
    teamName: "Carreau Franc",
    player1Name: "Alexandre G.",
    player2Name: "Lucie C.",
    promotionLabel: "3A Élec",
    poolNumber: 4,
    positionInPool: 1,
    seedOrder: 4,
  },
  {
    id: "team-d2",
    teamName: "Roi d'Atout",
    player1Name: "Nicolas W.",
    player2Name: "Eva T.",
    promotionLabel: "2A Télécoms",
    poolNumber: 4,
    positionInPool: 2,
    seedOrder: 9,
  },
  {
    id: "team-d3",
    teamName: "Coupe Franche",
    player1Name: "Gabriel M.",
    player2Name: "Jade K.",
    promotionLabel: "1A Info",
    poolNumber: 4,
    positionInPool: 3,
    seedOrder: 14,
  },
  {
    id: "team-d4",
    teamName: "As de Cœur",
    player1Name: "Arthur S.",
    player2Name: "Salomé H.",
    promotionLabel: "2A Matmeca",
    poolNumber: 4,
    positionInPool: 4,
    seedOrder: 19,
  },

  // Poule E (Tables 9 et 10)
  {
    id: "team-e1",
    teamName: "La Ruche Dorée",
    player1Name: "Quentin E.",
    player2Name: "Adèle P.",
    promotionLabel: "3A Info",
    poolNumber: 5,
    positionInPool: 1,
    seedOrder: 5,
  },
  {
    id: "team-e2",
    teamName: "Abeilles d'Atout",
    player1Name: "Mathis N.",
    player2Name: "Lina B.",
    promotionLabel: "2A Élec",
    poolNumber: 5,
    positionInPool: 2,
    seedOrder: 10,
  },
  {
    id: "team-e3",
    teamName: "Tout Atout Talence",
    player1Name: "Sacha R.",
    player2Name: "Maëlys F.",
    promotionLabel: "1A Télécoms",
    poolNumber: 5,
    positionInPool: 3,
    seedOrder: 15,
  },
  {
    id: "team-e4",
    teamName: "Frelons du Tapis",
    player1Name: "Damien L.",
    player2Name: "Célia V.",
    promotionLabel: "2A Info",
    poolNumber: 5,
    positionInPool: 4,
    seedOrder: 20,
  },
];

/**
 * Resultats complets des 30 matchs de poule (5 poules de 4 equipes, 6 matchs par poule en 5 donnes).
 * Note metier importante :
 * En Poule C, le 4e ("Les Parlantes") obtient 1 victoire et 1380 pts marques, tout comme le 4e de la Poule B
 * ("Quatorze de Neuf", 1 victoire et 1380 pts marques). Grace a la regle officielle Coinch'Eirb,
 * l'egalite parfaite est departagee par la force totale de la poule (`poolTotalPoints`) :
 * la Poule C cumule 7640 pts contre 6810 pts pour la Poule B, ce qui qualifie "Les Parlantes" en 16e tete de serie.
 */
const RAW_POOL_MATCHES: CompletedPoolMatchInput[] = [
  // Poule A (poolTotalPoints = 6950)
  {
    poolNumber: 1,
    teamAId: "team-a1",
    teamBId: "team-a2",
    scoreTeamA: 640,
    scoreTeamB: 480,
    status: "completed",
    winnerTeamId: "team-a1",
    forfeitTeamId: null,
  },
  {
    poolNumber: 1,
    teamAId: "team-a3",
    teamBId: "team-a4",
    scoreTeamA: 590,
    scoreTeamB: 410,
    status: "completed",
    winnerTeamId: "team-a3",
    forfeitTeamId: null,
  },
  {
    poolNumber: 1,
    teamAId: "team-a1",
    teamBId: "team-a3",
    scoreTeamA: 720,
    scoreTeamB: 460,
    status: "completed",
    winnerTeamId: "team-a1",
    forfeitTeamId: null,
  },
  {
    poolNumber: 1,
    teamAId: "team-a2",
    teamBId: "team-a4",
    scoreTeamA: 680,
    scoreTeamB: 390,
    status: "completed",
    winnerTeamId: "team-a2",
    forfeitTeamId: null,
  },
  {
    poolNumber: 1,
    teamAId: "team-a1",
    teamBId: "team-a4",
    scoreTeamA: 780,
    scoreTeamB: 440,
    status: "completed",
    winnerTeamId: "team-a1",
    forfeitTeamId: null,
  },
  {
    poolNumber: 1,
    teamAId: "team-a2",
    teamBId: "team-a3",
    scoreTeamA: 730,
    scoreTeamB: 630,
    status: "completed",
    winnerTeamId: "team-a2",
    forfeitTeamId: null,
  },

  // Poule B (poolTotalPoints = 6810) -> 4e: team-b4 (1V, 1380 pts marques)
  {
    poolNumber: 2,
    teamAId: "team-b1",
    teamBId: "team-b2",
    scoreTeamA: 690,
    scoreTeamB: 520,
    status: "completed",
    winnerTeamId: "team-b1",
    forfeitTeamId: null,
  },
  {
    poolNumber: 2,
    teamAId: "team-b3",
    teamBId: "team-b4",
    scoreTeamA: 610,
    scoreTeamB: 470,
    status: "completed",
    winnerTeamId: "team-b3",
    forfeitTeamId: null,
  },
  {
    poolNumber: 2,
    teamAId: "team-b1",
    teamBId: "team-b3",
    scoreTeamA: 660,
    scoreTeamB: 490,
    status: "completed",
    winnerTeamId: "team-b1",
    forfeitTeamId: null,
  },
  {
    poolNumber: 2,
    teamAId: "team-b2",
    teamBId: "team-b4",
    scoreTeamA: 620,
    scoreTeamB: 390,
    status: "completed",
    winnerTeamId: "team-b2",
    forfeitTeamId: null,
  },
  {
    poolNumber: 2,
    teamAId: "team-b1",
    teamBId: "team-b4",
    scoreTeamA: 510,
    scoreTeamB: 520,
    status: "completed",
    winnerTeamId: "team-b4",
    forfeitTeamId: null,
  },
  {
    poolNumber: 2,
    teamAId: "team-b2",
    teamBId: "team-b3",
    scoreTeamA: 740,
    scoreTeamB: 590,
    status: "completed",
    winnerTeamId: "team-b2",
    forfeitTeamId: null,
  },

  // Poule C (Poule la plus offensive : poolTotalPoints = 7640) -> 4e: team-c4 (1V, 1380 pts marques)
  {
    poolNumber: 3,
    teamAId: "team-c1",
    teamBId: "team-c2",
    scoreTeamA: 820,
    scoreTeamB: 610,
    status: "completed",
    winnerTeamId: "team-c1",
    forfeitTeamId: null,
  },
  {
    poolNumber: 3,
    teamAId: "team-c3",
    teamBId: "team-c4",
    scoreTeamA: 710,
    scoreTeamB: 480,
    status: "completed",
    winnerTeamId: "team-c3",
    forfeitTeamId: null,
  },
  {
    poolNumber: 3,
    teamAId: "team-c1",
    teamBId: "team-c3",
    scoreTeamA: 790,
    scoreTeamB: 540,
    status: "completed",
    winnerTeamId: "team-c1",
    forfeitTeamId: null,
  },
  {
    poolNumber: 3,
    teamAId: "team-c2",
    teamBId: "team-c4",
    scoreTeamA: 690,
    scoreTeamB: 360,
    status: "completed",
    winnerTeamId: "team-c2",
    forfeitTeamId: null,
  },
  {
    poolNumber: 3,
    teamAId: "team-c1",
    teamBId: "team-c4",
    scoreTeamA: 520,
    scoreTeamB: 540,
    status: "completed",
    winnerTeamId: "team-c4",
    forfeitTeamId: null,
  },
  {
    poolNumber: 3,
    teamAId: "team-c2",
    teamBId: "team-c3",
    scoreTeamA: 840,
    scoreTeamB: 740,
    status: "completed",
    winnerTeamId: "team-c2",
    forfeitTeamId: null,
  },

  // Poule D (poolTotalPoints = 6590)
  {
    poolNumber: 4,
    teamAId: "team-d1",
    teamBId: "team-d2",
    scoreTeamA: 630,
    scoreTeamB: 510,
    status: "completed",
    winnerTeamId: "team-d1",
    forfeitTeamId: null,
  },
  {
    poolNumber: 4,
    teamAId: "team-d3",
    teamBId: "team-d4",
    scoreTeamA: 580,
    scoreTeamB: 430,
    status: "completed",
    winnerTeamId: "team-d3",
    forfeitTeamId: null,
  },
  {
    poolNumber: 4,
    teamAId: "team-d1",
    teamBId: "team-d3",
    scoreTeamA: 670,
    scoreTeamB: 490,
    status: "completed",
    winnerTeamId: "team-d1",
    forfeitTeamId: null,
  },
  {
    poolNumber: 4,
    teamAId: "team-d2",
    teamBId: "team-d4",
    scoreTeamA: 610,
    scoreTeamB: 380,
    status: "completed",
    winnerTeamId: "team-d2",
    forfeitTeamId: null,
  },
  {
    poolNumber: 4,
    teamAId: "team-d1",
    teamBId: "team-d4",
    scoreTeamA: 710,
    scoreTeamB: 360,
    status: "completed",
    winnerTeamId: "team-d1",
    forfeitTeamId: null,
  },
  {
    poolNumber: 4,
    teamAId: "team-d2",
    teamBId: "team-d3",
    scoreTeamA: 640,
    scoreTeamB: 580,
    status: "completed",
    winnerTeamId: "team-d2",
    forfeitTeamId: null,
  },

  // Poule E (poolTotalPoints = 7120)
  {
    poolNumber: 5,
    teamAId: "team-e1",
    teamBId: "team-e2",
    scoreTeamA: 760,
    scoreTeamB: 540,
    status: "completed",
    winnerTeamId: "team-e1",
    forfeitTeamId: null,
  },
  {
    poolNumber: 5,
    teamAId: "team-e3",
    teamBId: "team-e4",
    scoreTeamA: 630,
    scoreTeamB: 460,
    status: "completed",
    winnerTeamId: "team-e3",
    forfeitTeamId: null,
  },
  {
    poolNumber: 5,
    teamAId: "team-e1",
    teamBId: "team-e3",
    scoreTeamA: 740,
    scoreTeamB: 510,
    status: "completed",
    winnerTeamId: "team-e1",
    forfeitTeamId: null,
  },
  {
    poolNumber: 5,
    teamAId: "team-e2",
    teamBId: "team-e4",
    scoreTeamA: 650,
    scoreTeamB: 420,
    status: "completed",
    winnerTeamId: "team-e2",
    forfeitTeamId: null,
  },
  {
    poolNumber: 5,
    teamAId: "team-e1",
    teamBId: "team-e4",
    scoreTeamA: 810,
    scoreTeamB: 390,
    status: "completed",
    winnerTeamId: "team-e1",
    forfeitTeamId: null,
  },
  {
    poolNumber: 5,
    teamAId: "team-e2",
    teamBId: "team-e3",
    scoreTeamA: 640,
    scoreTeamB: 570,
    status: "completed",
    winnerTeamId: "team-e2",
    forfeitTeamId: null,
  },
];

const ANNUAL_PLAYERS_DATA: AnnualPlayerStanding[] = [
  {
    rank: 1,
    profileId: "prof-01",
    displayName: "Quentin E.",
    department: "Informatique",
    promotionYear: "3A (2026)",
    schoolYear: "2026-2027",
    rankingPoints: 1420,
    tournamentsPlayed: 7,
    tournamentsWon: 3,
    matchesPlayed: 46,
    matchesWon: 39,
    totalPointsScored: 31480,
    capotsPassed: 9,
    generalesPassed: 4,
    coinchesPassed: 18,
    bestFinishLabel: "3× Vainqueur",
  },
  {
    rank: 2,
    profileId: "prof-02",
    displayName: "Adèle P.",
    department: "Informatique",
    promotionYear: "3A (2026)",
    schoolYear: "2026-2027",
    rankingPoints: 1385,
    tournamentsPlayed: 7,
    tournamentsWon: 3,
    matchesPlayed: 46,
    matchesWon: 38,
    totalPointsScored: 30920,
    capotsPassed: 8,
    generalesPassed: 3,
    coinchesPassed: 17,
    bestFinishLabel: "3× Vainqueur",
  },
  {
    rank: 3,
    profileId: "prof-03",
    displayName: "Maxime L.",
    department: "Informatique",
    promotionYear: "2A (2027)",
    schoolYear: "2026-2027",
    rankingPoints: 1290,
    tournamentsPlayed: 7,
    tournamentsWon: 2,
    matchesPlayed: 44,
    matchesWon: 35,
    totalPointsScored: 29410,
    capotsPassed: 7,
    generalesPassed: 3,
    coinchesPassed: 21,
    bestFinishLabel: "2× Vainqueur",
  },
  {
    rank: 4,
    profileId: "prof-04",
    displayName: "Lucas P.",
    department: "Télécoms",
    promotionYear: "3A (2026)",
    schoolYear: "2026-2027",
    rankingPoints: 1215,
    tournamentsPlayed: 6,
    tournamentsWon: 1,
    matchesPlayed: 39,
    matchesWon: 31,
    totalPointsScored: 27650,
    capotsPassed: 11,
    generalesPassed: 5,
    coinchesPassed: 14,
    bestFinishLabel: "1× Vainqueur",
  },
  {
    rank: 5,
    profileId: "prof-05",
    displayName: "Clara V.",
    department: "Informatique",
    promotionYear: "2A (2027)",
    schoolYear: "2026-2027",
    rankingPoints: 1180,
    tournamentsPlayed: 7,
    tournamentsWon: 1,
    matchesPlayed: 42,
    matchesWon: 32,
    totalPointsScored: 26890,
    capotsPassed: 6,
    generalesPassed: 2,
    coinchesPassed: 19,
    bestFinishLabel: "1× Vainqueur",
  },
  {
    rank: 6,
    profileId: "prof-06",
    displayName: "Alexandre G.",
    department: "Électronique",
    promotionYear: "3A (2026)",
    schoolYear: "2026-2027",
    rankingPoints: 1120,
    tournamentsPlayed: 6,
    tournamentsWon: 1,
    matchesPlayed: 37,
    matchesWon: 28,
    totalPointsScored: 25140,
    capotsPassed: 6,
    generalesPassed: 2,
    coinchesPassed: 15,
    bestFinishLabel: "1× Vainqueur",
  },
  {
    rank: 7,
    profileId: "prof-07",
    displayName: "Juliette M.",
    department: "Télécoms",
    promotionYear: "3A (2026)",
    schoolYear: "2026-2027",
    rankingPoints: 1085,
    tournamentsPlayed: 6,
    tournamentsWon: 1,
    matchesPlayed: 36,
    matchesWon: 27,
    totalPointsScored: 24780,
    capotsPassed: 8,
    generalesPassed: 3,
    coinchesPassed: 12,
    bestFinishLabel: "1× Vainqueur",
  },
  {
    rank: 8,
    profileId: "prof-08",
    displayName: "Paul R.",
    department: "Informatique",
    promotionYear: "2A (2027)",
    schoolYear: "2026-2027",
    rankingPoints: 1010,
    tournamentsPlayed: 7,
    tournamentsWon: 0,
    matchesPlayed: 40,
    matchesWon: 27,
    totalPointsScored: 24320,
    capotsPassed: 5,
    generalesPassed: 2,
    coinchesPassed: 16,
    bestFinishLabel: "2× Finaliste",
  },
  {
    rank: 9,
    profileId: "prof-09",
    displayName: "Antoine D.",
    department: "Informatique",
    promotionYear: "3A (2026)",
    schoolYear: "2026-2027",
    rankingPoints: 965,
    tournamentsPlayed: 5,
    tournamentsWon: 1,
    matchesPlayed: 31,
    matchesWon: 23,
    totalPointsScored: 21540,
    capotsPassed: 7,
    generalesPassed: 1,
    coinchesPassed: 11,
    bestFinishLabel: "1× Vainqueur",
  },
  {
    rank: 10,
    profileId: "prof-10",
    displayName: "Inès R.",
    department: "Matmeca",
    promotionYear: "3A (2026)",
    schoolYear: "2026-2027",
    rankingPoints: 920,
    tournamentsPlayed: 6,
    tournamentsWon: 0,
    matchesPlayed: 35,
    matchesWon: 24,
    totalPointsScored: 21190,
    capotsPassed: 4,
    generalesPassed: 2,
    coinchesPassed: 13,
    bestFinishLabel: "Finaliste",
  },
  {
    rank: 11,
    profileId: "prof-11",
    displayName: "Romain T.",
    department: "Électronique",
    promotionYear: "2A (2027)",
    schoolYear: "2026-2027",
    rankingPoints: 875,
    tournamentsPlayed: 6,
    tournamentsWon: 0,
    matchesPlayed: 33,
    matchesWon: 22,
    totalPointsScored: 19840,
    capotsPassed: 5,
    generalesPassed: 1,
    coinchesPassed: 14,
    bestFinishLabel: "Demi-finaliste",
  },
  {
    rank: 12,
    profileId: "prof-12",
    displayName: "Théo M.",
    department: "Électronique",
    promotionYear: "1A (2028)",
    schoolYear: "2026-2027",
    rankingPoints: 810,
    tournamentsPlayed: 5,
    tournamentsWon: 0,
    matchesPlayed: 28,
    matchesWon: 18,
    totalPointsScored: 17620,
    capotsPassed: 4,
    generalesPassed: 1,
    coinchesPassed: 10,
    bestFinishLabel: "Demi-finaliste",
  },
  {
    rank: 13,
    profileId: "prof-13",
    displayName: "Mehdi A.",
    department: "RSI",
    promotionYear: "2A (2027)",
    schoolYear: "2026-2027",
    rankingPoints: 760,
    tournamentsPlayed: 6,
    tournamentsWon: 0,
    matchesPlayed: 30,
    matchesWon: 17,
    totalPointsScored: 16980,
    capotsPassed: 3,
    generalesPassed: 1,
    coinchesPassed: 12,
    bestFinishLabel: "Quart de finale",
  },
  {
    rank: 14,
    profileId: "prof-14",
    displayName: "Sacha R.",
    department: "Télécoms",
    promotionYear: "1A (2028)",
    schoolYear: "2026-2027",
    rankingPoints: 695,
    tournamentsPlayed: 5,
    tournamentsWon: 0,
    matchesPlayed: 25,
    matchesWon: 15,
    totalPointsScored: 15210,
    capotsPassed: 3,
    generalesPassed: 0,
    coinchesPassed: 9,
    bestFinishLabel: "Quart de finale",
  },
  {
    rank: 15,
    profileId: "prof-15",
    displayName: "Camille F.",
    department: "Informatique",
    promotionYear: "Alumni",
    schoolYear: "2025-2026",
    rankingPoints: 1340,
    tournamentsPlayed: 8,
    tournamentsWon: 2,
    matchesPlayed: 49,
    matchesWon: 38,
    totalPointsScored: 32100,
    capotsPassed: 10,
    generalesPassed: 3,
    coinchesPassed: 20,
    bestFinishLabel: "Championne 25-26",
  },
  {
    rank: 16,
    profileId: "prof-16",
    displayName: "Hugo B.",
    department: "Matmeca",
    promotionYear: "Alumni",
    schoolYear: "2025-2026",
    rankingPoints: 1210,
    tournamentsPlayed: 8,
    tournamentsWon: 1,
    matchesPlayed: 45,
    matchesWon: 33,
    totalPointsScored: 28940,
    capotsPassed: 7,
    generalesPassed: 2,
    coinchesPassed: 16,
    bestFinishLabel: "Vice-champion 25-26",
  },
];

function getTeamMetaOrFallback(
  teamId: string,
  metaMap: Record<string, TeamBinomeMeta>,
): TeamBinomeMeta {
  const existing = metaMap[teamId];
  if (existing !== undefined) {
    return existing;
  }
  return {
    teamId,
    teamName: "Équipe",
    player1Name: "Joueur 1",
    player2Name: "Joueur 2",
    promotionLabel: "ENSEIRB",
    tableNumber: 1,
  };
}

/**
 * Construit le jeu de donnees complet et deterministe du tournoi Coinch'Eirb
 * en s'appuyant sur `computePoolStandings` et `resolvePoolQualifications` de `src/lib/tournament/qualification.ts`.
 */
export function buildClassementDataset(): ClassementFullDataset {
  const teams: TournamentTeamInput[] = [];
  const teamMetaById: Record<string, TeamBinomeMeta> = {};

  for (const item of RAW_TEAMS) {
    const normalized = item.teamName.toLowerCase().replace(/\s+/g, " ").trim();
    teams.push({
      id: item.id,
      teamName: item.teamName,
      normalizedName: normalized,
      player1Name: item.player1Name,
      player2Name: item.player2Name,
      checkedIn: true,
      isForfeit: false,
      seedOrder: item.seedOrder,
    });

    const assignedTable = (item.poolNumber - 1) * 2 + 1;
    teamMetaById[item.id] = {
      teamId: item.id,
      teamName: item.teamName,
      player1Name: item.player1Name,
      player2Name: item.player2Name,
      promotionLabel: item.promotionLabel,
      tableNumber: assignedTable,
    };
  }

  const poolLabels = ["Poule A", "Poule B", "Poule C", "Poule D", "Poule E"];
  const pools: GeneratedPool[] = [];

  for (let p = 1; p <= 5; p += 1) {
    const label = poolLabels[p - 1] ?? `Poule ${p}`;
    const members = RAW_TEAMS.filter((t) => t.poolNumber === p).map((t) => ({
      teamId: t.id,
      teamName: t.teamName,
      positionInPool: t.positionInPool,
    }));

    pools.push({
      poolNumber: p,
      poolLabel: label,
      size: 4,
      assignedTableStart: (p - 1) * 2 + 1,
      assignedTableCount: 2,
      teams: members,
    });
  }

  const poolStandings = computePoolStandings(pools, teams, RAW_POOL_MATCHES);
  const qualification = resolvePoolQualifications(poolStandings, 12);

  const qualifiedLookup: Record<string, QualifiedTeamSeed> = {};
  for (const q of qualification.qualifiedTeams) {
    qualifiedLookup[q.teamId] = q;
  }
  for (const e of qualification.eliminatedTeams) {
    qualifiedLookup[e.teamId] = e;
  }

  // Indexation par tete de serie #1..#16 calculee par resolvePoolQualifications
  const seedToTeam = new Map<number, QualifiedTeamSeed>();
  for (const q of qualification.qualifiedTeams) {
    if (q.bracketSeed !== null) {
      seedToTeam.set(q.bracketSeed, q);
    }
  }

  function makeKnockoutMatch(params: {
    id: string;
    phase: "round_of_16" | "quarterfinals" | "semifinals" | "final";
    slot: number;
    tableNumber: number;
    targetScore: 500 | 600 | 700 | 1000;
    seedA: number;
    seedB: number;
    scoreTeamA: number;
    scoreTeamB: number;
    status: "completed" | "in_progress" | "pending";
    highlightNote: string | null;
  }): KnockoutMatchView {
    const seededA = seedToTeam.get(params.seedA);
    const seededB = seedToTeam.get(params.seedB);

    let teamAId = "team-e1";
    let teamAName = `Tête de série #${params.seedA}`;
    if (seededA !== undefined) {
      teamAId = seededA.teamId;
      teamAName = seededA.teamName;
    }

    let teamBId = "team-c4";
    let teamBName = `Tête de série #${params.seedB}`;
    if (seededB !== undefined) {
      teamBId = seededB.teamId;
      teamBName = seededB.teamName;
    }

    const metaA = getTeamMetaOrFallback(teamAId, teamMetaById);
    const metaB = getTeamMetaOrFallback(teamBId, teamMetaById);

    let winnerTeamId: string | null = null;
    if (params.status === "completed") {
      if (params.scoreTeamA > params.scoreTeamB) {
        winnerTeamId = teamAId;
      } else {
        winnerTeamId = teamBId;
      }
    }

    return {
      id: params.id,
      phase: params.phase,
      slot: params.slot,
      tableNumber: params.tableNumber,
      targetScore: params.targetScore,
      seedA: params.seedA,
      seedB: params.seedB,
      teamAId,
      teamAName,
      teamABinome: `${metaA.player1Name} · ${metaA.player2Name}`,
      teamBId,
      teamBName,
      teamBBinome: `${metaB.player1Name} · ${metaB.player2Name}`,
      scoreTeamA: params.scoreTeamA,
      scoreTeamB: params.scoreTeamB,
      status: params.status,
      winnerTeamId,
      highlightNote: params.highlightNote,
    };
  }

  // Arbre complet des Phases Finales : Huitiemes (500 pts) -> Quarts (600 pts) -> Demies (700 pts) -> Finale (1000 pts)
  const knockoutMatches: KnockoutMatchView[] = [
    // Huitiemes de finale (500 pts)
    makeKnockoutMatch({
      id: "r16-1",
      phase: "round_of_16",
      slot: 1,
      tableNumber: 1,
      targetScore: 500,
      seedA: 1,
      seedB: 16,
      scoreTeamA: 540,
      scoreTeamB: 310,
      status: "completed",
      highlightNote: "Capot annoncé et passé par #1",
    }),
    makeKnockoutMatch({
      id: "r16-2",
      phase: "round_of_16",
      slot: 2,
      tableNumber: 2,
      targetScore: 500,
      seedA: 8,
      seedB: 9,
      scoreTeamA: 510,
      scoreTeamB: 440,
      status: "completed",
      highlightNote: null,
    }),
    makeKnockoutMatch({
      id: "r16-3",
      phase: "round_of_16",
      slot: 3,
      tableNumber: 3,
      targetScore: 500,
      seedA: 5,
      seedB: 12,
      scoreTeamA: 530,
      scoreTeamB: 390,
      status: "completed",
      highlightNote: null,
    }),
    makeKnockoutMatch({
      id: "r16-4",
      phase: "round_of_16",
      slot: 4,
      tableNumber: 4,
      targetScore: 500,
      seedA: 4,
      seedB: 13,
      scoreTeamA: 560,
      scoreTeamB: 280,
      status: "completed",
      highlightNote: "Coinche à 130 passée (260 pts)",
    }),
    makeKnockoutMatch({
      id: "r16-5",
      phase: "round_of_16",
      slot: 5,
      tableNumber: 5,
      targetScore: 500,
      seedA: 3,
      seedB: 14,
      scoreTeamA: 520,
      scoreTeamB: 350,
      status: "completed",
      highlightNote: null,
    }),
    makeKnockoutMatch({
      id: "r16-6",
      phase: "round_of_16",
      slot: 6,
      tableNumber: 6,
      targetScore: 500,
      seedA: 6,
      seedB: 11,
      scoreTeamA: 550,
      scoreTeamB: 420,
      status: "completed",
      highlightNote: null,
    }),
    makeKnockoutMatch({
      id: "r16-7",
      phase: "round_of_16",
      slot: 7,
      tableNumber: 7,
      targetScore: 500,
      seedA: 7,
      seedB: 10,
      scoreTeamA: 470,
      scoreTeamB: 520,
      status: "completed",
      highlightNote: "Qualification #10 sur la dernière donne",
    }),
    makeKnockoutMatch({
      id: "r16-8",
      phase: "round_of_16",
      slot: 8,
      tableNumber: 8,
      targetScore: 500,
      seedA: 2,
      seedB: 15,
      scoreTeamA: 580,
      scoreTeamB: 240,
      status: "completed",
      highlightNote: "Générale annoncée et faite (500 pts)",
    }),

    // Quarts de finale (600 pts)
    makeKnockoutMatch({
      id: "qf-1",
      phase: "quarterfinals",
      slot: 1,
      tableNumber: 1,
      targetScore: 600,
      seedA: 1,
      seedB: 8,
      scoreTeamA: 640,
      scoreTeamB: 480,
      status: "completed",
      highlightNote: null,
    }),
    makeKnockoutMatch({
      id: "qf-2",
      phase: "quarterfinals",
      slot: 2,
      tableNumber: 2,
      targetScore: 600,
      seedA: 5,
      seedB: 4,
      scoreTeamA: 540,
      scoreTeamB: 620,
      status: "completed",
      highlightNote: "Contrat 120 coinché chuté (320 pts)",
    }),
    makeKnockoutMatch({
      id: "qf-3",
      phase: "quarterfinals",
      slot: 3,
      tableNumber: 3,
      targetScore: 600,
      seedA: 3,
      seedB: 6,
      scoreTeamA: 630,
      scoreTeamB: 510,
      status: "completed",
      highlightNote: null,
    }),
    makeKnockoutMatch({
      id: "qf-4",
      phase: "quarterfinals",
      slot: 4,
      tableNumber: 4,
      targetScore: 600,
      seedA: 10,
      seedB: 2,
      scoreTeamA: 430,
      scoreTeamB: 650,
      status: "completed",
      highlightNote: "Capot réussi par #2",
    }),

    // Demi-finales (700 pts)
    makeKnockoutMatch({
      id: "sf-1",
      phase: "semifinals",
      slot: 1,
      tableNumber: 1,
      targetScore: 700,
      seedA: 1,
      seedB: 4,
      scoreTeamA: 740,
      scoreTeamB: 590,
      status: "completed",
      highlightNote: "110 surcoinché passé (440 pts)",
    }),
    makeKnockoutMatch({
      id: "sf-2",
      phase: "semifinals",
      slot: 2,
      tableNumber: 2,
      targetScore: 700,
      seedA: 3,
      seedB: 2,
      scoreTeamA: 640,
      scoreTeamB: 720,
      status: "completed",
      highlightNote: "Capot décisif à 640–470",
    }),

    // Finale (1000 pts)
    makeKnockoutMatch({
      id: "final-1",
      phase: "final",
      slot: 1,
      tableNumber: 1,
      targetScore: 1000,
      seedA: 1,
      seedB: 2,
      scoreTeamA: 1040,
      scoreTeamB: 890,
      status: "completed",
      highlightNote: "Finale en 1000 pts · Générale passée à la 6e donne",
    }),
  ];

  // Calcul dynamique de la poule la plus offensive et du plus gros score en poule
  let mostOffensivePoolLabel = "Poule C";
  let mostOffensivePoolPoints = 0;
  let highestPoolTeamName = "La Ruche Dorée";
  let highestPoolTeamBinome = "Quentin E. · Adèle P.";
  let highestPoolTeamPoints = 0;

  let totalPoolPoints = 0;
  for (const pool of qualification.pools) {
    totalPoolPoints += pool.poolTotalPoints;
    if (pool.poolTotalPoints > mostOffensivePoolPoints) {
      mostOffensivePoolPoints = pool.poolTotalPoints;
      mostOffensivePoolLabel = pool.poolLabel;
    }
    for (const row of pool.standings) {
      if (row.pointsScored > highestPoolTeamPoints) {
        highestPoolTeamPoints = row.pointsScored;
        highestPoolTeamName = row.teamName;
        const meta = getTeamMetaOrFallback(row.teamId, teamMetaById);
        highestPoolTeamBinome = `${meta.player1Name} · ${meta.player2Name}`;
      }
    }
  }

  let totalKnockoutPoints = 0;
  for (const km of knockoutMatches) {
    totalKnockoutPoints += km.scoreTeamA + km.scoreTeamB;
  }

  const seed1 = seedToTeam.get(1);
  const seed2 = seedToTeam.get(2);
  const seed3 = seedToTeam.get(3);
  const seed4 = seedToTeam.get(4);

  const seed1Meta = getTeamMetaOrFallback(seed1?.teamId ?? "team-e1", teamMetaById);
  const seed2Meta = getTeamMetaOrFallback(seed2?.teamId ?? "team-c1", teamMetaById);
  const seed3Meta = getTeamMetaOrFallback(seed3?.teamId ?? "team-a1", teamMetaById);
  const seed4Meta = getTeamMetaOrFallback(seed4?.teamId ?? "team-b1", teamMetaById);

  const eveningStats: EveningStatsSummary = {
    tournamentTitle: "Tournoi Coinch'Eirb · Session Automne",
    eventDateLabel: "Jeudi 26 novembre 2026 · 18h30",
    schoolYear: "2026-2027",
    totalTeams: teams.length,
    qualifiedCount: qualification.qualifiedTeams.length,
    eliminatedCount: qualification.eliminatedTeams.length,
    totalDealsPlayed: 238,
    totalPointsScoredAllMatches: totalPoolPoints + totalKnockoutPoints,
    mostOffensivePoolLabel,
    mostOffensivePoolPoints,
    highestPoolTeamName,
    highestPoolTeamBinome,
    highestPoolTeamPoints,
    capotsAnnounced: 19,
    capotsPassed: 14,
    generalesAnnounced: 6,
    generalesPassed: 4,
    coinchesAnnounced: 34,
    coinchesPassed: 21,
    surcoinchesAnnounced: 5,
    surcoinchesPassed: 3,
    parlantesPenalized: 4,
    podium: {
      winner: {
        teamName: seed1?.teamName ?? "La Ruche Dorée",
        binome: `${seed1Meta.player1Name} · ${seed1Meta.player2Name}`,
        seed: 1,
        finalScore: "1040 – 890",
        totalEveningPoints: (seed1?.pointsScored ?? 2310) + 540 + 640 + 740 + 1040,
      },
      finalist: {
        teamName: seed2?.teamName ?? "Générale Impériale",
        binome: `${seed2Meta.player1Name} · ${seed2Meta.player2Name}`,
        seed: 2,
        finalScore: "890 – 1040",
        totalEveningPoints: (seed2?.pointsScored ?? 2130) + 580 + 650 + 720 + 890,
      },
      semifinalists: [
        {
          teamName: seed3?.teamName ?? "Les Atouts d'Or",
          binome: `${seed3Meta.player1Name} · ${seed3Meta.player2Name}`,
          seed: 3,
          semiScore: "640 – 720",
          totalEveningPoints: (seed3?.pointsScored ?? 2140) + 520 + 630 + 640,
        },
        {
          teamName: seed4?.teamName ?? "Capot Eirb",
          binome: `${seed4Meta.player1Name} · ${seed4Meta.player2Name}`,
          seed: 4,
          semiScore: "590 – 740",
          totalEveningPoints: (seed4?.pointsScored ?? 1860) + 560 + 620 + 590,
        },
      ],
    },
    distinctions: [
      {
        id: "dist-pool-offense",
        categoryLabel: "Départage officiel inter-poules",
        title: "Poule la plus offensive",
        valueLabel: `${mostOffensivePoolPoints} pts cumulés`,
        recipientName: mostOffensivePoolLabel,
        subLabel:
          "Permet à son 4e (Les Parlantes, 1380 pts) de remporter le départage d'égalité parfaite face au 4e de la Poule B.",
        accentTone: "amber",
      },
      {
        id: "dist-top-scorer",
        categoryLabel: "Goal-Average Poules",
        title: "Plus grand total en poules",
        valueLabel: `${highestPoolTeamPoints} pts marqués`,
        recipientName: highestPoolTeamName,
        subLabel: `${highestPoolTeamBinome} · 3 victoires en 3 matchs (tête de série #1)`,
        accentTone: "pass",
      },
      {
        id: "dist-capots",
        categoryLabel: "Contrats à 250 pts",
        title: "Capots annoncés et faits",
        valueLabel: "14 passés / 19",
        recipientName: "73,7 % de réussite",
        subLabel: "5 capots chutés (160 pts attribués à la défense)",
        accentTone: "amber",
      },
      {
        id: "dist-generales",
        categoryLabel: "Contrats à 500 pts",
        title: "Générales annoncées et faites",
        valueLabel: "4 passées / 6",
        recipientName: "Générale Impériale & La Ruche Dorée",
        subLabel: "Dont 1 Générale passée en Finale à la 6e donne",
        accentTone: "terracotta",
      },
      {
        id: "dist-coinches",
        categoryLabel: "Contrats doublés (×2) et quadruplés (×4)",
        title: "Coinches & Surcoinches",
        valueLabel: "21 Coinches · 3 Surcoinches",
        recipientName: "39 annonces contrées",
        subLabel: "Plus gros coup : 110 surcoinché passé en Demi-finale (440 pts)",
        accentTone: "pass",
      },
      {
        id: "dist-parlantes",
        categoryLabel: "Discipline de table",
        title: "Parlantes sanctionnées",
        valueLabel: "4 parlantes (640 pts)",
        recipientName: "160 pts par parlante",
        subLabel: "Application stricte du règlement Coinch'Eirb sans annonce ni règle partenaire",
        accentTone: "fail",
      },
    ],
  };

  return {
    tournamentTitle: eveningStats.tournamentTitle,
    eventDateLabel: eveningStats.eventDateLabel,
    schoolYear: eveningStats.schoolYear,
    teams,
    teamMetaById,
    pools,
    poolMatches: RAW_POOL_MATCHES,
    qualification,
    qualifiedLookup,
    knockoutMatches,
    annualPlayers: ANNUAL_PLAYERS_DATA,
    eveningStats,
  };
}
