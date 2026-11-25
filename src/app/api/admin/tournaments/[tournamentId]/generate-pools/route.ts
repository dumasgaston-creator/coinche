import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { buildSafeErrorResponse } from "@/lib/security/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generatePoolsAndSchedule } from "@/lib/tournament/pool-generator";
import type { TeamRow, TournamentRow } from "@/types/database";

/**
 * Clic Admin "Valider et generer" :
 * 1. Fige les inscriptions (`registrations_locked = true`)
 * 2. Calcule la repartition optimale pair/impair sur les equipes pointees au check-in
 * 3. Cree les poules, les appartenances et tous les matchs de poule avec leurs tables assignees.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ tournamentId: string }> },
): Promise<NextResponse> {
  try {
    await requireAdmin();
    const { tournamentId } = await context.params;
    const adminClient = createSupabaseAdminClient();

    const { data: tournamentData } = await adminClient
      .from("tournaments")
      .select("*")
      .eq("id", tournamentId)
      .single();

    if (tournamentData === null) {
      return NextResponse.json(
        { error: "Tournoi introuvable." },
        { status: 404 },
      );
    }

    const tournament = tournamentData as TournamentRow;
    if (tournament.registrations_locked) {
      return NextResponse.json(
        { error: "Les poules ont deja ete generees et verrouillees." },
        { status: 409 },
      );
    }

    const { data: teamsData } = await adminClient
      .from("teams")
      .select("*")
      .eq("tournament_id", tournamentId);

    const teamRows = (teamsData ?? []) as TeamRow[];

    const plan = generatePoolsAndSchedule(
      teamRows.map((row) => ({
        id: row.id,
        teamName: row.team_name,
        normalizedName: row.normalized_name,
        player1Name: row.player_1_name,
        player2Name: row.player_2_name,
        checkedIn: row.checked_in,
        isForfeit: row.is_forfeit,
        seedOrder: row.seed_order,
      })),
      {
        dealsPerMatch: tournament.deals_per_pool_match,
      },
    );

    const poolIdByNumber = new Map<number, string>();

    for (const pool of plan.pools) {
      const { data: createdPool, error: poolErr } = await adminClient
        .from("pools")
        .insert({
          tournament_id: tournamentId,
          pool_number: pool.poolNumber,
          pool_label: pool.poolLabel,
          size: pool.size,
          assigned_table_start: pool.assignedTableStart,
          total_points_scored: 0,
        })
        .select("id")
        .single();

      if (poolErr !== null || createdPool === null) {
        throw new Error("Echec de creation des poules en base.");
      }

      const poolId = (createdPool as { id: string }).id;
      poolIdByNumber.set(pool.poolNumber, poolId);

      for (const member of pool.teams) {
        await adminClient.from("pool_memberships").insert({
          tournament_id: tournamentId,
          pool_id: poolId,
          team_id: member.teamId,
          position_in_pool: member.positionInPool,
        });

        await adminClient
          .from("teams")
          .update({ pool_id: poolId })
          .eq("id", member.teamId);
      }
    }

    for (const match of plan.matches) {
      const poolId = poolIdByNumber.get(match.poolNumber) ?? null;
      await adminClient.from("matches").insert({
        tournament_id: tournamentId,
        phase: "pool",
        pool_id: poolId,
        round_number: match.roundNumber,
        table_number: match.tableNumber,
        team_a_id: match.teamAId,
        team_b_id: match.teamBId,
        max_deals: match.maxDeals,
        status: "pending",
      });
    }

    await adminClient
      .from("tournaments")
      .update({
        registrations_locked: true,
        status: "pools",
      })
      .eq("id", tournamentId);

    return NextResponse.json(
      {
        generated: true,
        totalActiveTeams: plan.totalActiveTeams,
        poolCount: plan.pools.length,
        matchCount: plan.matches.length,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("Au moins 4 equipes")) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return buildSafeErrorResponse(error);
  }
}
