import { NextResponse, type NextRequest } from "next/server";
import { requireMatchAccess } from "@/lib/auth/guards";
import {
  assertTrustedMutationOrigin,
  buildSafeErrorResponse,
  getHashedRequestClientKey,
} from "@/lib/security/http";
import { checkServerRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { evaluateMatchProgress } from "@/lib/tournament/scoring";
import {
  directFinalScoreSchema,
  matchDealSubmissionSchema,
} from "@/lib/validation/schemas";
import type { MatchDealRow } from "@/types/database";

/**
 * Saisie securisee d'une donne (POST) ou d'un score final direct (PUT) sur un match :
 * - Verification serveur anti-IDOR (`requireMatchAccess`)
 * - Verification du verrouillage global et par table
 * - Recalcul automatique du cumul et detection de la 6e donne de departage en poule.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ matchId: string }> },
): Promise<NextResponse> {
  try {
    assertTrustedMutationOrigin(request);
    const { matchId } = await context.params;
    const bucketKey = getHashedRequestClientKey(
      request,
      `match-score:${matchId}`,
    );
    const rateDecision = await checkServerRateLimit({
      bucketKey,
      maxAttempts: 30,
      windowSeconds: 60,
      blockSeconds: 120,
    });

    if (!rateDecision.allowed) {
      return NextResponse.json(
        { error: "Cadence de saisie trop elevee. Patientez quelques secondes." },
        { status: 429 },
      );
    }

    const access = await requireMatchAccess(matchId, { requireWrite: true });
    const body: unknown = await request.json();
    const parsed = matchDealSubmissionSchema.safeParse(
      Object.assign({}, body, { matchId }),
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Donnees de donne invalides." },
        { status: 400 },
      );
    }

    const adminClient = createSupabaseAdminClient();
    let isTiebreakerDeal = false;
    if (
      access.match.phase === "pool" &&
      parsed.data.dealNumber > access.tournament.deals_per_pool_match
    ) {
      isTiebreakerDeal = true;
    }

    await adminClient.from("match_deals").upsert(
      {
        tournament_id: access.match.tournament_id,
        match_id: matchId,
        deal_number: parsed.data.dealNumber,
        points_team_a: parsed.data.pointsTeamA,
        points_team_b: parsed.data.pointsTeamB,
        is_tiebreaker_deal: isTiebreakerDeal,
        special_announcement: parsed.data.specialAnnouncement ?? null,
        announcement_outcome: parsed.data.announcementOutcome ?? null,
        parlante_penalty: parsed.data.parlantePenalty,
        recorded_by_team_id: access.actingTeamId,
      },
      { onConflict: "match_id,deal_number" },
    );

    const { data: allDealsData } = await adminClient
      .from("match_deals")
      .select("*")
      .eq("match_id", matchId)
      .order("deal_number", { ascending: true });

    const allDeals = (allDealsData ?? []) as MatchDealRow[];
    let totalA = 0;
    let totalB = 0;
    for (const deal of allDeals) {
      totalA += deal.points_team_a;
      totalB += deal.points_team_b;
    }

    const progress = evaluateMatchProgress({
      phase: access.match.phase,
      scoreTeamA: totalA,
      scoreTeamB: totalB,
      dealsPlayed: allDeals.length,
      dealsPerPoolMatch: access.tournament.deals_per_pool_match,
      targetScore: access.match.target_score,
      isDirectFinalScore: false,
    });

    let winnerTeamId: string | null = null;
    if (progress.winnerSide === "team_a") {
      winnerTeamId = access.match.team_a_id;
    } else if (progress.winnerSide === "team_b") {
      winnerTeamId = access.match.team_b_id;
    }

    let completedAt: string | null = null;
    if (progress.status === "completed") {
      completedAt = new Date().toISOString();
    }

    await adminClient
      .from("matches")
      .update({
        score_team_a: totalA,
        score_team_b: totalB,
        deals_played: allDeals.length,
        is_direct_final_score: false,
        status: progress.status,
        winner_team_id: winnerTeamId,
        completed_at: completedAt,
        updated_by_role: access.actorType,
      })
      .eq("id", matchId);

    return NextResponse.json(
      {
        matchId,
        scoreTeamA: totalA,
        scoreTeamB: totalB,
        dealsPlayed: allDeals.length,
        status: progress.status,
        requiresTiebreakerDeal: progress.requiresTiebreakerDeal,
        winnerTeamId,
      },
      { status: 200 },
    );
  } catch (error) {
    return buildSafeErrorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ matchId: string }> },
): Promise<NextResponse> {
  try {
    assertTrustedMutationOrigin(request);
    const { matchId } = await context.params;
    const access = await requireMatchAccess(matchId, { requireWrite: true });

    const body: unknown = await request.json();
    const parsed = directFinalScoreSchema.safeParse(
      Object.assign({}, body, { matchId }),
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Score final direct invalide." },
        { status: 400 },
      );
    }

    const progress = evaluateMatchProgress({
      phase: access.match.phase,
      scoreTeamA: parsed.data.scoreTeamA,
      scoreTeamB: parsed.data.scoreTeamB,
      dealsPlayed: access.match.deals_played,
      isDirectFinalScore: true,
    });

    let winnerTeamId: string | null = null;
    if (progress.winnerSide === "team_a") {
      winnerTeamId = access.match.team_a_id;
    } else if (progress.winnerSide === "team_b") {
      winnerTeamId = access.match.team_b_id;
    }

    const adminClient = createSupabaseAdminClient();
    await adminClient
      .from("matches")
      .update({
        score_team_a: parsed.data.scoreTeamA,
        score_team_b: parsed.data.scoreTeamB,
        is_direct_final_score: true,
        status: progress.status,
        winner_team_id: winnerTeamId,
        completed_at: new Date().toISOString(),
        updated_by_role: access.actorType,
      })
      .eq("id", matchId);

    return NextResponse.json(
      {
        matchId,
        scoreTeamA: parsed.data.scoreTeamA,
        scoreTeamB: parsed.data.scoreTeamB,
        status: progress.status,
        winnerTeamId,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("egalite")) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return buildSafeErrorResponse(error);
  }
}
