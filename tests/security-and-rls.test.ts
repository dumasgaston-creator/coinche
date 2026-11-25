import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthGuardError, evaluateMatchAccessPolicy } from "@/lib/auth/guards";
import { hashSecret, verifySecret } from "@/lib/auth/password";
import {
  createSignedAdminSessionToken,
  createSignedTeamSessionToken,
  verifySignedAdminSessionToken,
  verifySignedTeamSessionToken,
} from "@/lib/auth/session";
import { verifySameOriginMutation } from "@/lib/security/http";
import {
  evaluateInMemoryRateLimit,
  resetInMemoryRateLimits,
} from "@/lib/security/rate-limit";
import { escapeHtml } from "@/lib/security/sanitize";
import { validatePosterUpload } from "@/lib/security/upload-validator";
import { propagateKnockoutWinners } from "@/lib/tournament/live-store-types";
import type { MatchRow, ProfileRow, TournamentRow } from "@/types/database";

const MOCK_TOURNAMENT: TournamentRow = {
  id: "10000000-0000-0000-0000-000000000001",
  slug: "coinche-automne",
  title: "Coinch'Eirb Automne",
  event_date: "2026-11-26",
  starts_at: "2026-11-26T17:30:00Z",
  school_year: "2026-2027",
  status: "pools",
  registrations_locked: true,
  player_score_editing_enabled: true,
  round_of_16_threshold: 12,
  deals_per_pool_match: 5,
  target_score_r16: 500,
  target_score_qf: 600,
  target_score_sf: 700,
  target_score_final: 1000,
  poster_storage_path: null,
  poster_public_url: null,
  created_by: null,
  created_at: "2026-11-25T12:00:00Z",
  updated_at: "2026-11-25T12:00:00Z",
};

const MOCK_MATCH: MatchRow = {
  id: "30000000-0000-0000-0000-000000000001",
  tournament_id: "10000000-0000-0000-0000-000000000001",
  phase: "pool",
  pool_id: "40000000-0000-0000-0000-000000000001",
  round_number: 1,
  bracket_slot: null,
  table_number: 1,
  team_a_id: "20000000-0000-0000-0000-000000000001",
  team_b_id: "20000000-0000-0000-0000-000000000002",
  score_team_a: 0,
  score_team_b: 0,
  target_score: null,
  max_deals: 5,
  deals_played: 0,
  is_direct_final_score: false,
  status: "in_progress",
  winner_team_id: null,
  forfeit_team_id: null,
  locked_by_admin: false,
  next_match_id: null,
  next_match_slot: null,
  started_at: null,
  completed_at: null,
  updated_by_role: null,
  created_at: "2026-11-25T12:00:00Z",
  updated_at: "2026-11-25T12:00:00Z",
};

describe("Authentification serveur, anti-IDOR, cookies signes et securite", () => {
  beforeEach(() => {
    resetInMemoryRateLimits();
  });

  it("hache et verifie les secrets en scrypt sans jamais stocker le clair", async () => {
    const hash = await hashSecret("AB23CD");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash.includes("AB23CD")).toBe(false);
    expect(await verifySecret("AB23CD", hash)).toBe(true);
    expect(await verifySecret("AB23CE", hash)).toBe(false);
  });

  it("signe et valide les jetons de session d'equipe en rejetant toute falsification ou expiration", () => {
    const secret = "0123456789abcdef0123456789abcdef0123456789abcdef";
    const token = createSignedTeamSessionToken(
      {
        teamId: "20000000-0000-0000-0000-000000000001",
        tournamentId: "10000000-0000-0000-0000-000000000001",
      },
      secret,
      1_700_000_000_000,
      3600,
    );

    const valid = verifySignedTeamSessionToken(
      token,
      secret,
      1_700_000_500_000,
    );
    expect(valid?.teamId).toBe("20000000-0000-0000-0000-000000000001");

    // Expiration depassee
    expect(
      verifySignedTeamSessionToken(token, secret, 1_700_004_000_000),
    ).toBeNull();

    // Falsification du payload (tentative IDOR par modification du cookie)
    const tampered = `eyJ0ZWFtSWQiOiIyMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwOTkifQ.${token.split(".")[1]}`;
    expect(
      verifySignedTeamSessionToken(tampered, secret, 1_700_000_500_000),
    ).toBeNull();
  });

  it("bloque les tentatives IDOR d'une autre table et respecte le verrouillage admin", () => {
    // Equipe de la Table 2 tentant d'ecrire sur la Table 1 -> 403 Forbidden
    expect(() =>
      evaluateMatchAccessPolicy({
        profile: null,
        teamSession: {
          teamId: "20000000-0000-0000-0000-000000000099",
          tournamentId: MOCK_TOURNAMENT.id,
          issuedAt: 100,
          expiresAt: 999999,
        },
        playerLinkedTeamIds: [],
        match: MOCK_MATCH,
        tournament: MOCK_TOURNAMENT,
        requireWrite: true,
      }),
    ).toThrow(AuthGuardError);

    // Equipe legitime de la Table 1 -> autorisee
    const allowed = evaluateMatchAccessPolicy({
      profile: null,
      teamSession: {
        teamId: "20000000-0000-0000-0000-000000000001",
        tournamentId: MOCK_TOURNAMENT.id,
        issuedAt: 100,
        expiresAt: 999999,
      },
      playerLinkedTeamIds: [],
      match: MOCK_MATCH,
      tournament: MOCK_TOURNAMENT,
      requireWrite: true,
    });
    expect(allowed.actorType).toBe("team");

    // Desactivation globale de l'edition par l'admin -> 423 Locked pour l'equipe, mais autorise pour l'Admin
    const lockedTournament: TournamentRow = {
      ...MOCK_TOURNAMENT,
      player_score_editing_enabled: false,
    };

    expect(() =>
      evaluateMatchAccessPolicy({
        profile: null,
        teamSession: {
          teamId: "20000000-0000-0000-0000-000000000001",
          tournamentId: MOCK_TOURNAMENT.id,
          issuedAt: 100,
          expiresAt: 999999,
        },
        playerLinkedTeamIds: [],
        match: MOCK_MATCH,
        tournament: lockedTournament,
        requireWrite: true,
      }),
    ).toThrow(AuthGuardError);

    const adminProfile: ProfileRow = {
      id: "00000000-0000-0000-0000-000000000001",
      email: "admin@coincheirb.fr",
      display_name: "Admin",
      role: "admin",
      school_year: "2026-2027",
      created_at: "2026-11-25T12:00:00Z",
      updated_at: "2026-11-25T12:00:00Z",
    };

    const adminBypass = evaluateMatchAccessPolicy({
      profile: adminProfile,
      teamSession: null,
      playerLinkedTeamIds: [],
      match: MOCK_MATCH,
      tournament: lockedTournament,
      requireWrite: true,
    });
    expect(adminBypass.actorType).toBe("admin");
  });

  it("valide le vrai type binaire des images (PNG/JPEG/WebP) et rejette les SVG ou faux MIME", () => {
    const validPngHeader = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    const validated = validatePosterUpload(validPngHeader, "image/png");
    expect(validated.detectedMimeType).toBe("image/png");

    // Payload SVG/XSS deguise en image/png
    const fakePngSvg = new TextEncoder().encode(
      "<svg onload=\"alert('xss')\"></svg>",
    );
    expect(() => validatePosterUpload(fakePngSvg, "image/png")).toThrow();

    // Echappement XSS
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("applique la limitation des tentatives et verifie que RLS est activee sur les 13 tables SQL", () => {
    for (let i = 0; i < 3; i += 1) {
      const dec = evaluateInMemoryRateLimit(
        {
          bucketKey: "test-login",
          maxAttempts: 3,
          windowSeconds: 60,
          blockSeconds: 300,
        },
        1_000_000,
      );
      expect(dec.allowed).toBe(true);
    }

    const blocked = evaluateInMemoryRateLimit(
      {
        bucketKey: "test-login",
        maxAttempts: 3,
        windowSeconds: 60,
        blockSeconds: 300,
      },
      1_000_500,
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(300);

    // Audit statique de la migration SQL : chaque `create table public.<name>` possede `enable row level security` et `force row level security`
    const sqlPath = path.resolve(
      process.cwd(),
      "supabase/migrations/0001_initial_schema_and_rls.sql",
    );
    const sql = fs.readFileSync(sqlPath, "utf8");
    const tableMatches = [
      ...sql.matchAll(/create table public\.([a-z0-9_]+)/g),
    ].map((m) => m[1]);

    expect(tableMatches.length).toBe(13);

    for (const tableName of tableMatches) {
      expect(tableName).toBeDefined();
      expect(sql).toContain(
        `alter table public.${tableName} enable row level security;`,
      );
      expect(sql).toContain(
        `alter table public.${tableName} force row level security;`,
      );
      expect(sql).toContain(`on public.${tableName}`);
    }
  });

  it("signe les cookies administrateur HMAC, bloque le CSRF inter-site et propage l'arbre final", () => {
    const secret = "abcdef0123456789abcdef0123456789abcdef0123456789";
    const adminToken = createSignedAdminSessionToken(
      {
        adminId: "admin-master-coincheirb",
        displayName: "Bureau Coinch'Eirb",
      },
      secret,
      1_700_000_000_000,
      3600,
    );

    const validAdmin = verifySignedAdminSessionToken(
      adminToken,
      secret,
      1_700_000_500_000,
    );
    expect(validAdmin?.role).toBe("admin");
    expect(validAdmin?.displayName).toBe("Bureau Coinch'Eirb");

    // Expiration admin depassee
    expect(
      verifySignedAdminSessionToken(adminToken, secret, 1_700_005_000_000),
    ).toBeNull();

    // Protection anti-CSRF : meme origine acceptee, origine externe rejetee
    expect(
      verifySameOriginMutation({
        originHeader: "https://coincheirb.vercel.app",
        hostHeader: "coincheirb.vercel.app",
        forwardedHostHeader: null,
      }),
    ).toBe(true);

    expect(
      verifySameOriginMutation({
        originHeader: "https://attacker-evil.example",
        hostHeader: "coincheirb.vercel.app",
        forwardedHostHeader: null,
      }),
    ).toBe(false);

    // Propagation automatique d'un vainqueur de Huitieme vers Quart de finale
    const propagated = propagateKnockoutWinners([
      {
        id: "ko-r16-1",
        phase: "round_of_16",
        poolNumber: null,
        poolLabel: null,
        roundNumber: 1,
        bracketSlot: 1,
        tableNumber: 1,
        teamAId: "team-01",
        teamBId: "team-16",
        seedA: 1,
        seedB: 16,
        scoreTeamA: 520,
        scoreTeamB: 340,
        targetScore: 500,
        maxDeals: null,
        dealsPlayed: 4,
        deals: [],
        isDirectFinalScore: false,
        status: "completed",
        winnerTeamId: "team-01",
        forfeitTeamId: null,
        lockedByAdmin: false,
        nextMatchId: "ko-qf-1",
        nextMatchSlot: "team_a",
        highlightNote: null,
        updatedByRole: "team",
        updatedAtLabel: "20h05",
      },
      {
        id: "ko-qf-1",
        phase: "quarterfinals",
        poolNumber: null,
        poolLabel: null,
        roundNumber: 2,
        bracketSlot: 1,
        tableNumber: null,
        teamAId: null,
        teamBId: "team-08",
        seedA: null,
        seedB: 8,
        scoreTeamA: 0,
        scoreTeamB: 0,
        targetScore: 600,
        maxDeals: null,
        dealsPlayed: 0,
        deals: [],
        isDirectFinalScore: false,
        status: "pending",
        winnerTeamId: null,
        forfeitTeamId: null,
        lockedByAdmin: false,
        nextMatchId: null,
        nextMatchSlot: null,
        highlightNote: null,
        updatedByRole: null,
        updatedAtLabel: "20h00",
      },
    ]);

    expect(propagated[1]?.teamAId).toBe("team-01");
    expect(propagated[1]?.seedA).toBe(1);
    expect(propagated[1]?.status).toBe("in_progress");
    expect(propagated[1]?.tableNumber).toBe(1);
  });
});
