import type { MatchPhase, QualificationReason } from "@/types/database";

export interface RawImportedTeamRow {
  rowNumber: number;
  teamName: string;
  normalizedTeamName: string;
  player1Name: string;
  player2Name: string;
  normalizedPlayer1: string;
  normalizedPlayer2: string;
}

export interface ImportDuplicateIssue {
  type: "duplicate_team_name" | "duplicate_player_name" | "same_player_twice";
  normalizedKey: string;
  displayValue: string;
  rowNumbers: number[];
  message: string;
}

export interface ImportRowError {
  rowNumber: number;
  rawCells: string[];
  reason: string;
}

export interface ParsedRegistrationResult {
  delimiter: "," | ";" | "\t";
  hasHeaderRow: boolean;
  validRows: RawImportedTeamRow[];
  duplicates: ImportDuplicateIssue[];
  rowErrors: ImportRowError[];
}

export interface TournamentTeamInput {
  id: string;
  teamName: string;
  normalizedName: string;
  player1Name: string;
  player2Name: string;
  checkedIn: boolean;
  isForfeit: boolean;
  seedOrder: number | null;
}

export interface GeneratedPool {
  poolNumber: number;
  poolLabel: string;
  size: number;
  assignedTableStart: number;
  assignedTableCount: number;
  teams: Array<{
    teamId: string;
    teamName: string;
    positionInPool: number;
  }>;
}

export interface GeneratedPoolMatch {
  poolNumber: number;
  roundNumber: number;
  tableNumber: number;
  teamAId: string;
  teamBId: string;
  maxDeals: number;
}

export interface PoolGenerationPlan {
  startsAtTimeLabel: string;
  totalActiveTeams: number;
  pools: GeneratedPool[];
  matches: GeneratedPoolMatch[];
}

export type BidMultiplierType = "normal" | "coinche" | "surcoinche";

export type ContractBidKind = "points" | "capot" | "generale";

export interface CoincheDealCalculationInput {
  takerSide: "team_a" | "team_b";
  contractKind: ContractBidKind;
  contractPoints?: number;
  multiplier: BidMultiplierType;
  passed: boolean;
  takerHasBelote?: boolean;
  parlanteCountForTakerOpponent?: number;
  parlanteCountForTaker?: number;
}

export interface CoincheDealCalculationResult {
  pointsTeamA: number;
  pointsTeamB: number;
  effectiveTrickThreshold: number | null;
  appliedMultiplier: 1 | 2 | 4;
}

export interface CompletedPoolMatchInput {
  poolNumber: number;
  teamAId: string;
  teamBId: string;
  scoreTeamA: number;
  scoreTeamB: number;
  status: "pending" | "in_progress" | "completed" | "forfeit" | "bye";
  winnerTeamId: string | null;
  forfeitTeamId: string | null;
}

export interface RankedPoolTeam {
  teamId: string;
  teamName: string;
  poolNumber: number;
  poolLabel: string;
  positionInPool: number;
  seedOrder: number | null;
  isForfeit: boolean;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  pointsScored: number;
  pointsConceded: number;
  pointsDiff: number;
  poolTotalPoints: number;
  poolRank: number;
}

export interface PoolStandingSummary {
  poolNumber: number;
  poolLabel: string;
  poolTotalPoints: number;
  standings: RankedPoolTeam[];
}

export interface QualifiedTeamSeed extends RankedPoolTeam {
  qualified: boolean;
  qualificationReason: QualificationReason;
  bracketSeed: number | null;
}

export interface KnockoutFormatDecision {
  startingPhase: Exclude<MatchPhase, "pool">;
  bracketSize: 2 | 4 | 8 | 16;
  qualifierCount: number;
}

export interface QualificationOutcome {
  format: KnockoutFormatDecision;
  pools: PoolStandingSummary[];
  qualifiedTeams: QualifiedTeamSeed[];
  eliminatedTeams: QualifiedTeamSeed[];
  wildcardRank: number | null;
  wildcardCandidatesRanked: QualifiedTeamSeed[];
}

export interface TargetScoreConfig {
  round_of_16: number;
  quarterfinals: number;
  semifinals: number;
  final: number;
}

export interface GeneratedBracketNode {
  tempId: string;
  phase: Exclude<MatchPhase, "pool">;
  roundNumber: number;
  bracketSlot: number;
  tableNumber: number | null;
  targetScore: number;
  teamAId: string | null;
  teamBId: string | null;
  seedA: number | null;
  seedB: number | null;
  status: "pending" | "bye";
  winnerTeamId: string | null;
  nextMatchTempId: string | null;
  nextMatchSlot: "team_a" | "team_b" | null;
}
