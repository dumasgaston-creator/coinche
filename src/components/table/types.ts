import type {
  AnnouncementOutcome,
  AnnouncementType,
  MatchPhase,
} from "@/types/database";

export type TeamSide = "team_a" | "team_b";

export interface TableTeamInfo {
  id: string;
  name: string;
  nickname: string | null;
  player1: string;
  player2: string;
}

export interface TableDealItem {
  id: string;
  dealNumber: number;
  pointsTeamA: number;
  pointsTeamB: number;
  isTiebreaker: boolean;
  specialAnnouncement: AnnouncementType | null;
  announcementOutcome: AnnouncementOutcome | null;
  parlantePenalty: boolean;
}

export interface PendingLiveAnnouncement {
  id: string;
  type: AnnouncementType;
  teamSide: TeamSide;
  teamName: string;
  sentAtLabel: string;
}

export interface TableMatchViewModel {
  tableNumber: number;
  poolLabel: string;
  phase: MatchPhase;
  dealsPerPoolMatch: number;
  targetScore: number | null;
  playerScoreEditingEnabled: boolean;
  teamA: TableTeamInfo;
  teamB: TableTeamInfo;
  initialDeals: TableDealItem[];
}
