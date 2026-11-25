import "server-only";
import {
  getAdminSessionFromCookie,
  getTeamSessionFromCookie,
  type TeamSessionPayload,
} from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  MatchRow,
  ProfileRow,
  TeamRow,
  TournamentRow,
} from "@/types/database";

export class AuthGuardError extends Error {
  public readonly statusCode: 401 | 403 | 404 | 423 | 429;

  constructor(
    message: string,
    statusCode: 401 | 403 | 404 | 423 | 429,
  ) {
    super(message);
    this.name = "AuthGuardError";
    this.statusCode = statusCode;
  }
}

export interface AuthenticatedProfileContext {
  userId: string;
  profile: ProfileRow;
}

export interface MatchAccessGrant {
  actorType: "admin" | "team";
  actingTeamId: string | null;
  actingProfile: ProfileRow | null;
  match: MatchRow;
  tournament: TournamentRow;
}

function isSupabaseServerConfigured(): boolean {
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
 * Recupere cote serveur la session authentifiee courante :
 * 1. Verifie d'abord le cookie Administrateur `httpOnly` signe par HMAC (`coincheirb_admin_session`)
 * 2. Sinon, si Supabase est configure, verifie le jeton Supabase Auth (`auth.getUser()`) et `public.profiles`.
 */
export async function getOptionalAuthenticatedProfile(): Promise<AuthenticatedProfileContext | null> {
  const adminCookieSession = await getAdminSessionFromCookie();
  if (adminCookieSession !== null) {
    const nowIso = new Date(adminCookieSession.issuedAt * 1000).toISOString();
    return {
      userId: adminCookieSession.adminId,
      profile: {
        id: adminCookieSession.adminId,
        email: null,
        display_name: adminCookieSession.displayName,
        role: "admin",
        school_year: "2026-2027",
        created_at: nowIso,
        updated_at: nowIso,
      },
    };
  }

  if (!isSupabaseServerConfigured()) {
    return null;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError !== null || authData.user === null) {
      return null;
    }

    const adminClient = createSupabaseAdminClient();
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select(
        "id, email, display_name, role, school_year, created_at, updated_at",
      )
      .eq("id", authData.user.id)
      .single();

    if (profileError !== null || profile === null) {
      return null;
    }

    return {
      userId: authData.user.id,
      profile: profile as ProfileRow,
    };
  } catch {
    return null;
  }
}

/**
 * Garde serveur obligatoire sur toutes les routes d'administration :
 * exige un cookie Administrateur signe valide OU un profil Supabase avec `role === "admin"`.
 */
export async function requireAdmin(): Promise<AuthenticatedProfileContext> {
  const context = await getOptionalAuthenticatedProfile();
  if (context === null) {
    throw new AuthGuardError("Authentification administrateur requise.", 401);
  }

  if (context.profile.role !== "admin") {
    throw new AuthGuardError(
      "Acces refuse : privileges administrateur requis.",
      403,
    );
  }

  return context;
}

/**
 * Evaluation pure de l'autorisation d'acces a un match (testable unitairement sans reseau).
 * Applique strictement la protection anti-IDOR et le verrouillage des scores.
 */
export function evaluateMatchAccessPolicy(params: {
  profile: ProfileRow | null;
  teamSession: TeamSessionPayload | null;
  playerLinkedTeamIds: string[];
  match: MatchRow;
  tournament: TournamentRow;
  requireWrite: boolean;
}): { actorType: "admin" | "team"; actingTeamId: string | null } {
  const {
    profile,
    teamSession,
    playerLinkedTeamIds,
    match,
    tournament,
    requireWrite,
  } = params;

  if (profile !== null && profile.role === "admin") {
    return { actorType: "admin", actingTeamId: null };
  }

  let verifiedTeamId: string | null = null;

  if (
    teamSession !== null &&
    teamSession.tournamentId === match.tournament_id
  ) {
    if (
      teamSession.teamId === match.team_a_id ||
      teamSession.teamId === match.team_b_id
    ) {
      verifiedTeamId = teamSession.teamId;
    }
  }

  if (verifiedTeamId === null && playerLinkedTeamIds.length > 0) {
    for (const candidateTeamId of playerLinkedTeamIds) {
      if (
        candidateTeamId === match.team_a_id ||
        candidateTeamId === match.team_b_id
      ) {
        verifiedTeamId = candidateTeamId;
        break;
      }
    }
  }

  if (verifiedTeamId === null) {
    throw new AuthGuardError(
      "Acces refuse : vous n'etes pas autorise a agir sur cette table.",
      403,
    );
  }

  if (requireWrite) {
    if (!tournament.player_score_editing_enabled) {
      throw new AuthGuardError(
        "La saisie des scores par les equipes est actuellement verrouillee par l'administrateur.",
        423,
      );
    }

    if (match.locked_by_admin) {
      throw new AuthGuardError(
        "Cette table a ete verrouillee par l'administrateur.",
        423,
      );
    }

    if (match.status !== "pending" && match.status !== "in_progress") {
      throw new AuthGuardError(
        "Ce match est deja cloture et ne peut plus etre modifie par une equipe.",
        423,
      );
    }
  }

  return {
    actorType: "team",
    actingTeamId: verifiedTeamId,
  };
}

/**
 * Garde serveur anti-IDOR complet pour toute action sur un match (`matchId`).
 */
export async function requireMatchAccess(
  matchId: string,
  options: { requireWrite: boolean },
): Promise<MatchAccessGrant> {
  const adminClient = createSupabaseAdminClient();

  const { data: matchData, error: matchError } = await adminClient
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (matchError !== null || matchData === null) {
    throw new AuthGuardError("Match introuvable.", 404);
  }

  const match = matchData as MatchRow;

  const { data: tournamentData, error: tournamentError } = await adminClient
    .from("tournaments")
    .select("*")
    .eq("id", match.tournament_id)
    .single();

  if (tournamentError !== null || tournamentData === null) {
    throw new AuthGuardError("Tournoi introuvable.", 404);
  }

  const tournament = tournamentData as TournamentRow;
  const authContext = await getOptionalAuthenticatedProfile();
  const teamSession = await getTeamSessionFromCookie();

  const linkedTeamIds: string[] = [];
  if (authContext !== null && authContext.profile.role === "player") {
    const { data: playerTeams } = await adminClient
      .from("teams")
      .select("id")
      .eq("tournament_id", match.tournament_id)
      .or(
        `player_1_profile_id.eq.${authContext.userId},player_2_profile_id.eq.${authContext.userId}`,
      );

    if (Array.isArray(playerTeams)) {
      for (const row of playerTeams) {
        const typedRow = row as Pick<TeamRow, "id">;
        linkedTeamIds.push(typedRow.id);
      }
    }
  }

  let profileOrNull: ProfileRow | null = null;
  if (authContext !== null) {
    profileOrNull = authContext.profile;
  }

  const decision = evaluateMatchAccessPolicy({
    profile: profileOrNull,
    teamSession,
    playerLinkedTeamIds: linkedTeamIds,
    match,
    tournament,
    requireWrite: options.requireWrite,
  });

  return {
    actorType: decision.actorType,
    actingTeamId: decision.actingTeamId,
    actingProfile: profileOrNull,
    match,
    tournament,
  };
}
