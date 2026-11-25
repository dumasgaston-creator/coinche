import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifySecret } from "@/lib/auth/password";
import { setAdminSessionCookie } from "@/lib/auth/session";
import { isProductionEnvironment } from "@/lib/env/server";
import {
  assertTrustedMutationOrigin,
  buildSafeErrorResponse,
  getHashedRequestClientKey,
  toPublicProfileDto,
} from "@/lib/security/http";
import { checkServerRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/types/database";

// Empreinte scrypt (N=16384, r=8, p=1) utilisee uniquement en developpement local
// lorsque `ADMIN_BOOTSTRAP_PASSWORD_HASH` n'est pas encore defini dans `.env.local`.
const DEV_ONLY_ADMIN_PASSWORD_SCRYPT_HASH =
  "scrypt$a1b2c3d4e5f60718293a4b5c6d7e8f90$2ad158bf26d9c6d53d22e9f5ebe1e70e2400a4746aa9803fdb0cd11ab8759cdbde7f9fb2d019e2bc333803f3c959282aebf6b7ea0176e24aaa1333580ba747fe";

const adminLoginPayloadSchema = z.object({
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  password: z.string().min(8).max(128),
});

function isSupabaseConfigured(): boolean {
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

/**
 * Authentification Administrateur verifiee cote serveur :
 * 1. Verification anti-CSRF de l'en-tete `Origin`
 * 2. Limitation stricte anti-bruteforce (5 essais / 5 min, blocage 15 min)
 * 3. Validation Zod des entrees
 * 4. Verification cryptographique `scrypt` en temps constant du mot de passe Admin maitre
 *    (`ADMIN_BOOTSTRAP_PASSWORD_HASH`) + emission d'un cookie `httpOnly`, `secure`, `sameSite=strict`
 *    signe par HMAC-SHA256 cote serveur
 * 5. Support additionnel de Supabase Auth (`profiles.role === "admin"`) si un email est fourni.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertTrustedMutationOrigin(request);

    const bucketKey = getHashedRequestClientKey(request, "admin-login");
    const rateDecision = await checkServerRateLimit({
      bucketKey,
      maxAttempts: 5,
      windowSeconds: 300,
      blockSeconds: 900,
    });

    if (!rateDecision.allowed) {
      return NextResponse.json(
        {
          error:
            "Trop de tentatives de connexion administrateur. Réessayez dans quelques minutes.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateDecision.retryAfterSeconds),
          },
        },
      );
    }

    const body: unknown = await request.json();
    const parsed = adminLoginPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Saisissez un mot de passe d'au moins 8 caractères." },
        { status: 400 },
      );
    }

    const candidatePassword = parsed.data.password;
    const rawEmail = parsed.data.email ?? "";

    // 1. Verification par mot de passe maitre hache (`ADMIN_BOOTSTRAP_PASSWORD_HASH`)
    let targetHash = process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH?.trim() ?? "";
    if (targetHash === "" && !isProductionEnvironment()) {
      targetHash = DEV_ONLY_ADMIN_PASSWORD_SCRYPT_HASH;
    }

    if (targetHash.startsWith("scrypt$")) {
      const passwordMatches = await verifySecret(candidatePassword, targetHash);
      if (passwordMatches) {
        let displayName = "Bureau Coinch'Eirb (Admin)";
        if (rawEmail.length > 0) {
          displayName = rawEmail;
        }

        await setAdminSessionCookie({
          adminId: "admin-master-coincheirb",
          displayName,
        });

        return NextResponse.json(
          {
            authenticated: true,
            profile: {
              id: "admin-master-coincheirb",
              displayName,
              role: "admin",
              schoolYear: "2026-2027",
            },
          },
          { status: 200 },
        );
      }
    }

    // 2. Fallback Supabase Auth si un email est renseigne et Supabase est connecte
    if (rawEmail.length > 0 && isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: rawEmail,
          password: candidatePassword,
        });

      if (authError === null && authData.user !== null) {
        const adminClient = createSupabaseAdminClient();
        const { data: profileData, error: profileError } = await adminClient
          .from("profiles")
          .select(
            "id, email, display_name, role, school_year, created_at, updated_at",
          )
          .eq("id", authData.user.id)
          .single();

        if (profileError !== null || profileData === null) {
          await supabase.auth.signOut();
          return NextResponse.json(
            { error: "Profil introuvable." },
            { status: 403 },
          );
        }

        const profile = profileData as ProfileRow;
        if (profile.role !== "admin") {
          await supabase.auth.signOut();
          return NextResponse.json(
            {
              error:
                "Accès refusé : ce compte ne dispose pas des droits administrateur.",
            },
            { status: 403 },
          );
        }

        await setAdminSessionCookie({
          adminId: profile.id,
          displayName: profile.display_name,
        });

        return NextResponse.json(
          {
            authenticated: true,
            profile: toPublicProfileDto(profile),
          },
          { status: 200 },
        );
      }
    }

    if (isProductionEnvironment() && targetHash === "" && !isSupabaseConfigured()) {
      return NextResponse.json(
        {
          error:
            "Configuration serveur incomplète : définissez ADMIN_BOOTSTRAP_PASSWORD_HASH dans vos variables d'environnement.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Mot de passe administrateur incorrect." },
      { status: 401 },
    );
  } catch (error) {
    return buildSafeErrorResponse(error);
  }
}
