import { NextResponse } from "next/server";
import { getOptionalAuthenticatedProfile } from "@/lib/auth/guards";
import { getTeamSessionFromCookie } from "@/lib/auth/session";
import {
  buildSafeErrorResponse,
  toPublicProfileDto,
} from "@/lib/security/http";

/**
 * Retourne l'etat de session verifie cote serveur (Admin, Joueur ou Equipe)
 * en limitant strictement les champs exposes (aucun indice de mot de passe n'est jamais renvoye).
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

    return NextResponse.json(
      {
        profile: publicProfile,
        teamSession: publicTeamSession,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return buildSafeErrorResponse(error);
  }
}
