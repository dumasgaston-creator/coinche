import type {
  AnnouncementType,
  LivePopupPhase,
  MatchPhase,
  MatchStatus,
  TournamentStatus,
} from "@/types/database";
import type {
  GeneratedBracketNode,
  PoolStandingSummary,
  QualifiedTeamSeed,
} from "@/lib/tournament/types";

export type LiveSlideId =
  | "pools"
  | "best_fourths"
  | "tables"
  | "bracket"
  | "poster";

export type RealtimeConnectionMode = "supabase" | "connecting" | "demo";

export interface LiveSlideDefinition {
  id: LiveSlideId;
  index: number;
  shortLabel: string;
  title: string;
  subtitle: string;
}

export interface LiveTeamDisplayInfo {
  players: string;
  nickname: string | null;
}

export interface LiveTableMatchItem {
  id: string;
  tableNumber: number;
  phase: MatchPhase;
  phaseLabel: string;
  roundNumber: number;
  teamAId: string;
  teamAName: string;
  teamAPlayers: string;
  teamANickname?: string | null;
  teamBId: string;
  teamBName: string;
  teamBPlayers: string;
  teamBNickname?: string | null;
  scoreTeamA: number;
  scoreTeamB: number;
  dealsPlayed: number;
  maxDeals: number | null;
  targetScore: number | null;
  status: MatchStatus;
  recentAnnouncement: string | null;
  recentAnnouncementTone: "amber" | "pass" | "fail" | "neutral";
}

export interface LiveBracketMatchView {
  node: GeneratedBracketNode;
  teamAName: string;
  teamAPlayers?: string;
  teamANickname?: string | null;
  teamBName: string;
  teamBPlayers?: string;
  teamBNickname?: string | null;
  scoreTeamA: number;
  scoreTeamB: number;
  status: MatchStatus;
  winnerTeamId: string | null;
}

export type LiveSpecialPopupKind =
  | "announcement"
  | "elimination"
  | "champion"
  | "first_deal";

export interface LiveAnnouncementEvent {
  queueKey: string;
  id: string;
  tableNumber: number;
  teamName: string;
  opponentName: string | null;
  announcementType: AnnouncementType;
  phase: LivePopupPhase;
  pointsAwarded: number | null;
  contractNote: string | null;
  createdAt: string;
  specialKind?: LiveSpecialPopupKind;
  customHeadline?: string | null;
  customBadge?: string | null;
}

export interface LiveTournamentSnapshot {
  tournamentId: string;
  tournamentTitle: string;
  tournamentStatus: TournamentStatus;
  phaseLabel: string;
  startTimeLabel: string;
  posterUrl: string;
  winnerPhotoUrl?: string;
  winnerPhotoCaption?: string;
  dealsPerPoolMatch: number;
  roundOf16Threshold: number;
  poolStandings: PoolStandingSummary[];
  wildcardCandidates: QualifiedTeamSeed[];
  wildcardSlotsAvailable: number;
  wildcardRank?: number | null;
  directTopRank?: number;
  totalActiveTeams?: number;
  qualifiedLookup?: Record<string, QualifiedTeamSeed>;
  activeMatches: LiveTableMatchItem[];
  bracketMatches: LiveBracketMatchView[];
  teamDisplayById?: Record<string, LiveTeamDisplayInfo>;
}
