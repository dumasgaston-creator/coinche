"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatPoolLabel } from "@/lib/tournament/pool-generator";
import {
  computePoolStandings,
  determineKnockoutFormat,
  resolvePoolQualifications,
} from "@/lib/tournament/qualification";
import { generateKnockoutBracket } from "@/lib/tournament/bracket";
import type {
  CompletedPoolMatchInput,
  GeneratedPool,
  TournamentTeamInput,
} from "@/lib/tournament/types";
import type {
  AnnouncementType,
  LiveAnnouncementRow,
  LivePopupPhase,
  MatchPhase,
  MatchRow,
  PoolMembershipRow,
  PoolRow,
  TeamRow,
  TournamentRow,
  TournamentStatus,
} from "@/types/database";
import {
  formatOptionalTeamNickname,
  formatPlayersPrimaryName,
} from "@/lib/tournament/live-store-types";
import { buildDemoTournamentSnapshot } from "@/components/live/demo-data";
import type {
  LiveAnnouncementEvent,
  LiveBracketMatchView,
  LiveTableMatchItem,
  LiveTournamentSnapshot,
  RealtimeConnectionMode,
} from "@/components/live/types";

export const LIVE_BROADCAST_CHANNEL_NAME = "coincheirb-live";
const LIVE_STORAGE_KEYS: readonly string[] = [
  "coincheirb-live-announcement",
  "coincheirb-live-event",
];

function isConfiguredSupabaseEnv(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url === undefined || anon === undefined) {
    return false;
  }
  if (url.length < 16 || anon.length < 20) {
    return false;
  }
  if (url.includes("your-project-ref") || anon.includes("your-public-anon-key")) {
    return false;
  }
  return true;
}

/**
 * Retourne le client Supabase navigateur uniquement si les variables publiques
 * sont configurees et valides, sinon `null` (bascule fluide en mode demo temps reel).
 */
export function getOptionalBrowserSupabaseClient(): SupabaseClient | null {
  if (!isConfiguredSupabaseEnv()) {
    return null;
  }
  try {
    return createSupabaseBrowserClient();
  } catch {
    return null;
  }
}

function formatTournamentPhaseLabel(status: TournamentStatus): string {
  if (status === "checkin") {
    return "Check-in en cours · 1er tour à 18h30";
  }
  if (status === "pools") {
    return "Phase de poules en cours";
  }
  if (status === "round_of_16") {
    return "Huitièmes de finale · 500 pts";
  }
  if (status === "quarterfinals") {
    return "Quarts de finale · 600 pts";
  }
  if (status === "semifinals") {
    return "Demi-finales · 700 pts";
  }
  if (status === "final") {
    return "Finale · 1000 pts";
  }
  if (status === "completed") {
    return "Tournoi terminé";
  }
  return "Préparation du tournoi";
}

function formatMatchPhaseLabel(
  phase: MatchPhase,
  poolLabel: string | null,
  roundNumber: number,
): string {
  if (phase === "pool") {
    if (poolLabel !== null) {
      return `${poolLabel} · Tour ${roundNumber}`;
    }
    return `Poules · Tour ${roundNumber}`;
  }
  if (phase === "round_of_16") {
    return "Huitième · 500 pts";
  }
  if (phase === "quarterfinals") {
    return "Quart · 600 pts";
  }
  if (phase === "semifinals") {
    return "Demi-finale · 700 pts";
  }
  return "Finale · 1000 pts";
}

function isAnnouncementType(value: unknown): value is AnnouncementType {
  return (
    value === "capot" ||
    value === "generale" ||
    value === "coinche" ||
    value === "surcoinche"
  );
}

function isLivePopupPhase(value: unknown): value is LivePopupPhase {
  return value === "announced" || value === "passed" || value === "failed";
}

/**
 * Normalise un enregistrement `live_announcements` (Supabase ou BroadcastChannel/localStorage)
 * vers un evenement strictement type pret pour la file d'attente FIFO.
 */
export function normalizeAnnouncementEvent(
  raw: unknown,
): LiveAnnouncementEvent | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const rawType = record.announcement_type ?? record.announcementType ?? record.type;
  const rawPhase = record.phase ?? "announced";

  if (!isAnnouncementType(rawType) || !isLivePopupPhase(rawPhase)) {
    return null;
  }

  let tableNumber = 1;
  const rawTable = record.table_number ?? record.tableNumber;
  if (typeof rawTable === "number" && Number.isFinite(rawTable) && rawTable >= 1) {
    tableNumber = Math.trunc(rawTable);
  }

  let teamName = "Équipe";
  const rawTeamName = record.team_name_snapshot ?? record.teamName;
  if (typeof rawTeamName === "string" && rawTeamName.trim().length > 0) {
    teamName = rawTeamName.trim().slice(0, 60);
  }

  let opponentName: string | null = null;
  const rawOpponent = record.opponentName;
  if (typeof rawOpponent === "string" && rawOpponent.trim().length > 0) {
    opponentName = rawOpponent.trim().slice(0, 60);
  }

  let pointsAwarded: number | null = null;
  const rawPoints = record.points_awarded ?? record.pointsAwarded;
  if (typeof rawPoints === "number" && Number.isFinite(rawPoints) && rawPoints >= 0) {
    pointsAwarded = Math.trunc(rawPoints);
  }

  let contractNote: string | null = null;
  const rawNote = record.contractNote;
  if (typeof rawNote === "string" && rawNote.trim().length > 0) {
    contractNote = rawNote.trim().slice(0, 80);
  }

  let id = `evt-${Date.now()}`;
  if (typeof record.id === "string" && record.id.trim().length > 0) {
    id = record.id.trim();
  }

  let createdAt = new Date().toISOString();
  const rawCreatedAt = record.created_at ?? record.createdAt;
  if (typeof rawCreatedAt === "string" && rawCreatedAt.length > 0) {
    createdAt = rawCreatedAt;
  }

  return {
    queueKey: `${id}:${rawPhase}`,
    id,
    tableNumber,
    teamName,
    opponentName,
    announcementType: rawType,
    phase: rawPhase,
    pointsAwarded,
    contractNote,
    createdAt,
  };
}

function buildSnapshotFromSupabaseRows(params: {
  tournament: TournamentRow;
  pools: PoolRow[];
  teams: TeamRow[];
  memberships: PoolMembershipRow[];
  matches: MatchRow[];
}): LiveTournamentSnapshot {
  const { tournament, pools, teams, memberships, matches } = params;
  const teamMap = new Map<string, TeamRow>();
  const tournamentTeams: TournamentTeamInput[] = [];

  for (const team of teams) {
    teamMap.set(team.id, team);
    tournamentTeams.push({
      id: team.id,
      teamName: team.team_name,
      normalizedName: team.normalized_name,
      player1Name: team.player_1_name,
      player2Name: team.player_2_name,
      checkedIn: team.checked_in,
      isForfeit: team.is_forfeit,
      seedOrder: team.seed_order,
    });
  }

  const sortedPools = [...pools].sort((a, b) => a.pool_number - b.pool_number);
  const poolIdToNumber = new Map<string, number>();
  const poolIdToLabel = new Map<string, string>();

  const generatedPools: GeneratedPool[] = [];
  for (const pool of sortedPools) {
    poolIdToNumber.set(pool.id, pool.pool_number);
    poolIdToLabel.set(pool.id, pool.pool_label);

    const poolMembers = memberships
      .filter((m) => m.pool_id === pool.id)
      .sort((a, b) => a.position_in_pool - b.position_in_pool);

    generatedPools.push({
      poolNumber: pool.pool_number,
      poolLabel: pool.pool_label,
      size: pool.size,
      assignedTableStart: pool.assigned_table_start,
      assignedTableCount: Math.max(1, Math.floor(pool.size / 2)),
      teams: poolMembers.map((m) => {
        const t = teamMap.get(m.team_id);
        let teamName = "Équipe";
        if (t !== undefined) {
          teamName = t.team_name;
        }
        return {
          teamId: m.team_id,
          teamName,
          positionInPool: m.position_in_pool,
        };
      }),
    });
  }

  const completedPoolMatches: CompletedPoolMatchInput[] = [];
  for (const match of matches) {
    if (
      match.phase !== "pool" ||
      match.pool_id === null ||
      match.team_a_id === null ||
      match.team_b_id === null
    ) {
      continue;
    }
    const poolNumber = poolIdToNumber.get(match.pool_id);
    if (poolNumber === undefined) {
      continue;
    }
    completedPoolMatches.push({
      poolNumber,
      teamAId: match.team_a_id,
      teamBId: match.team_b_id,
      scoreTeamA: match.score_team_a,
      scoreTeamB: match.score_team_b,
      status: match.status,
      winnerTeamId: match.winner_team_id,
      forfeitTeamId: match.forfeit_team_id,
    });
  }

  let poolStandings = computePoolStandings(
    generatedPools,
    tournamentTeams,
    completedPoolMatches,
  );
  if (generatedPools.length === 0) {
    poolStandings = [];
  }

  let wildcardCandidates: LiveTournamentSnapshot["wildcardCandidates"] = [];
  let wildcardSlotsAvailable = 1;
  let bracketMatches: LiveBracketMatchView[] = [];

  const nonForfeitCount = tournamentTeams.filter(
    (t) => t.checkedIn && !t.isForfeit,
  ).length;

  if (poolStandings.length > 0 && nonForfeitCount >= 2) {
    const qualification = resolvePoolQualifications(
      poolStandings,
      tournament.round_of_16_threshold,
    );
    wildcardCandidates = qualification.wildcardCandidatesRanked;
    const format = determineKnockoutFormat(
      nonForfeitCount,
      tournament.round_of_16_threshold,
    );
    const directCount = qualification.qualifiedTeams.filter(
      (q) => q.qualificationReason === "direct_top_n",
    ).length;
    wildcardSlotsAvailable = Math.max(0, format.qualifierCount - directCount);

    const dbKnockoutMatches = matches.filter((m) => m.phase !== "pool");
    if (dbKnockoutMatches.length > 0) {
      const sortedKo = [...dbKnockoutMatches].sort((a, b) => {
        if (a.round_number !== b.round_number) {
          return a.round_number - b.round_number;
        }
        return (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0);
      });

      bracketMatches = sortedKo.map((ko) => {
        let teamAName = "À déterminer";
        if (ko.team_a_id !== null) {
          const teamA = teamMap.get(ko.team_a_id);
          if (teamA !== undefined) {
            teamAName = teamA.team_name;
          }
        }
        let teamBName = "À déterminer";
        if (ko.team_b_id !== null) {
          const teamB = teamMap.get(ko.team_b_id);
          if (teamB !== undefined) {
            teamBName = teamB.team_name;
          }
        }
        let koPhase: Exclude<MatchPhase, "pool"> = "round_of_16";
        if (
          ko.phase === "quarterfinals" ||
          ko.phase === "semifinals" ||
          ko.phase === "final"
        ) {
          koPhase = ko.phase;
        }
        let koStatus: "pending" | "bye" = "pending";
        if (ko.status === "bye") {
          koStatus = "bye";
        }

        return {
          node: {
            tempId: ko.id,
            phase: koPhase,
            roundNumber: ko.round_number,
            bracketSlot: ko.bracket_slot ?? 1,
            tableNumber: ko.table_number,
            targetScore: ko.target_score ?? 500,
            teamAId: ko.team_a_id,
            teamBId: ko.team_b_id,
            seedA: null,
            seedB: null,
            status: koStatus,
            winnerTeamId: ko.winner_team_id,
            nextMatchTempId: ko.next_match_id,
            nextMatchSlot: ko.next_match_slot,
          },
          teamAName,
          teamBName,
          scoreTeamA: ko.score_team_a,
          scoreTeamB: ko.score_team_b,
          status: ko.status,
          winnerTeamId: ko.winner_team_id,
        };
      });
    } else {
      const projectedNodes = generateKnockoutBracket({
        format: qualification.format,
        qualifiedTeams: qualification.qualifiedTeams,
        targetScores: {
          round_of_16: tournament.target_score_r16,
          quarterfinals: tournament.target_score_qf,
          semifinals: tournament.target_score_sf,
          final: tournament.target_score_final,
        },
      });
      bracketMatches = projectedNodes.map((node) => {
        let teamAName = "À déterminer";
        if (node.teamAId !== null) {
          const teamA = teamMap.get(node.teamAId);
          if (teamA !== undefined) {
            teamAName = teamA.team_name;
          }
        } else if (node.seedA !== null) {
          teamAName = `Qualifié #${node.seedA}`;
        }

        let teamBName = "À déterminer";
        if (node.teamBId !== null) {
          const teamB = teamMap.get(node.teamBId);
          if (teamB !== undefined) {
            teamBName = teamB.team_name;
          }
        } else if (node.seedB !== null) {
          teamBName = `Qualifié #${node.seedB}`;
        }

        return {
          node,
          teamAName,
          teamBName,
          scoreTeamA: 0,
          scoreTeamB: 0,
          status: node.status,
          winnerTeamId: node.winnerTeamId,
        };
      });
    }
  }

  const activeDbMatches = matches
    .filter((m) => m.table_number !== null && m.status !== "bye")
    .sort((a, b) => (a.table_number ?? 999) - (b.table_number ?? 999))
    .slice(0, 12);

  const activeMatches: LiveTableMatchItem[] = [];
  for (const m of activeDbMatches) {
    let teamA: TeamRow | undefined = undefined;
    if (m.team_a_id !== null) {
      teamA = teamMap.get(m.team_a_id);
    }
    let teamB: TeamRow | undefined = undefined;
    if (m.team_b_id !== null) {
      teamB = teamMap.get(m.team_b_id);
    }
    if (teamA === undefined || teamB === undefined || m.table_number === null) {
      continue;
    }

    let poolLabel: string | null = null;
    if (m.pool_id !== null) {
      poolLabel = poolIdToLabel.get(m.pool_id) ?? formatPoolLabel(1);
    }

    let note: string | null = null;
    let tone: LiveTableMatchItem["recentAnnouncementTone"] = "neutral";
    if (
      m.phase === "pool" &&
      m.deals_played >= tournament.deals_per_pool_match &&
      m.score_team_a === m.score_team_b &&
      m.status === "in_progress"
    ) {
      note = "Égalité · 6e donne décisive";
      tone = "amber";
    } else if (m.status === "completed") {
      note = "Match terminé";
    }

    activeMatches.push({
      id: m.id,
      tableNumber: m.table_number,
      phase: m.phase,
      phaseLabel: formatMatchPhaseLabel(m.phase, poolLabel, m.round_number),
      roundNumber: m.round_number,
      teamAId: teamA.id,
      teamAName: teamA.team_name,
      teamAPlayers: formatPlayersPrimaryName(teamA.player_1_name, teamA.player_2_name),
      teamANickname: formatOptionalTeamNickname(
        teamA.team_name,
        teamA.player_1_name,
        teamA.player_2_name,
      ),
      teamBId: teamB.id,
      teamBName: teamB.team_name,
      teamBPlayers: formatPlayersPrimaryName(teamB.player_1_name, teamB.player_2_name),
      teamBNickname: formatOptionalTeamNickname(
        teamB.team_name,
        teamB.player_1_name,
        teamB.player_2_name,
      ),
      scoreTeamA: m.score_team_a,
      scoreTeamB: m.score_team_b,
      dealsPlayed: m.deals_played,
      maxDeals: m.max_deals,
      targetScore: m.target_score,
      status: m.status,
      recentAnnouncement: note,
      recentAnnouncementTone: tone,
    });
  }

  let posterUrl = "/assets/affiche-soiree.jpg";
  if (
    tournament.poster_public_url !== null &&
    tournament.poster_public_url.trim().length > 0
  ) {
    posterUrl = tournament.poster_public_url.trim();
  }

  return {
    tournamentId: tournament.id,
    tournamentTitle: tournament.title,
    tournamentStatus: tournament.status,
    phaseLabel: formatTournamentPhaseLabel(tournament.status),
    startTimeLabel: "1er tour à 18h30",
    posterUrl,
    dealsPerPoolMatch: tournament.deals_per_pool_match,
    roundOf16Threshold: tournament.round_of_16_threshold,
    poolStandings,
    wildcardCandidates,
    wildcardSlotsAvailable,
    activeMatches,
    bracketMatches,
  };
}

export async function fetchSupabaseLiveSnapshot(
  client: SupabaseClient,
): Promise<LiveTournamentSnapshot | null> {
  const { data: tournamentsData, error: tourneyError } = await client
    .from("tournaments")
    .select("*")
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1);

  if (tourneyError !== null || tournamentsData === null || tournamentsData.length === 0) {
    return null;
  }

  const tournament = tournamentsData[0] as TournamentRow;

  const [poolsRes, teamsRes, membershipsRes, matchesRes] = await Promise.all([
    client.from("pools").select("*").eq("tournament_id", tournament.id),
    client.from("teams").select("*").eq("tournament_id", tournament.id),
    client.from("pool_memberships").select("*").eq("tournament_id", tournament.id),
    client.from("matches").select("*").eq("tournament_id", tournament.id),
  ]);

  const pools = (poolsRes.data ?? []) as PoolRow[];
  const teams = (teamsRes.data ?? []) as TeamRow[];
  const memberships = (membershipsRes.data ?? []) as PoolMembershipRow[];
  const matches = (matchesRes.data ?? []) as MatchRow[];

  if (teams.length === 0 && pools.length === 0) {
    return null;
  }

  return buildSnapshotFromSupabaseRows({
    tournament,
    pools,
    teams,
    memberships,
    matches,
  });
}

export function subscribeToLiveChannels(params: {
  onAnnouncement: (event: LiveAnnouncementEvent) => void;
  onSnapshotUpdate: (snapshot: LiveTournamentSnapshot) => void;
  onConnectionModeChange: (mode: RealtimeConnectionMode) => void;
}): () => void {
  const { onAnnouncement, onSnapshotUpdate, onConnectionModeChange } = params;
  const cleanups: Array<() => void> = [];

  // 1. BroadcastChannel cross-tab local (`coincheirb-live`)
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    try {
      const channel = new BroadcastChannel(LIVE_BROADCAST_CHANNEL_NAME);
      channel.onmessage = (message: MessageEvent<unknown>) => {
        const normalized = normalizeAnnouncementEvent(message.data);
        if (normalized !== null) {
          onAnnouncement(normalized);
        }
      };
      cleanups.push(() => {
        channel.close();
      });
    } catch {
      // Ignore si BroadcastChannel bloque par le contexte navigateur
    }
  }

  // 2. Fallback localStorage cross-tab (`storage` event)
  if (typeof window !== "undefined") {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || !LIVE_STORAGE_KEYS.includes(event.key)) {
        return;
      }
      if (event.newValue === null) {
        return;
      }
      try {
        const parsed: unknown = JSON.parse(event.newValue);
        const normalized = normalizeAnnouncementEvent(parsed);
        if (normalized !== null) {
          onAnnouncement(normalized);
        }
      } catch {
        // Ignore payload JSON malforme
      }
    };
    window.addEventListener("storage", handleStorage);
    cleanups.push(() => {
      window.removeEventListener("storage", handleStorage);
    });
  }

  // 3. Supabase Realtime (si configure), sinon bascule demo temps reel
  const supabase = getOptionalBrowserSupabaseClient();
  if (supabase === null) {
    onConnectionModeChange("demo");
    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }

  onConnectionModeChange("connecting");
  let active = true;

  const refreshFromSupabase = async () => {
    const fresh = await fetchSupabaseLiveSnapshot(supabase);
    if (!active) {
      return;
    }
    if (fresh !== null) {
      onSnapshotUpdate(fresh);
    } else {
      onSnapshotUpdate(buildDemoTournamentSnapshot());
    }
  };

  void refreshFromSupabase();

  const realtimeChannel = supabase
    .channel("coincheirb-projector-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "live_announcements" },
      (payload) => {
        const row = payload.new as LiveAnnouncementRow;
        const normalized = normalizeAnnouncementEvent(row);
        if (normalized !== null) {
          onAnnouncement(normalized);
        }
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "live_announcements" },
      (payload) => {
        const row = payload.new as LiveAnnouncementRow;
        const normalized = normalizeAnnouncementEvent(row);
        if (normalized !== null) {
          onAnnouncement(normalized);
        }
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "matches" },
      () => {
        void refreshFromSupabase();
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "pool_memberships" },
      () => {
        void refreshFromSupabase();
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tournaments" },
      () => {
        void refreshFromSupabase();
      },
    )
    .subscribe((status) => {
      if (!active) {
        return;
      }
      if (status === "SUBSCRIBED") {
        onConnectionModeChange("supabase");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onConnectionModeChange("demo");
      }
    });

  cleanups.push(() => {
    active = false;
    void supabase.removeChannel(realtimeChannel);
  });

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
