import type {
  GeneratedBracketNode,
  GeneratedPool,
  QualificationOutcome,
  TournamentTeamInput,
} from "@/lib/tournament";
import type {
  AnnouncementType,
  LivePopupPhase,
  MatchPhase,
  MatchStatus,
  RefereeAlertStatus,
  RefereeAlertType,
  TournamentStatus,
} from "@/types/database";

export interface AdminMatchRecord {
  id: string;
  phase: MatchPhase;
  poolNumber: number | null;
  poolLabel: string | null;
  roundNumber: number;
  bracketSlot: number | null;
  tableNumber: number | null;
  teamAId: string | null;
  teamBId: string | null;
  scoreTeamA: number;
  scoreTeamB: number;
  targetScore: number | null;
  maxDeals: number | null;
  dealsPlayed: number;
  isDirectFinalScore: boolean;
  status: MatchStatus;
  winnerTeamId: string | null;
  forfeitTeamId: string | null;
  lockedByAdmin: boolean;
  updatedByRole: "team" | "admin" | null;
  updatedAtLabel: string;
}

export interface AdminRefereeAlertItem {
  id: string;
  matchId: string;
  tableNumber: number;
  requestingTeamId: string;
  requestingTeamName: string;
  alertType: RefereeAlertType;
  message: string;
  status: RefereeAlertStatus;
  createdAtLabel: string;
  resolvedAtLabel: string | null;
}

export interface AdminLiveFeedEntry {
  id: string;
  tableNumber: number;
  teamName: string;
  announcementType: AnnouncementType;
  phase: LivePopupPhase;
  pointsAwarded: number | null;
  createdAtLabel: string;
}

export interface AdminTournamentMeta {
  id: string;
  title: string;
  eventDate: string;
  startsAtLabel: string;
  schoolYear: string;
  status: TournamentStatus;
  registrationsLocked: boolean;
  playerScoreEditingEnabled: boolean;
  roundOf16Threshold: number;
  dealsPerPoolMatch: number;
  targetScoreR16: number;
  targetScoreQf: number;
  targetScoreSf: number;
  targetScoreFinal: number;
  posterUrl: string;
  posterMimeLabel: string;
  posterSizeLabel: string;
  winnerPhotoUrl?: string;
  winnerPhotoCaption?: string;
}

export interface AdminCockpitSnapshot {
  tournament: AdminTournamentMeta;
  teams: TournamentTeamInput[];
  pools: GeneratedPool[];
  matches: AdminMatchRecord[];
  alerts: AdminRefereeAlertItem[];
  liveFeed: AdminLiveFeedEntry[];
  qualification: QualificationOutcome | null;
  bracketNodes: GeneratedBracketNode[];
}

export const INITIAL_DEMO_CSV_SAMPLE = "";

export function buildInitialDemoTeams(): TournamentTeamInput[] {
  return [];
}

export function buildInitialTournamentMeta(): AdminTournamentMeta {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Tournoi Coinch'Eirb · Soirée BAR ENSEIRB-MATMECA",
    eventDate: "2026-11-27",
    startsAtLabel: "18h30",
    schoolYear: "2026-2027",
    status: "checkin",
    registrationsLocked: false,
    playerScoreEditingEnabled: true,
    roundOf16Threshold: 12,
    dealsPerPoolMatch: 5,
    targetScoreR16: 500,
    targetScoreQf: 600,
    targetScoreSf: 700,
    targetScoreFinal: 1000,
    posterUrl: "/assets/affiche-soiree.jpg",
    posterMimeLabel: "image/jpeg",
    posterSizeLabel: "Affiche officielle",
  };
}
