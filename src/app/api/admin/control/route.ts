import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import {
  assertTrustedMutationOrigin,
  buildSafeErrorResponse,
  getHashedRequestClientKey,
} from "@/lib/security/http";
import { checkServerRateLimit } from "@/lib/security/rate-limit";
import { sanitizePlainName } from "@/lib/security/sanitize";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  computePoolStandings,
  generateKnockoutBracket,
  generatePoolsAndSchedule,
  resolveGoogleSheetsCsvUrl,
  resolvePoolQualifications,
  type CompletedPoolMatchInput,
  type GeneratedPool,
  type TournamentTeamInput,
} from "@/lib/tournament";
import type { MatchRow, PoolRow, TeamRow, TournamentRow } from "@/types/database";

const togglePlayerScoreEditingSchema = z.object({
  action: z.literal("toggle_player_score_editing"),
  tournamentId: z.string().min(1).max(80),
  enabled: z.boolean(),
});

const forceMatchOverrideSchema = z.object({
  action: z.literal("force_match_override"),
  tournamentId: z.string().min(1).max(80),
  matchId: z.string().min(1).max(80),
  scoreTeamA: z.number().int().min(0).max(5000),
  scoreTeamB: z.number().int().min(0).max(5000),
  status: z.enum(["pending", "in_progress", "completed", "forfeit", "bye"]),
  lockedByAdmin: z.boolean(),
  forfeitTeamId: z.string().min(1).max(80).nullable(),
});

const handleRefereeAlertSchema = z.object({
  action: z.literal("handle_referee_alert"),
  tournamentId: z.string().min(1).max(80),
  alertId: z.string().min(1).max(80),
  resolution: z.enum(["acknowledge", "resolve", "confirm_forfeit"]),
  matchId: z.string().min(1).max(80).optional(),
  forfeitTeamId: z.string().min(1).max(80).nullable().optional(),
});

const generatePoolsActionSchema = z.object({
  action: z.literal("generate_pools"),
  tournamentId: z.string().min(1).max(80),
  startsAtTimeLabel: z.string().trim().min(2).max(20).default("18h30"),
  dealsPerMatch: z.number().int().min(1).max(15).default(5),
  teams: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        teamName: z.string().trim().min(2).max(60),
        normalizedName: z.string().trim().min(1).max(60),
        player1Name: z.string().trim().min(2).max(60),
        player2Name: z.string().trim().min(2).max(60),
        checkedIn: z.boolean(),
        isForfeit: z.boolean(),
        seedOrder: z.number().int().nullable(),
      }),
    )
    .min(4)
    .max(120)
    .optional(),
});

const advanceToRoundOf16Schema = z.object({
  action: z.literal("advance_to_round_of_16"),
  tournamentId: z.string().min(1).max(80),
  roundOf16Threshold: z.number().int().min(4).max(32).default(12),
  pools: z
    .array(
      z.object({
        poolNumber: z.number().int().min(1).max(40),
        poolLabel: z.string().trim().min(1).max(40),
        size: z.number().int().min(2).max(12),
        assignedTableStart: z.number().int().min(1).max(100),
        assignedTableCount: z.number().int().min(1).max(50),
        teams: z.array(
          z.object({
            teamId: z.string().min(1).max(80),
            teamName: z.string().trim().min(1).max(60),
            positionInPool: z.number().int().min(1).max(20),
          }),
        ),
      }),
    )
    .optional(),
  teams: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        teamName: z.string().trim().min(2).max(60),
        normalizedName: z.string().trim().min(1).max(60),
        player1Name: z.string().trim().min(2).max(60),
        player2Name: z.string().trim().min(2).max(60),
        checkedIn: z.boolean(),
        isForfeit: z.boolean(),
        seedOrder: z.number().int().nullable(),
      }),
    )
    .optional(),
  matches: z
    .array(
      z.object({
        poolNumber: z.number().int().min(1).max(40),
        teamAId: z.string().min(1).max(80),
        teamBId: z.string().min(1).max(80),
        scoreTeamA: z.number().int().min(0).max(5000),
        scoreTeamB: z.number().int().min(0).max(5000),
        status: z.enum(["pending", "in_progress", "completed", "forfeit", "bye"]),
        winnerTeamId: z.string().min(1).max(80).nullable(),
        forfeitTeamId: z.string().min(1).max(80).nullable(),
      }),
    )
    .optional(),
});

const pushLiveAnnouncementSchema = z.object({
  action: z.literal("push_live_announcement"),
  tournamentId: z.string().min(1).max(80),
  matchId: z.string().min(1).max(80),
  tableNumber: z.number().int().min(1).max(100),
  teamId: z.string().min(1).max(80).nullable(),
  teamNameSnapshot: z.string().trim().min(2).max(60),
  announcementType: z.enum(["capot", "generale", "coinche", "surcoinche"]),
  phase: z.enum(["announced", "passed", "failed"]),
  pointsAwarded: z.number().int().min(0).max(3000).nullable(),
});

const fetchGoogleSheetsCsvSchema = z.object({
  action: z.literal("fetch_google_sheets_csv"),
  googleSheetsUrl: z.string().trim().url().max(500),
});

const adminControlActionSchema = z.discriminatedUnion("action", [
  togglePlayerScoreEditingSchema,
  forceMatchOverrideSchema,
  handleRefereeAlertSchema,
  generatePoolsActionSchema,
  advanceToRoundOf16Schema,
  pushLiveAnnouncementSchema,
  fetchGoogleSheetsCsvSchema,
]);

function isUuidString(candidate: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    candidate,
  );
}

/**
 * Endpoint centralise de pilotage Administrateur Coinch'Eirb :
 * - Verification obligatoire de la session et du role `admin` via `requireAdmin()`
 * - Validation stricte de la charge utile avec Zod
 * - Protection anti-abus via `checkServerRateLimit()`
 * - Actions supportees :
 *   1. `toggle_player_score_editing` : verrouiller / deverrouiller la saisie des scores par les joueurs
 *   2. `force_match_override` : edition forcee des scores, verrouillage d'une table ou declaration de forfait
 *   3. `handle_referee_alert` : prise en charge, resolution ou validation d'abandon sur alerte arbitre
 *   4. `generate_pools` : cloture du check-in et generation deterministe des poules et tables (18h30)
 *   5. `advance_to_round_of_16` : qualification (3 premiers + meilleur 4e au goal-average / poule la plus forte) et generation des Huitiemes
 *   6. `push_live_announcement` : emission d'une annonce rectificative vers l'ecran `/live`
 *   7. `fetch_google_sheets_csv` : telechargement securise anti-SSRF d'un Google Sheets publie en CSV
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertTrustedMutationOrigin(request);
    const bucketKey = getHashedRequestClientKey(request, "admin-control");
    const rateDecision = await checkServerRateLimit({
      bucketKey,
      maxAttempts: 60,
      windowSeconds: 60,
      blockSeconds: 180,
    });

    if (!rateDecision.allowed) {
      return NextResponse.json(
        {
          error:
            "Limitation de debit atteinte sur les commandes d'administration. Patientez quelques secondes.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateDecision.retryAfterSeconds),
          },
        },
      );
    }

    const adminContext = await requireAdmin();

    const rawBody: unknown = await request.json();
    const parsed = adminControlActionSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Charge utile d'administration invalide. Verifiez les champs envoyes.",
        },
        { status: 400 },
      );
    }

    const payload = parsed.data;

    if (payload.action === "fetch_google_sheets_csv") {
      let safeCsvUrl: string;
      try {
        safeCsvUrl = resolveGoogleSheetsCsvUrl(payload.googleSheetsUrl);
      } catch (urlError) {
        let message = "URL Google Sheets invalide.";
        if (urlError instanceof Error) {
          message = urlError.message;
        }
        return NextResponse.json({ error: message }, { status: 400 });
      }

      const response = await fetch(safeCsvUrl, {
        method: "GET",
        redirect: "follow",
        headers: {
          Accept: "text/csv,text/plain;q=0.9",
        },
      });

      if (!response.ok) {
        return NextResponse.json(
          {
            error:
              "Impossible de lire ce document Google Sheets. Verifiez qu'il est publie sur le Web au format CSV.",
          },
          { status: 422 },
        );
      }

      const csvText = await response.text();
      if (csvText.length > 200_000) {
        return NextResponse.json(
          { error: "Le fichier CSV depasse la taille maximale autorisee." },
          { status: 413 },
        );
      }

      return NextResponse.json(
        {
          action: payload.action,
          csvText,
        },
        { status: 200 },
      );
    }

    if (payload.action === "toggle_player_score_editing") {
      let persistedInDatabase = false;
      if (isUuidString(payload.tournamentId)) {
        try {
          const adminClient = createSupabaseAdminClient();
          const { error } = await adminClient
            .from("tournaments")
            .update({
              player_score_editing_enabled: payload.enabled,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payload.tournamentId);

          if (error === null) {
            persistedInDatabase = true;
          }
        } catch {
          persistedInDatabase = false;
        }
      }

      return NextResponse.json(
        {
          action: payload.action,
          persistedInDatabase,
          playerScoreEditingEnabled: payload.enabled,
          actorProfileId: adminContext.userId,
        },
        { status: 200 },
      );
    }

    if (payload.action === "force_match_override") {
      let winnerTeamId: string | null = null;
      let persistedInDatabase = false;

      if (isUuidString(payload.matchId)) {
        try {
          const adminClient = createSupabaseAdminClient();
          const { data: matchRowData } = await adminClient
            .from("matches")
            .select("*")
            .eq("id", payload.matchId)
            .single();

          if (matchRowData !== null) {
            const matchRow = matchRowData as MatchRow;
            if (payload.status === "forfeit" && payload.forfeitTeamId !== null) {
              if (payload.forfeitTeamId === matchRow.team_a_id) {
                winnerTeamId = matchRow.team_b_id;
              } else if (payload.forfeitTeamId === matchRow.team_b_id) {
                winnerTeamId = matchRow.team_a_id;
              }
            } else if (payload.status === "completed") {
              if (payload.scoreTeamA > payload.scoreTeamB) {
                winnerTeamId = matchRow.team_a_id;
              } else if (payload.scoreTeamB > payload.scoreTeamA) {
                winnerTeamId = matchRow.team_b_id;
              }
            }

            let completedAtValue: string | null = matchRow.completed_at;
            if (payload.status === "completed" || payload.status === "forfeit") {
              completedAtValue = new Date().toISOString();
            }

            const { error: updateError } = await adminClient
              .from("matches")
              .update({
                score_team_a: payload.scoreTeamA,
                score_team_b: payload.scoreTeamB,
                status: payload.status,
                locked_by_admin: payload.lockedByAdmin,
                forfeit_team_id: payload.forfeitTeamId,
                winner_team_id: winnerTeamId,
                is_direct_final_score: true,
                updated_by_role: "admin",
                completed_at: completedAtValue,
                updated_at: new Date().toISOString(),
              })
              .eq("id", payload.matchId);

            if (updateError === null) {
              persistedInDatabase = true;
            }

            if (payload.status === "forfeit" && payload.forfeitTeamId !== null) {
              await adminClient
                .from("teams")
                .update({
                  is_forfeit: true,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", payload.forfeitTeamId);
            }
          }
        } catch {
          persistedInDatabase = false;
        }
      }

      return NextResponse.json(
        {
          action: payload.action,
          persistedInDatabase,
          matchId: payload.matchId,
          scoreTeamA: payload.scoreTeamA,
          scoreTeamB: payload.scoreTeamB,
          status: payload.status,
          lockedByAdmin: payload.lockedByAdmin,
          forfeitTeamId: payload.forfeitTeamId,
          winnerTeamId,
        },
        { status: 200 },
      );
    }

    if (payload.action === "handle_referee_alert") {
      let nextAlertStatus: "acknowledged" | "resolved" = "acknowledged";
      if (
        payload.resolution === "resolve" ||
        payload.resolution === "confirm_forfeit"
      ) {
        nextAlertStatus = "resolved";
      }

      let persistedInDatabase = false;
      if (isUuidString(payload.alertId)) {
        try {
          const adminClient = createSupabaseAdminClient();
          let resolvedAt: string | null = null;
          if (nextAlertStatus === "resolved") {
            resolvedAt = new Date().toISOString();
          }

          const { error } = await adminClient
            .from("referee_alerts")
            .update({
              status: nextAlertStatus,
              resolved_by: adminContext.userId,
              resolved_at: resolvedAt,
            })
            .eq("id", payload.alertId);

          if (error === null) {
            persistedInDatabase = true;
          }

          if (
            payload.resolution === "confirm_forfeit" &&
            payload.matchId !== undefined &&
            isUuidString(payload.matchId) &&
            payload.forfeitTeamId !== undefined &&
            payload.forfeitTeamId !== null
          ) {
            await adminClient
              .from("teams")
              .update({
                is_forfeit: true,
                updated_at: new Date().toISOString(),
              })
              .eq("id", payload.forfeitTeamId);
          }
        } catch {
          persistedInDatabase = false;
        }
      }

      return NextResponse.json(
        {
          action: payload.action,
          persistedInDatabase,
          alertId: payload.alertId,
          nextStatus: nextAlertStatus,
          resolution: payload.resolution,
        },
        { status: 200 },
      );
    }

    if (payload.action === "generate_pools") {
      let teamsToSchedule: TournamentTeamInput[] = [];
      let persistedInDatabase = false;

      if (payload.teams !== undefined && payload.teams.length >= 4) {
        teamsToSchedule = payload.teams;
      } else if (isUuidString(payload.tournamentId)) {
        try {
          const adminClient = createSupabaseAdminClient();
          const { data: teamRows } = await adminClient
            .from("teams")
            .select("*")
            .eq("tournament_id", payload.tournamentId);

          if (Array.isArray(teamRows)) {
            teamsToSchedule = teamRows.map((raw) => {
              const row = raw as TeamRow;
              return {
                id: row.id,
                teamName: row.team_name,
                normalizedName: row.normalized_name,
                player1Name: row.player_1_name,
                player2Name: row.player_2_name,
                checkedIn: row.checked_in,
                isForfeit: row.is_forfeit,
                seedOrder: row.seed_order,
              };
            });
          }
        } catch {
          teamsToSchedule = [];
        }
      }

      const plan = generatePoolsAndSchedule(teamsToSchedule, {
        dealsPerMatch: payload.dealsPerMatch,
        startsAtTimeLabel: payload.startsAtTimeLabel,
      });

      if (isUuidString(payload.tournamentId)) {
        try {
          const adminClient = createSupabaseAdminClient();
          const { error: tournamentErr } = await adminClient
            .from("tournaments")
            .update({
              status: "pools",
              registrations_locked: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payload.tournamentId);

          if (tournamentErr === null) {
            persistedInDatabase = true;
          }
        } catch {
          persistedInDatabase = false;
        }
      }

      return NextResponse.json(
        {
          action: payload.action,
          persistedInDatabase,
          plan,
        },
        { status: 200 },
      );
    }

    if (payload.action === "advance_to_round_of_16") {
      let poolsInput: GeneratedPool[] = [];
      let teamsInput: TournamentTeamInput[] = [];
      let matchesInput: CompletedPoolMatchInput[] = [];
      let threshold = payload.roundOf16Threshold;
      let persistedInDatabase = false;

      if (
        payload.pools !== undefined &&
        payload.teams !== undefined &&
        payload.matches !== undefined
      ) {
        poolsInput = payload.pools;
        teamsInput = payload.teams;
        matchesInput = payload.matches;
      } else if (isUuidString(payload.tournamentId)) {
        try {
          const adminClient = createSupabaseAdminClient();
          const { data: tournamentData } = await adminClient
            .from("tournaments")
            .select("*")
            .eq("id", payload.tournamentId)
            .single();

          if (tournamentData !== null) {
            const tRow = tournamentData as TournamentRow;
            threshold = tRow.round_of_16_threshold;
          }

          const { data: poolRowsData } = await adminClient
            .from("pools")
            .select("*")
            .eq("tournament_id", payload.tournamentId)
            .order("pool_number", { ascending: true });

          const { data: teamRowsData } = await adminClient
            .from("teams")
            .select("*")
            .eq("tournament_id", payload.tournamentId);

          const { data: matchRowsData } = await adminClient
            .from("matches")
            .select("*")
            .eq("tournament_id", payload.tournamentId)
            .eq("phase", "pool");

          const poolNumberById = new Map<string, number>();
          if (Array.isArray(poolRowsData) && Array.isArray(teamRowsData)) {
            teamsInput = teamRowsData.map((raw) => {
              const row = raw as TeamRow;
              return {
                id: row.id,
                teamName: row.team_name,
                normalizedName: row.normalized_name,
                player1Name: row.player_1_name,
                player2Name: row.player_2_name,
                checkedIn: row.checked_in,
                isForfeit: row.is_forfeit,
                seedOrder: row.seed_order,
              };
            });

            poolsInput = poolRowsData.map((rawPool) => {
              const pRow = rawPool as PoolRow;
              poolNumberById.set(pRow.id, pRow.pool_number);
              const poolTeams = (teamRowsData as TeamRow[])
                .filter((t) => t.pool_id === pRow.id)
                .map((t, index) => ({
                  teamId: t.id,
                  teamName: t.team_name,
                  positionInPool: index + 1,
                }));

              return {
                poolNumber: pRow.pool_number,
                poolLabel: pRow.pool_label,
                size: pRow.size,
                assignedTableStart: pRow.assigned_table_start,
                assignedTableCount: Math.max(1, Math.floor(pRow.size / 2)),
                teams: poolTeams,
              };
            });
          }

          if (Array.isArray(matchRowsData)) {
            for (const rawMatch of matchRowsData) {
              const mRow = rawMatch as MatchRow;
              if (
                mRow.pool_id !== null &&
                mRow.team_a_id !== null &&
                mRow.team_b_id !== null
              ) {
                const poolNum = poolNumberById.get(mRow.pool_id);
                if (poolNum !== undefined) {
                  matchesInput.push({
                    poolNumber: poolNum,
                    teamAId: mRow.team_a_id,
                    teamBId: mRow.team_b_id,
                    scoreTeamA: mRow.score_team_a,
                    scoreTeamB: mRow.score_team_b,
                    status: mRow.status,
                    winnerTeamId: mRow.winner_team_id,
                    forfeitTeamId: mRow.forfeit_team_id,
                  });
                }
              }
            }
          }
        } catch {
          poolsInput = [];
        }
      }

      if (poolsInput.length === 0) {
        return NextResponse.json(
          {
            error:
              "Aucune poule disponible pour calculer les qualifications en phase finale.",
          },
          { status: 400 },
        );
      }

      const standings = computePoolStandings(
        poolsInput,
        teamsInput,
        matchesInput,
      );
      const qualification = resolvePoolQualifications(standings, threshold);
      const bracketNodes = generateKnockoutBracket({
        format: qualification.format,
        qualifiedTeams: qualification.qualifiedTeams,
      });

      if (isUuidString(payload.tournamentId)) {
        try {
          const adminClient = createSupabaseAdminClient();
          const { error } = await adminClient
            .from("tournaments")
            .update({
              status: qualification.format.startingPhase,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payload.tournamentId);

          if (error === null) {
            persistedInDatabase = true;
          }
        } catch {
          persistedInDatabase = false;
        }
      }

      return NextResponse.json(
        {
          action: payload.action,
          persistedInDatabase,
          qualification,
          bracketNodes,
        },
        { status: 200 },
      );
    }

    // Action: push_live_announcement
    const sanitizedTeamSnapshot = sanitizePlainName(payload.teamNameSnapshot);
    let persistedInDatabase = false;

    if (
      isUuidString(payload.tournamentId) &&
      isUuidString(payload.matchId)
    ) {
      try {
        const adminClient = createSupabaseAdminClient();
        let resolvedAt: string | null = null;
        if (payload.phase !== "announced") {
          resolvedAt = new Date().toISOString();
        }

        const { error } = await adminClient
          .from("live_announcements")
          .insert({
            tournament_id: payload.tournamentId,
            match_id: payload.matchId,
            table_number: payload.tableNumber,
            team_id: payload.teamId,
            team_name_snapshot: sanitizedTeamSnapshot,
            announcement_type: payload.announcementType,
            phase: payload.phase,
            points_awarded: payload.pointsAwarded,
            resolved_at: resolvedAt,
          });

        if (error === null) {
          persistedInDatabase = true;
        }
      } catch {
        persistedInDatabase = false;
      }
    }

    return NextResponse.json(
      {
        action: payload.action,
        persistedInDatabase,
        announcement: {
          tableNumber: payload.tableNumber,
          teamNameSnapshot: sanitizedTeamSnapshot,
          announcementType: payload.announcementType,
          phase: payload.phase,
          pointsAwarded: payload.pointsAwarded,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return buildSafeErrorResponse(error);
  }
}
