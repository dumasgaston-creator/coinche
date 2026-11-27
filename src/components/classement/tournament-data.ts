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

/**
 * Construit un jeu de donnees vierge (0 joueur fictif, 0 match fictif).
 * Tout le classement se construit en direct avec les vrais joueurs et binomes de l'ENSEIRB.
 */
export function buildClassementDataset(): ClassementFullDataset {
  const teams: TournamentTeamInput[] = [];
  const teamMetaById: Record<string, TeamBinomeMeta> = {};
  const pools: GeneratedPool[] = [];
  const poolMatches: CompletedPoolMatchInput[] = [];
  const poolStandings = computePoolStandings(pools, teams, poolMatches);
  const qualification: QualificationOutcome = {
    format: {
      startingPhase: "round_of_16",
      bracketSize: 16,
      qualifierCount: 16,
    },
    pools: poolStandings,
    qualifiedTeams: [],
    eliminatedTeams: [],
    wildcardRank: 4,
    wildcardCandidatesRanked: [],
  };

  const eveningStats: EveningStatsSummary = {
    tournamentTitle: "Tournoi Coinch'Eirb · BAR ENSEIRB-MATMECA",
    eventDateLabel: "Saison 2026-2027 · 18h30",
    schoolYear: "2026-2027",
    totalTeams: 0,
    qualifiedCount: 0,
    eliminatedCount: 0,
    totalDealsPlayed: 0,
    totalPointsScoredAllMatches: 0,
    mostOffensivePoolLabel: "–",
    mostOffensivePoolPoints: 0,
    highestPoolTeamName: "En attente",
    highestPoolTeamBinome: "Inscrivez vos équipes pour lancer le tournoi",
    highestPoolTeamPoints: 0,
    capotsAnnounced: 0,
    capotsPassed: 0,
    generalesAnnounced: 0,
    generalesPassed: 0,
    coinchesAnnounced: 0,
    coinchesPassed: 0,
    surcoinchesAnnounced: 0,
    surcoinchesPassed: 0,
    parlantesPenalized: 0,
    podium: {
      winner: {
        teamName: "En attente des matchs",
        binome: "Aucun match clôturé",
        seed: 1,
        finalScore: "0 – 0",
        totalEveningPoints: 0,
      },
      finalist: {
        teamName: "En attente des matchs",
        binome: "Aucun match clôturé",
        seed: 2,
        finalScore: "0 – 0",
        totalEveningPoints: 0,
      },
      semifinalists: [],
    },
    distinctions: [
      {
        id: "dist-pool-offense",
        categoryLabel: "Départage officiel inter-poules",
        title: "Poule la plus offensive",
        valueLabel: "0 pt cumulé",
        recipientName: "En attente",
        subLabel:
          "Départage automatiquement toute égalité parfaite au goal-average entre deux équipes de poules différentes.",
        accentTone: "amber",
      },
      {
        id: "dist-top-scorer",
        categoryLabel: "Goal-Average Poules",
        title: "Plus grand total en poules",
        valueLabel: "0 pt marqué",
        recipientName: "En attente",
        subLabel: "Se met à jour dès la première donne enregistrée.",
        accentTone: "pass",
      },
      {
        id: "dist-capots",
        categoryLabel: "Contrats à 250 pts",
        title: "Capots enregistrés",
        valueLabel: "0 passé / 0",
        recipientName: "250 pts par Capot fait",
        subLabel: "160 pts attribués à la défense en cas de chute.",
        accentTone: "amber",
      },
      {
        id: "dist-generales",
        categoryLabel: "Contrats à 500 pts",
        title: "Générales enregistrées",
        valueLabel: "0 passée / 0",
        recipientName: "500 pts par Générale faite",
        subLabel: "8 plis remportés par un seul joueur.",
        accentTone: "terracotta",
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
    poolMatches,
    qualification,
    qualifiedLookup: {},
    knockoutMatches: [],
    annualPlayers: [],
    eveningStats,
  };
}
