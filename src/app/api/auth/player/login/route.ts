import { NextResponse, type NextRequest } from "next/server";
import { normalizeAccessCode, verifySecret } from "@/lib/auth/password";
import { getOptionalAuthenticatedProfile } from "@/lib/auth/guards";
import {
  buildSafeErrorResponse,
  getHashedRequestClientKey,
  toPublicProfileDto,
  toPublicTeamDto,
} from "@/lib/security/http";
import { checkServerRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  emailPasswordLoginSchema,
  linkPlayerToTeamSchema,
} from "@/lib/validation/schemas";
import type { ProfileRow, TeamRow, TeamSecretRow } from "@/types/database";

/**
 * POST : Connexion d'un compte joueur optionnel.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const bucketKey = getHashedRequestClientKey(request, "player-login");
    const rateDecision = await checkServerRateLimit({
      bucketKey,
      maxAttempts: 8,
      windowSeconds: 300,
      blockSeconds: 600,
    });

    if (!rateDecision.allowed) {
      return NextResponse.json(
        { error: "Trop de tentatives de connexion. Reessayez dans quelques minutes." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateDecision.retryAfterSeconds),
          },
        },
      );
    }

    const body: unknown = await request.json();
    const parsed = emailPasswordLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Identifiants invalides." },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error !== null || data.user === null) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect." },
        { status: 401 },
      );
    }

    const adminClient = createSupabaseAdminClient();
    const { data: profileData } = await adminClient
      .from("profiles")
      .select(
        "id, email, display_name, role, school_year, created_at, updated_at",
      )
      .eq("id", data.user.id)
      .single();

    if (profileData === null) {
      return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
    }

    return NextResponse.json(
      {
        authenticated: true,
        profile: toPublicProfileDto(profileData as ProfileRow),
      },
      { status: 200 },
    );
  } catch (error) {
    return buildSafeErrorResponse(error);
  }
}

/**
 * PATCH : Rattachement anti-IDOR d'un compte joueur optionnel a une equipe du tournoi
 * (exige la connaissance du code court d'equipe pour empecher l'usurpation d'une autre equipe).
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const authContext = await getOptionalAuthenticatedProfile();
    if (authContext === null) {
      return NextResponse.json(
        { error: "Connexion a votre compte joueur requise." },
        { status: 401 },
      );
    }

    const bucketKey = getHashedRequestClientKey(request, "player-link-team");
    const rateDecision = await checkServerRateLimit({
      bucketKey,
      maxAttempts: 6,
      windowSeconds: 300,
      blockSeconds: 600,
    });

    if (!rateDecision.allowed) {
      return NextResponse.json(
        { error: "Trop de tentatives de rattachement d'equipe." },
        { status: 429 },
      );
    }

    const body: unknown = await request.json();
    const parsed = linkPlayerToTeamSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requete de rattachement invalide." },
        { status: 400 },
      );
    }

    const adminClient = createSupabaseAdminClient();
    const { data: secretRow } = await adminClient
      .from("team_secrets")
      .select("team_id, tournament_id, access_code_hash, access_code_hint, updated_at")
      .eq("team_id", parsed.data.teamId)
      .eq("tournament_id", parsed.data.tournamentId)
      .single();

    if (secretRow === null) {
      return NextResponse.json(
        { error: "Equipe ou code d'acces invalide." },
        { status: 403 },
      );
    }

    const typedSecret = secretRow as TeamSecretRow;
    const codeValid = await verifySecret(
      normalizeAccessCode(parsed.data.accessCode),
      typedSecret.access_code_hash,
    );

    if (!codeValid) {
      return NextResponse.json(
        { error: "Equipe ou code d'acces invalide." },
        { status: 403 },
      );
    }

    const updatePayload: Record<string, string> = {};
    if (parsed.data.playerSlot === "player_1") {
      updatePayload.player_1_profile_id = authContext.userId;
    } else {
      updatePayload.player_2_profile_id = authContext.userId;
    }

    const { data: updatedTeam, error: updateError } = await adminClient
      .from("teams")
      .update(updatePayload)
      .eq("id", parsed.data.teamId)
      .eq("tournament_id", parsed.data.tournamentId)
      .select("*")
      .single();

    if (updateError !== null || updatedTeam === null) {
      return NextResponse.json(
        { error: "Impossible de rattacher le profil a cette equipe." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        linked: true,
        team: toPublicTeamDto(updatedTeam as TeamRow),
      },
      { status: 200 },
    );
  } catch (error) {
    return buildSafeErrorResponse(error);
  }
}
