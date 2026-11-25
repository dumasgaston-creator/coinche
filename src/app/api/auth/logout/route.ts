import { NextResponse, type NextRequest } from "next/server";
import {
  clearAdminSessionCookie,
  clearTeamSessionCookie,
} from "@/lib/auth/session";
import {
  assertTrustedMutationOrigin,
  buildSafeErrorResponse,
} from "@/lib/security/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Deconnexion globale : efface le cookie Admin `httpOnly`, le cookie d'equipe
 * et invalide la session Supabase Auth si configuree.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertTrustedMutationOrigin(request);

    await clearAdminSessionCookie();
    await clearTeamSessionCookie();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (
      url !== undefined &&
      anon !== undefined &&
      url.length >= 16 &&
      !url.includes("your-project-ref")
    ) {
      try {
        const supabase = await createSupabaseServerClient();
        await supabase.auth.signOut();
      } catch {
        // Ignore si Supabase hors ligne
      }
    }

    return NextResponse.json({ signedOut: true }, { status: 200 });
  } catch (error) {
    return buildSafeErrorResponse(error);
  }
}
