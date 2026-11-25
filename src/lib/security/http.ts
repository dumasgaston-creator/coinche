import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { AuthGuardError } from "@/lib/auth/guards";
import { resolveServerHmacSecret } from "@/lib/auth/session";
import { hashClientIdentifier } from "@/lib/security/sanitize";
import type { ProfileRow, TeamRow } from "@/types/database";

/**
 * Verifie que toute requete de mutation (`POST`, `PUT`, `PATCH`, `DELETE`) provient
 * bien du meme hote que l'application (protection anti-CSRF sur les cookies `httpOnly`).
 */
export function verifySameOriginMutation(params: {
  originHeader: string | null;
  hostHeader: string | null;
  forwardedHostHeader: string | null;
}): boolean {
  const effectiveHost = params.forwardedHostHeader ?? params.hostHeader;
  if (effectiveHost === null || effectiveHost.trim() === "") {
    return true;
  }

  if (params.originHeader === null || params.originHeader.trim() === "") {
    // Requete non-navigateur ou meme origine sans en-tete Origin
    return true;
  }

  try {
    const parsedOrigin = new URL(params.originHeader);
    const normalizedExpected = effectiveHost.trim().toLowerCase();
    const normalizedActual = parsedOrigin.host.trim().toLowerCase();
    return normalizedActual === normalizedExpected;
  } catch {
    return false;
  }
}

export function assertTrustedMutationOrigin(request: NextRequest): void {
  const ok = verifySameOriginMutation({
    originHeader: request.headers.get("origin"),
    hostHeader: request.headers.get("host"),
    forwardedHostHeader: request.headers.get("x-forwarded-host"),
  });

  if (!ok) {
    throw new AuthGuardError(
      "Requete inter-site rejetee (protection anti-CSRF).",
      403,
    );
  }
}

/**
 * Extrait un identifiant reseau hache (jamais stocke en clair) pour la limitation de debit.
 */
export function getHashedRequestClientKey(
  request: NextRequest,
  scope: string,
): string {
  const forwarded = request.headers.get("x-forwarded-for");
  let rawIp = "127.0.0.1";

  if (forwarded !== null && forwarded.trim().length > 0) {
    const firstHop = forwarded.split(",")[0];
    if (firstHop !== undefined && firstHop.trim().length > 0) {
      rawIp = firstHop.trim();
    }
  } else {
    const realIp = request.headers.get("x-real-ip");
    if (realIp !== null && realIp.trim().length > 0) {
      rawIp = realIp.trim();
    }
  }

  let salt = "coincheirb-dev-salt";
  try {
    salt = resolveServerHmacSecret();
  } catch {
    salt = "coincheirb-dev-salt";
  }

  const ipHash = hashClientIdentifier(rawIp, salt);
  return `${scope}:${ipHash}`;
}

export function toPublicProfileDto(profile: ProfileRow): {
  id: string;
  displayName: string;
  role: "player" | "admin";
  schoolYear: string;
} {
  return {
    id: profile.id,
    displayName: profile.display_name,
    role: profile.role,
    schoolYear: profile.school_year,
  };
}

export function toPublicTeamDto(team: TeamRow): {
  id: string;
  tournamentId: string;
  teamName: string;
  player1Name: string;
  player2Name: string;
  checkedIn: boolean;
  isForfeit: boolean;
  poolId: string | null;
} {
  return {
    id: team.id,
    tournamentId: team.tournament_id,
    teamName: team.team_name,
    player1Name: team.player_1_name,
    player2Name: team.player_2_name,
    checkedIn: team.checked_in,
    isForfeit: team.is_forfeit,
    poolId: team.pool_id,
  };
}

export function buildSafeErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthGuardError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode },
    );
  }

  return NextResponse.json(
    { error: "Une erreur serveur est survenue lors du traitement de la requete." },
    { status: 500 },
  );
}
