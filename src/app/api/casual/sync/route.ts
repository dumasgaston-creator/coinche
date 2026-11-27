import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getClubAccountFromCookie } from "@/lib/auth/session";
import {
  assertTrustedMutationOrigin,
  buildSafeErrorResponse,
  getHashedRequestClientKey,
} from "@/lib/security/http";
import { checkServerRateLimit } from "@/lib/security/rate-limit";
import {
  normalizeComparisonKey,
  sanitizePlainName,
} from "@/lib/security/sanitize";
import type {
  CasualGameRecord,
  EnseirbDepartment,
  EnseirbPromoYear,
  SchoolPlayerDirectoryEntry,
} from "@/lib/casual/casual-store";

export const dynamic = "force-dynamic";

const serverDirectoryByKey = new Map<string, SchoolPlayerDirectoryEntry>();
const serverCasualGamesById = new Map<string, CasualGameRecord>();

const departmentSchema = z.enum([
  "Informatique",
  "Électronique",
  "Télécoms",
  "Matmeca",
  "RSI",
  "ENSEIRB",
]);

const promoSchema = z.enum(["1A", "2A", "3A", "Alumni"]);

const directoryEntrySchema = z.object({
  id: z.string().min(2).max(120),
  name: z.string().trim().min(2).max(40),
  department: departmentSchema,
  promoYear: promoSchema,
  playStyle: z.string().trim().min(2).max(60),
  favoriteAnnouncement: z.string().trim().min(2).max(40),
});

const casualDealSchema = z.object({
  id: z.string().min(1).max(120),
  dealNumber: z.number().int().min(1).max(60),
  pointsTeamA: z.number().int().min(0).max(5000),
  pointsTeamB: z.number().int().min(0).max(5000),
  specialTag: z
    .enum(["capot", "generale", "coinche", "surcoinche", "parlante"])
    .nullable(),
});

const casualGameSchema = z.object({
  id: z.string().min(2).max(120),
  createdAt: z.string().min(10).max(60),
  completedAt: z.string().max(60).nullable(),
  locationLabel: z.string().min(1).max(40),
  targetScore: z.number().int().min(100).max(5000).nullable(),
  teamA: z.tuple([z.string().min(1).max(40), z.string().min(1).max(40)]),
  teamB: z.tuple([z.string().min(1).max(40), z.string().min(1).max(40)]),
  scoreA: z.number().int().min(0).max(20000),
  scoreB: z.number().int().min(0).max(20000),
  deals: z.array(casualDealSchema).max(60),
  status: z.enum(["in_progress", "completed"]),
  winnerSide: z.enum(["team_a", "team_b"]).nullable(),
});

const casualSyncActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("upsert_player"),
    player: directoryEntrySchema,
  }),
  z.object({
    action: z.literal("upsert_game"),
    game: casualGameSchema,
  }),
]);

export async function GET(): Promise<NextResponse> {
  const directory = Array.from(serverDirectoryByKey.values());
  const games = Array.from(serverCasualGamesById.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  return NextResponse.json(
    {
      directory,
      games,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertTrustedMutationOrigin(request);

    const rateDecision = await checkServerRateLimit({
      bucketKey: getHashedRequestClientKey(request, "casual-sync-api"),
      maxAttempts: 60,
      windowSeconds: 60,
      blockSeconds: 120,
    });
    if (!rateDecision.allowed) {
      return NextResponse.json(
        { error: "Trop de requêtes. Patientez quelques secondes." },
        { status: 429 },
      );
    }

    const rawBody: unknown = await request.json();
    const parsed = casualSyncActionSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données de synchronisation invalides." },
        { status: 400 },
      );
    }

    const clubSession = await getClubAccountFromCookie();

    if (parsed.data.action === "upsert_player") {
      if (clubSession === null) {
        return NextResponse.json(
          {
            error:
              "Connexion requise : connectez votre compte Coinch'Eirb pour ajouter un joueur dans l'annuaire.",
          },
          { status: 401 },
        );
      }

      const p = parsed.data.player;
      const cleanName = sanitizePlainName(p.name);
      const normKey = normalizeComparisonKey(cleanName);
      if (normKey.length < 2) {
        return NextResponse.json(
          { error: "Nom de joueur invalide." },
          { status: 400 },
        );
      }

      const entry: SchoolPlayerDirectoryEntry = {
        id: p.id,
        name: cleanName,
        normalizedKey: normKey,
        department: p.department as EnseirbDepartment,
        promoYear: p.promoYear as EnseirbPromoYear,
        playStyle: sanitizePlainName(p.playStyle).slice(0, 48),
        favoriteAnnouncement: sanitizePlainName(p.favoriteAnnouncement).slice(
          0,
          36,
        ),
        addedByPseudo: clubSession.pseudo,
        createdAt: new Date().toISOString(),
      };

      serverDirectoryByKey.set(normKey, entry);
      if (serverDirectoryByKey.size > 500) {
        const oldestKey = serverDirectoryByKey.keys().next().value;
        if (typeof oldestKey === "string") {
          serverDirectoryByKey.delete(oldestKey);
        }
      }

      return NextResponse.json(
        { ok: true, entry },
        { status: 200 },
      );
    }

    // upsert_game
    const g = parsed.data.game;
    const cleanGame: CasualGameRecord = {
      ...g,
      locationLabel: sanitizePlainName(g.locationLabel) || "Au BAR",
      teamA: [sanitizePlainName(g.teamA[0]), sanitizePlainName(g.teamA[1])],
      teamB: [sanitizePlainName(g.teamB[0]), sanitizePlainName(g.teamB[1])],
    };

    serverCasualGamesById.set(cleanGame.id, cleanGame);
    if (serverCasualGamesById.size > 300) {
      const oldestId = serverCasualGamesById.keys().next().value;
      if (typeof oldestId === "string") {
        serverCasualGamesById.delete(oldestId);
      }
    }

    return NextResponse.json(
      { ok: true, game: cleanGame },
      { status: 200 },
    );
  } catch (error) {
    return buildSafeErrorResponse(error);
  }
}
