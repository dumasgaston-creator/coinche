export type UserRole = "player" | "admin";

export type TournamentStatus =
  | "draft"
  | "checkin"
  | "pools"
  | "round_of_16"
  | "quarterfinals"
  | "semifinals"
  | "final"
  | "completed";

export type MatchPhase =
  | "pool"
  | "round_of_16"
  | "quarterfinals"
  | "semifinals"
  | "final";

export type MatchStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "forfeit"
  | "bye";

export type AnnouncementType =
  | "capot"
  | "generale"
  | "coinche"
  | "surcoinche";

export type AnnouncementOutcome = "pending" | "passed" | "failed";

export type LivePopupPhase = "announced" | "passed" | "failed";

export type RefereeAlertType = "referee_call" | "abandon_request";

export type RefereeAlertStatus = "open" | "acknowledged" | "resolved";

export type QualificationReason =
  | "direct_top_n"
  | "best_wildcards"
  | "eliminated"
  | "forfeit";

export interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string;
  role: UserRole;
  school_year: string;
  created_at: string;
  updated_at: string;
}

export interface TournamentRow {
  id: string;
  slug: string;
  title: string;
  event_date: string;
  starts_at: string;
  school_year: string;
  status: TournamentStatus;
  registrations_locked: boolean;
  player_score_editing_enabled: boolean;
  round_of_16_threshold: number;
  deals_per_pool_match: number;
  target_score_r16: number;
  target_score_qf: number;
  target_score_sf: number;
  target_score_final: number;
  poster_storage_path: string | null;
  poster_public_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PoolRow {
  id: string;
  tournament_id: string;
  pool_number: number;
  pool_label: string;
  size: number;
  assigned_table_start: number;
  total_points_scored: number;
  created_at: string;
}

export interface TeamRow {
  id: string;
  tournament_id: string;
  team_name: string;
  normalized_name: string;
  player_1_name: string;
  player_2_name: string;
  player_1_profile_id: string | null;
  player_2_profile_id: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
  is_forfeit: boolean;
  pool_id: string | null;
  seed_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface TeamSecretRow {
  team_id: string;
  tournament_id: string;
  access_code_hash: string;
  access_code_hint: string;
  updated_at: string;
}

export interface PoolMembershipRow {
  id: string;
  tournament_id: string;
  pool_id: string;
  team_id: string;
  position_in_pool: number;
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  points_scored: number;
  points_conceded: number;
  pool_rank: number | null;
  qualified: boolean;
  qualification_reason: QualificationReason | null;
}

export interface MatchRow {
  id: string;
  tournament_id: string;
  phase: MatchPhase;
  pool_id: string | null;
  round_number: number;
  bracket_slot: number | null;
  table_number: number | null;
  team_a_id: string | null;
  team_b_id: string | null;
  score_team_a: number;
  score_team_b: number;
  target_score: number | null;
  max_deals: number | null;
  deals_played: number;
  is_direct_final_score: boolean;
  status: MatchStatus;
  winner_team_id: string | null;
  forfeit_team_id: string | null;
  locked_by_admin: boolean;
  next_match_id: string | null;
  next_match_slot: "team_a" | "team_b" | null;
  started_at: string | null;
  completed_at: string | null;
  updated_by_role: "team" | "admin" | null;
  created_at: string;
  updated_at: string;
}

export interface MatchDealRow {
  id: string;
  tournament_id: string;
  match_id: string;
  deal_number: number;
  points_team_a: number;
  points_team_b: number;
  is_tiebreaker_deal: boolean;
  special_announcement: AnnouncementType | null;
  announcement_outcome: AnnouncementOutcome | null;
  parlante_penalty: boolean;
  recorded_by_team_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiveAnnouncementRow {
  id: string;
  tournament_id: string;
  match_id: string;
  table_number: number;
  team_id: string | null;
  team_name_snapshot: string;
  announcement_type: AnnouncementType;
  phase: LivePopupPhase;
  points_awarded: number | null;
  created_at: string;
  resolved_at: string | null;
}

export interface RefereeAlertRow {
  id: string;
  tournament_id: string;
  match_id: string;
  table_number: number;
  requesting_team_id: string | null;
  alert_type: RefereeAlertType;
  message: string | null;
  status: RefereeAlertStatus;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AnnualLeaderboardEntryRow {
  id: string;
  school_year: string;
  profile_id: string;
  display_name_snapshot: string;
  tournament_id: string;
  team_id: string | null;
  final_stage: MatchPhase;
  final_rank: number | null;
  matches_played: number;
  matches_won: number;
  total_points_scored: number;
  ranking_points: number;
  capots_passed: number;
  generales_passed: number;
  coinches_passed: number;
  created_at: string;
}

export interface RateLimitBucketRow {
  bucket_key: string;
  attempts: number;
  window_started_at: string;
  blocked_until: string | null;
  updated_at: string;
}

export interface SecurityAuditLogRow {
  id: string;
  actor_profile_id: string | null;
  actor_team_id: string | null;
  action: string;
  target_table: string;
  target_id: string | null;
  ip_hash: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
