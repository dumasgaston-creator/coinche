import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { generateTeamAccessCode, hashSecret } from "@/lib/auth/password";
import {
  buildSafeErrorResponse,
  getHashedRequestClientKey,
} from "@/lib/security/http";
import { checkServerRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  parseRegistrationsFromText,
  resolveGoogleSheetsCsvUrl,
} from "@/lib/tournament/csv-import";
import { importRegistrationsSchema } from "@/lib/validation/schemas";
import type { TournamentRow } from "@/types/database";

/**
 * Import serveur des inscriptions d'equipes depuis un CSV, un copier-coller Google Sheets
 * ou un lien Google Sheets publie, sans aucune cle API IA.
 * Bloque l'import si des doublons sont detectes ou si les inscriptions sont deja figees.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tournamentId: string }> },
): Promise<NextResponse> {
  try {
    await requireAdmin();
    const { tournamentId } = await context.params;

    const bucketKey = getHashedRequestClientKey(request, "admin-import");
    const rateDecision = await checkServerRateLimit({
      bucketKey,
      maxAttempts: 15,
      windowSeconds: 300,
      blockSeconds: 300,
    });

    if (!rateDecision.allowed) {
      return NextResponse.json(
        { error: "Trop de requetes d'import rapprochees." },
        { status: 429 },
      );
    }

    const body: unknown = await request.json();
    const payloadWithId = Object.assign({}, body, { tournamentId });
    const parsedInput = importRegistrationsSchema.safeParse(payloadWithId);

    if (!parsedInput.success) {
      return NextResponse.json(
        { error: "Parametres d'import invalides." },
        { status: 400 },
      );
    }

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
        { error: "Les inscriptions de ce tournoi sont deja figees." },
        { status: 409 },
      );
    }

    let sourceCsvText = parsedInput.data.rawText ?? "";
    if (
      sourceCsvText.trim().length === 0 &&
      parsedInput.data.googleSheetsUrl !== undefined
    ) {
      const safeExportUrl = resolveGoogleSheetsCsvUrl(
        parsedInput.data.googleSheetsUrl,
      );
      const response = await fetch(safeExportUrl, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
      });

      if (!response.ok) {
        return NextResponse.json(
          {
            error:
              "Impossible de telecharger le fichier CSV publie depuis Google Sheets.",
          },
          { status: 422 },
        );
      }

      sourceCsvText = await response.text();
    }

    const parsedRegistrations = parseRegistrationsFromText(sourceCsvText);

    if (
      parsedRegistrations.duplicates.length > 0 ||
      parsedRegistrations.rowErrors.length > 0
    ) {
      return NextResponse.json(
        {
          imported: false,
          validRowCount: parsedRegistrations.validRows.length,
          duplicates: parsedRegistrations.duplicates,
          rowErrors: parsedRegistrations.rowErrors,
        },
        { status: 422 },
      );
    }

    const createdTeamsSummary: Array<{
      id: string;
      teamName: string;
      player1Name: string;
      player2Name: string;
      accessCode: string;
    }> = [];

    for (let idx = 0; idx < parsedRegistrations.validRows.length; idx += 1) {
      const row = parsedRegistrations.validRows[idx];
      if (row === undefined) {
        continue;
      }

      const plainAccessCode = generateTeamAccessCode(6);
      const accessCodeHash = await hashSecret(plainAccessCode);

      const { data: insertedTeam, error: teamInsertError } = await adminClient
        .from("teams")
        .insert({
          tournament_id: tournamentId,
          team_name: row.teamName,
          normalized_name: row.normalizedTeamName,
          player_1_name: row.player1Name,
          player_2_name: row.player2Name,
          checked_in: false,
          seed_order: idx + 1,
        })
        .select("id, team_name, player_1_name, player_2_name")
        .single();

      if (teamInsertError !== null || insertedTeam === null) {
        return NextResponse.json(
          {
            error: `Conflit lors de l'enregistrement de l'equipe "${row.teamName}".`,
          },
          { status: 409 },
        );
      }

      const typedInserted = insertedTeam as {
        id: string;
        team_name: string;
        player_1_name: string;
        player_2_name: string;
      };

      await adminClient.from("team_secrets").insert({
        team_id: typedInserted.id,
        tournament_id: tournamentId,
        access_code_hash: accessCodeHash,
        access_code_hint: plainAccessCode,
      });

      createdTeamsSummary.push({
        id: typedInserted.id,
        teamName: typedInserted.team_name,
        player1Name: typedInserted.player_1_name,
        player2Name: typedInserted.player_2_name,
        accessCode: plainAccessCode,
      });
    }

    return NextResponse.json(
      {
        imported: true,
        count: createdTeamsSummary.length,
        teams: createdTeamsSummary,
      },
      { status: 201 },
    );
  } catch (error) {
    return buildSafeErrorResponse(error);
  }
}
