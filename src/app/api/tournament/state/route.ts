import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  AuthGuardError,
  getOptionalAuthenticatedProfile,
  requireAdmin,
} from "@/lib/auth/guards";
import {
  getClubAccountFromCookie,
  getTableScorerFromCookie,
} from "@/lib/auth/session";
import {
  doesClubAccountPlayAtTable,
  evaluateTableScorerAccess,
} from "@/lib/auth/table-code";
import {
  assertTrustedMutationOrigin,
  buildSafeErrorResponse,
  getHashedRequestClientKey,
} from "@/lib/security/http";
import { checkServerRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createDefaultUnifiedTournamentState,
  findUnifiedTeam,
  type UnifiedTournamentState,
} from "@/lib/tournament/live-store-types";
import {
  ReducerLockError,
  applyDirectFinalScoreReducer,
  applyEditDealReducer,
  applyLiveAnnouncementReducer,
  applyRecordDealReducer,
  applyTableAlertReducer,
  isValidUnifiedTournamentState,
} from "@/lib/tournament/state-reducers";

export const dynamic = "force-dynamic";

const SNAPSHOT_ID = "active-tournament";
const MAX_SNAPSHOT_BYTES = 1_600_000;

function isSupabaseRealtimeConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url === undefined || anon === undefined || service === undefined) {
    return false;
  }
  if (
    url.length < 16 ||
    anon.length < 20 ||
    service.length < 20 ||
    url.includes("your-project-ref")
  ) {
    return false;
  }
  return true;
}

const announcementTypeSchema = z.enum([
  "capot",
  "generale",
  "coinche",
  "surcoinche",
]);
const announcementOutcomeSchema = z.enum(["passed", "failed"]);
const livePopupPhaseSchema = z.enum(["announced", "passed", "failed"]);
const alertTypeSchema = z.enum(["referee_call", "abandon_request"]);

const syncActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("record_deal"),
    payload: z.object({
      matchId: z.string().min(1).max(120),
      pointsTeamA: z.number().int().min(0).max(5000),
      pointsTeamB: z.number().int().min(0).max(5000),
      specialAnnouncement: announcementTypeSchema.nullable(),
      announcementOutcome: announcementOutcomeSchema.nullable(),
      parlantePenalty: z.boolean(),
    }),
  }),
  z.object({
    action: z.literal("edit_deal"),
    payload: z.object({
      matchId: z.string().min(1).max(120),
      dealId: z.string().min(1).max(120),
      pointsTeamA: z.number().int().min(0).max(5000),
      pointsTeamB: z.number().int().min(0).max(5000),
      parlantePenalty: z.boolean(),
    }),
  }),
  z.object({
    action: z.literal("record_direct_score"),
    payload: z.object({
      matchId: z.string().min(1).max(120),
      scoreTeamA: z.number().int().min(0).max(5000),
      scoreTeamB: z.number().int().min(0).max(5000),
    }),
  }),
  z.object({
    action: z.literal("submit_alert"),
    payload: z.object({
      matchId: z.string().min(1).max(120),
      tableNumber: z.number().int().min(1).max(99),
      teamId: z.string().min(1).max(120),
      teamName: z.string().min(1).max(120),
      alertType: alertTypeSchema,
      message: z.string().min(1).max(300),
      applyImmediateForfeit: z.boolean(),
    }),
  }),
  z.object({
    action: z.literal("broadcast_announcement"),
    payload: z.object({
      announcementId: z.string().min(1).max(120),
      matchId: z.string().min(1).max(120),
      tableNumber: z.number().int().min(1).max(99),
      teamId: z.string().max(120).nullable(),
      teamName: z.string().min(1).max(120),
      opponentName: z.string().max(120).nullable(),
      announcementType: announcementTypeSchema,
      phase: livePopupPhaseSchema,
      pointsAwarded: z.number().int().min(0).max(5000).nullable(),
      contractNote: z.string().max(160).nullable(),
    }),
  }),
  z.object({
    action: z.literal("broadcast_special_event"),
    payload: z.object({
      specialKind: z.enum(["elimination", "champion", "first_deal"]),
      tableNumber: z.number().int().min(1).max(99),
      teamName: z.string().min(1).max(120),
      opponentName: z.string().max(120).nullable(),
      pointsAwarded: z.number().int().min(0).max(5000).nullable(),
      customHeadline: z.string().min(1).max(120),
      customBadge: z.string().min(1).max(120),
      contractNote: z.string().max(160).nullable(),
    }),
  }),
  z.object({
    action: z.literal("admin_replace_state"),
    payload: z.object({
      state: z.unknown(),
    }),
  }),
]);

interface SnapshotRow {
  id: string;
  revision: number;
  state_json: unknown;
  last_event_json: unknown;
  updated_at: string;
}

export async function GET(): Promise<NextResponse> {
  if (!isSupabaseRealtimeConfigured()) {
    return NextResponse.json(
      {
        mode: "local_fallback",
        revision: 0,
        state: null,
        lastEvent: null,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient
      .from("tournament_live_snapshots")
      .select("id, revision, state_json, last_event_json, updated_at")
      .eq("id", SNAPSHOT_ID)
      .maybeSingle();

    if (error !== null) {
      return NextResponse.json(
        {
          mode: "local_fallback",
          revision: 0,
          state: null,
          lastEvent: null,
          reason: "snapshot_table_unavailable",
        },
        {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    if (data === null) {
      return NextResponse.json(
        {
          mode: "supabase",
          revision: 0,
          state: null,
          lastEvent: null,
        },
        {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const row = data as SnapshotRow;
    if (!isValidUnifiedTournamentState(row.state_json)) {
      return NextResponse.json(
        {
          mode: "supabase",
          revision: row.revision,
          state: null,
          lastEvent: null,
        },
        {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    return NextResponse.json(
      {
        mode: "supabase",
        revision: row.revision,
        state: row.state_json,
        lastEvent: row.last_event_json ?? null,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      {
        mode: "local_fallback",
        revision: 0,
        state: null,
        lastEvent: null,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertTrustedMutationOrigin(request);

    const rateDecision = await checkServerRateLimit({
      bucketKey: getHashedRequestClientKey(request, "tournament_state_sync"),
      maxAttempts: 90,
      windowSeconds: 60,
      blockSeconds: 30,
    });
    if (!rateDecision.allowed) {
      return NextResponse.json(
        {
          error: "Trop de requêtes de synchronisation. Patientez quelques secondes.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateDecision.retryAfterSeconds),
          },
        },
      );
    }

    if (!isSupabaseRealtimeConfigured()) {
      return NextResponse.json(
        { mode: "local_fallback", synced: false },
        { status: 200 },
      );
    }

    const rawText = await request.text();
    if (rawText.length > MAX_SNAPSHOT_BYTES) {
      return NextResponse.json(
        { error: "Payload de synchronisation trop volumineux." },
        { status: 413 },
      );
    }

    let rawJson: unknown = null;
    try {
      rawJson = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "JSON invalide." },
        { status: 400 },
      );
    }

    const parsed = syncActionSchema.safeParse(rawJson);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Action de synchronisation non valide." },
        { status: 400 },
      );
    }

    const body = parsed.data;
    const adminClient = createSupabaseAdminClient();

    if (
      body.action === "admin_replace_state" ||
      body.action === "broadcast_special_event"
    ) {
      await requireAdmin();
    }

    const optionalAuth = await getOptionalAuthenticatedProfile();
    const isAdminActor =
      optionalAuth !== null && optionalAuth.profile.role === "admin";
    const clubAccountSession = await getClubAccountFromCookie();
    const tableScorerCookie = await getTableScorerFromCookie();

    // Boucle de concurrence optimiste (3 tentatives) pour eviter toute perte de donne simultanee
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data: existingRowData, error: fetchError } = await adminClient
        .from("tournament_live_snapshots")
        .select("id, revision, state_json, last_event_json, updated_at")
        .eq("id", SNAPSHOT_ID)
        .maybeSingle();

      if (fetchError !== null) {
        return NextResponse.json(
          { mode: "local_fallback", synced: false },
          { status: 200 },
        );
      }

      const existingRow = existingRowData as SnapshotRow | null;
      let currentRevision = 0;
      let baseState: UnifiedTournamentState =
        createDefaultUnifiedTournamentState();
      let currentLastEvent: unknown = null;

      if (existingRow !== null) {
        currentRevision = Number(existingRow.revision) || 1;
        currentLastEvent = existingRow.last_event_json ?? null;
        if (isValidUnifiedTournamentState(existingRow.state_json)) {
          baseState = existingRow.state_json;
        }
      }

      // Verification serveur anti-troll (compte joueur a la table OU cookie marqueur signe)
      let protectedMatchId: string | null = null;
      if (
        body.action === "record_deal" ||
        body.action === "edit_deal" ||
        body.action === "record_direct_score" ||
        body.action === "broadcast_announcement"
      ) {
        protectedMatchId = body.payload.matchId;
      } else if (
        body.action === "submit_alert" &&
        body.payload.applyImmediateForfeit
      ) {
        protectedMatchId = body.payload.matchId;
      }

      if (protectedMatchId !== null && !isAdminActor) {
        const targetMatch = baseState.matches.find(
          (m) => m.id === protectedMatchId,
        );
        if (targetMatch !== undefined) {
          const teamA = findUnifiedTeam(baseState.teams, targetMatch.teamAId);
          const teamB = findUnifiedTeam(baseState.teams, targetMatch.teamBId);
          const tablePlayers: string[] = [];
          if (teamA !== null) {
            tablePlayers.push(teamA.player1Name, teamA.player2Name);
          }
          if (teamB !== null) {
            tablePlayers.push(teamB.player1Name, teamB.player2Name);
          }

          let accountAtTable = false;
          if (clubAccountSession !== null) {
            accountAtTable = doesClubAccountPlayAtTable({
              accountPseudo: clubAccountSession.pseudo,
              accountFirstName: clubAccountSession.firstName,
              tablePlayerNames: tablePlayers,
            });
          }

          let activeLockHolderId: string | null = null;
          let activeLockVersion = 1;
          const { data: lockRow } = await adminClient
            .from("table_scorer_locks")
            .select("holder_id, lock_version")
            .eq("match_id", protectedMatchId)
            .maybeSingle();

          if (lockRow !== null) {
            const typedLock = lockRow as {
              holder_id?: string;
              lock_version?: number;
            };
            if (
              typeof typedLock.holder_id === "string" &&
              typedLock.holder_id !== "__released__"
            ) {
              activeLockHolderId = typedLock.holder_id;
            }
            if (typeof typedLock.lock_version === "number") {
              activeLockVersion = typedLock.lock_version;
            }
          }

          const scorerDecision = evaluateTableScorerAccess({
            isAdmin: false,
            accountPlayingAtTable: accountAtTable,
            matchId: protectedMatchId,
            cookieMatchId: tableScorerCookie?.matchId ?? null,
            cookieHolderId: tableScorerCookie?.holderId ?? null,
            cookieLockVersion: tableScorerCookie?.lockVersion ?? null,
            activeLockHolderId,
            activeLockVersion,
          });

          if (!scorerDecision.canEdit) {
            return NextResponse.json(
              { error: scorerDecision.reason },
              { status: 403 },
            );
          }
        }
      }

      let nextState = baseState;
      let nextEvent: unknown = currentLastEvent;

      if (body.action === "admin_replace_state") {
        if (!isValidUnifiedTournamentState(body.payload.state)) {
          return NextResponse.json(
            { error: "État tournoi administrateur invalide." },
            { status: 400 },
          );
        }
        nextState = {
          ...body.payload.state,
          updatedAt: new Date().toISOString(),
        };
      } else if (body.action === "broadcast_special_event") {
        let phase: "announced" | "passed" | "failed" = "announced";
        if (body.payload.specialKind === "elimination") {
          phase = "failed";
        } else if (body.payload.specialKind === "champion") {
          phase = "passed";
        }
        nextEvent = {
          id: `special-${body.payload.specialKind}-${Date.now()}`,
          specialKind: body.payload.specialKind,
          table_number: body.payload.tableNumber,
          team_name_snapshot: body.payload.teamName,
          opponentName: body.payload.opponentName,
          announcement_type: "coinche",
          phase,
          points_awarded: body.payload.pointsAwarded,
          customHeadline: body.payload.customHeadline,
          customBadge: body.payload.customBadge,
          contractNote: body.payload.contractNote,
          created_at: new Date().toISOString(),
        };
      } else if (body.action === "record_deal") {
        const outcome = applyRecordDealReducer(baseState, {
          ...body.payload,
          bypassLock: isAdminActor,
        });
        nextState = outcome.nextState;
        if (outcome.popupEvent !== null) {
          nextEvent = outcome.popupEvent;
        }
      } else if (body.action === "edit_deal") {
        const outcome = applyEditDealReducer(baseState, {
          ...body.payload,
          bypassLock: isAdminActor,
        });
        nextState = outcome.nextState;
      } else if (body.action === "record_direct_score") {
        const outcome = applyDirectFinalScoreReducer(baseState, {
          ...body.payload,
          bypassLock: isAdminActor,
        });
        nextState = outcome.nextState;
        if (outcome.popupEvent !== null) {
          nextEvent = outcome.popupEvent;
        }
      } else if (body.action === "submit_alert") {
        const outcome = applyTableAlertReducer(baseState, body.payload);
        nextState = outcome.nextState;
      } else if (body.action === "broadcast_announcement") {
        const outcome = applyLiveAnnouncementReducer(baseState, body.payload);
        nextState = outcome.nextState;
        if (outcome.popupEvent !== null) {
          nextEvent = outcome.popupEvent;
        }
      }

      const nextRevision = currentRevision + 1;

      if (existingRow === null) {
        const { error: insertError } = await adminClient
          .from("tournament_live_snapshots")
          .insert({
            id: SNAPSHOT_ID,
            revision: nextRevision,
            state_json: nextState,
            last_event_json: nextEvent,
            updated_at: new Date().toISOString(),
          });
        if (insertError === null) {
          return NextResponse.json(
            {
              mode: "supabase",
              synced: true,
              revision: nextRevision,
              state: nextState,
              lastEvent: nextEvent,
            },
            { status: 200 },
          );
        }
      } else {
        const { data: updatedRows, error: updateError } = await adminClient
          .from("tournament_live_snapshots")
          .update({
            revision: nextRevision,
            state_json: nextState,
            last_event_json: nextEvent,
            updated_at: new Date().toISOString(),
          })
          .eq("id", SNAPSHOT_ID)
          .eq("revision", currentRevision)
          .select("revision");

        if (
          updateError === null &&
          Array.isArray(updatedRows) &&
          updatedRows.length === 1
        ) {
          return NextResponse.json(
            {
              mode: "supabase",
              synced: true,
              revision: nextRevision,
              state: nextState,
              lastEvent: nextEvent,
            },
            { status: 200 },
          );
        }
      }
    }

    return NextResponse.json(
      { error: "Conflit de mise à jour simultanée, veuillez réessayer." },
      { status: 409 },
    );
  } catch (error) {
    if (error instanceof ReducerLockError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    if (error instanceof AuthGuardError) {
      return buildSafeErrorResponse(error);
    }
    return buildSafeErrorResponse(error);
  }
}
