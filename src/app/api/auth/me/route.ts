import { NextResponse } from "next/server";
import { getOptionalAuthenticatedProfile } from "@/lib/auth/guards";
import { getTeamSessionFromCookie } from "@/lib/auth/session";
import { isProductionEnvironment } from "@/lib/env/server";
import {
  buildSafeErrorResponse,
  toPublicProfileDto,
} from "@/lib/security/http";

/**
 * Retourne l'etat de session verifie cote serveur (Admin, Joueur ou Equipe)
 * en limitant strictement les champs exposes.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const profileContext = await getOptionalAuthenticatedProfile();
    const teamSession = await getTeamSessionFromCookie();

    let publicProfile = null;
    if (profileContext !== null) {
      publicProfile = toPublicProfileDto(profileContext.profile);
    }

    let publicTeamSession = null;
    if (teamSession !== null) {
      publicTeamSession = {
        teamId: teamSession.teamId,
        tournamentId: teamSession.tournamentId,
        expiresAt: teamSession.expiresAt,
      };
    }

    const customHashConfigured =
      (process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH?.trim() ?? "").startsWith(
        "scrypt$",
      );

    return NextResponse.json(
      {
        profile: publicProfile,
        teamSession: publicTeamSession,
        devBootstrapHintAvailable:
          !isProductionEnvironment() && !customHashConfigured,
      },
      { status: 200 },
    );
  } catch (error) {
    return buildSafeErrorResponse(error);
  }
}
