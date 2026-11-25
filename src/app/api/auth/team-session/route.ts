import { NextResponse, type NextRequest } from "next/server";
import { normalizeAccessCode, verifySecret } from "@/lib/auth/password";
import { setTeamSessionCookie } from "@/lib/auth/session";
import {
  buildSafeErrorResponse,
  getHashedRequestClientKey,
  toPublicTeamDto,
} from "@/lib/security/http";
import { checkServerRateLimit } from "@/lib/security/rate-limit";
import { normalizeComparisonKey } from "@/lib/security/sanitize";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { teamQuickAccessSchema } from "@/lib/validation/schemas";
import type { TeamRow, TeamSecretRow } from "@/types/database";

/**
 * Acces rapide d'une table / equipe sans compte obligatoire :
 * Verifie le pseudo d'equipe + code court hache dans `team_secrets` cote serveur
 * puis emet un cookie signe HMAC `httpOnly`, `secure`, `sameSite=lax`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const bucketKey = getHashedRequestClientKey(request, "team-session");
    const rateDecision = await checkServerRateLimit({
      bucketKey,
      maxAttempts: 10,
      windowSeconds: 300,
      blockSeconds: 600,
    });

    if (!rateDecision.allowed) {
      return NextResponse.json(
        { error: "Trop de tentatives de code d'equipe. Patientez avant de reessayer." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateDecision.retryAfterSeconds),
          },
        },
      );
    }

    const body: unknown = await request.json();
    const parsed = teamQuickAccessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Informations d'equipe invalides." },
        { status: 400 },
      );
    }

    const normalizedTeam = normalizeComparisonKey(parsed.data.teamIdentifier);
    const adminClient = createSupabaseAdminClient();

    const { data: teamData } = await adminClient
      .from("teams")
      .select("*")
      .eq("tournament_id", parsed.data.tournamentId)
      .eq("normalized_name", normalizedTeam)
      .single();

    if (teamData === null) {
      return NextResponse.json(
        { error: "Equipe ou code court incorrect." },
        { status: 401 },
      );
    }

    const team = teamData as TeamRow;

    const { data: secretData } = await adminClient
      .from("team_secrets")
      .select("team_id, tournament_id, access_code_hash, access_code_hint, updated_at")
      .eq("team_id", team.id)
      .single();

    if (secretData === null) {
      return NextResponse.json(
        { error: "Equipe ou code court incorrect." },
        { status: 401 },
      );
    }

    const secret = secretData as TeamSecretRow;
    const isCodeValid = await verifySecret(
      normalizeAccessCode(parsed.data.accessCode),
      secret.access_code_hash,
    );

    if (!isCodeValid) {
      return NextResponse.json(
        { error: "Equipe ou code court incorrect." },
        { status: 401 },
      );
    }

    await setTeamSessionCookie({
      teamId: team.id,
      tournamentId: team.tournament_id,
    });

    return NextResponse.json(
      {
        authenticated: true,
        team: toPublicTeamDto(team),
      },
      { status: 200 },
    );
  } catch (error) {
    return buildSafeErrorResponse(error);
  }
}
