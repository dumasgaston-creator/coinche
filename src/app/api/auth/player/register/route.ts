import { NextResponse, type NextRequest } from "next/server";
import {
  buildSafeErrorResponse,
  getHashedRequestClientKey,
  toPublicProfileDto,
} from "@/lib/security/http";
import { checkServerRateLimit } from "@/lib/security/rate-limit";
import { sanitizePlainName } from "@/lib/security/sanitize";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { playerRegistrationSchema } from "@/lib/validation/schemas";
import type { ProfileRow } from "@/types/database";

/**
 * Creation d'un compte joueur optionnel pour le suivi de performances
 * et le classement general annuel Coinch'Eirb.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const bucketKey = getHashedRequestClientKey(request, "player-register");
    const rateDecision = await checkServerRateLimit({
      bucketKey,
      maxAttempts: 5,
      windowSeconds: 600,
      blockSeconds: 900,
    });

    if (!rateDecision.allowed) {
      return NextResponse.json(
        { error: "Trop de creations de compte depuis cette connexion. Patientez." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateDecision.retryAfterSeconds),
          },
        },
      );
    }

    const body: unknown = await request.json();
    const parsed = playerRegistrationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Donnees d'inscription invalides." },
        { status: 400 },
      );
    }

    const safeDisplayName = sanitizePlainName(parsed.data.displayName);
    if (safeDisplayName.length < 2) {
      return NextResponse.json(
        { error: "Le pseudo doit contenir au moins 2 caracteres valides." },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          display_name: safeDisplayName,
        },
      },
    });

    if (signUpError !== null || signUpData.user === null) {
      return NextResponse.json(
        { error: "Impossible de creer le compte avec ces informations." },
        { status: 400 },
      );
    }

    const adminClient = createSupabaseAdminClient();
    const { data: profileData, error: upsertError } = await adminClient
      .from("profiles")
      .upsert(
        {
          id: signUpData.user.id,
          email: parsed.data.email,
          display_name: safeDisplayName,
          role: "player",
          school_year: parsed.data.schoolYear,
        },
        { onConflict: "id" },
      )
      .select(
        "id, email, display_name, role, school_year, created_at, updated_at",
      )
      .single();

    if (upsertError !== null || profileData === null) {
      return NextResponse.json(
        { error: "Compte cree mais profil en attente de validation." },
        { status: 201 },
      );
    }

    return NextResponse.json(
      {
        registered: true,
        profile: toPublicProfileDto(profileData as ProfileRow),
      },
      { status: 201 },
    );
  } catch (error) {
    return buildSafeErrorResponse(error);
  }
}
