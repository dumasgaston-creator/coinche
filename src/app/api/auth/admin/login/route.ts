import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
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

// Empreinte scrypt (N=16384, r=8, p=1) du mot de passe maitre par defaut si ADMIN_BOOTSTRAP_PASSWORD_HASH n'est pas defini
const DEFAULT_ADMIN_PASSWORD_SCRYPT_HASH =
  "scrypt$a1b2c3d4e5f60718293a4b5c6d7e8f90$2ad158bf26d9c6d53d22e9f5ebe1e70e2400a4746aa9803fdb0cd11ab8759cdbde7f9fb2d019e2bc333803f3c959282aebf6b7ea0176e24aaa1333580ba747fe";

const DEFAULT_ADMIN_IDENTIFIER = "bureau-coincheirb";
const DEFAULT_ADMIN_PIN = "331830";

const adminLoginPayloadSchema = z.object({
  identifier: z.string().trim().min(3).max(160),
  password: z.string().min(8).max(128),
  pinCode: z.string().trim().min(4).max(16),
  honeypot: z.string().max(120).optional(),
});

function timingSafeStringMatch(candidate: string, expected: string): boolean {
  const hashA = crypto.createHash("sha256").update(candidate).digest();
  const hashB = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

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
 * Authentification Administrateur multi-facteurs verifiee cote serveur :
 * 1. Verification anti-CSRF de l'en-tete `Origin`
 * 2. Piege Honeypot anti-bot (`honeypot` doit etre vide)
 * 3. Limitation stricte anti-bruteforce (4 essais / 10 min, blocage 30 min)
 * 4. Validation Zod des 3 facteurs : Identifiant Bureau + Mot de passe scrypt + Code PIN de securite
 * 5. Verification en temps constant (`crypto.scrypt` + `timingSafeEqual`)
 * 6. Emission d'un cookie `httpOnly`, `secure`, `sameSite=strict` signe par HMAC-SHA256.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertTrustedMutationOrigin(request);

    const bucketKey = getHashedRequestClientKey(request, "admin-login-v2");
    const rateDecision = await checkServerRateLimit({
      bucketKey,
      maxAttempts: 4,
      windowSeconds: 600,
      blockSeconds: 1800,
    });

    if (!rateDecision.allowed) {
      return NextResponse.json(
        {
          error:
            "Accès temporairement verrouillé suite à plusieurs tentatives échouées (protection anti-bruteforce 30 min).",
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
        {
          error:
            "Renseignez l'identifiant Bureau, le mot de passe maître (8+ car.) et le code PIN de sécurité.",
        },
        { status: 400 },
      );
    }

    // Piege anti-bot / scanner automatique
    if (
      parsed.data.honeypot !== undefined &&
      parsed.data.honeypot.trim().length > 0
    ) {
      return NextResponse.json(
        { error: "Requête rejetée par le pare-feu de sécurité." },
        { status: 403 },
      );
    }

    const candidateIdentifier = parsed.data.identifier.trim().toLowerCase();
    const candidatePassword = parsed.data.password;
    const candidatePin = parsed.data.pinCode.trim();

    let expectedIdentifier = (
      process.env.ADMIN_IDENTIFIER?.trim() ?? ""
    ).toLowerCase();
    if (expectedIdentifier.length === 0) {
      expectedIdentifier = DEFAULT_ADMIN_IDENTIFIER;
    }

    let expectedPin = process.env.ADMIN_SECURITY_PIN?.trim() ?? "";
    if (expectedPin.length === 0) {
      expectedPin = DEFAULT_ADMIN_PIN;
    }

    let targetHash = process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH?.trim() ?? "";
    if (targetHash === "") {
      targetHash = DEFAULT_ADMIN_PASSWORD_SCRYPT_HASH;
    }

    const identifierMatches = timingSafeStringMatch(
      candidateIdentifier,
      expectedIdentifier,
    );
    const pinMatches = timingSafeStringMatch(candidatePin, expectedPin);

    let passwordMatches = false;
    if (targetHash.startsWith("scrypt$")) {
      passwordMatches = await verifySecret(candidatePassword, targetHash);
    }

    if (identifierMatches && pinMatches && passwordMatches) {
      const displayName = "Bureau Coinch'Eirb";
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

    // 2. Fallback Supabase Auth si un email est renseigne + PIN valide + Supabase connecte
    if (
      pinMatches &&
      candidateIdentifier.includes("@") &&
      isSupabaseConfigured()
    ) {
      const supabase = await createSupabaseServerClient();
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: candidateIdentifier,
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
            { error: "Identifiants administrateur refusés." },
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

    if (
      isProductionEnvironment() &&
      !targetHash.startsWith("scrypt$") &&
      !isSupabaseConfigured()
    ) {
      return NextResponse.json(
        {
          error:
            "Configuration serveur incomplète : définissez ADMIN_BOOTSTRAP_PASSWORD_HASH dans Vercel.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Identifiant Bureau, mot de passe maître ou code PIN incorrect.",
      },
      { status: 401 },
    );
  } catch (error) {
    return buildSafeErrorResponse(error);
  }
}
