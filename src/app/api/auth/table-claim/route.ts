import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import {
  clearTableScorerSessionCookie,
  getAdminSessionFromCookie,
  getClubAccountFromCookie,
  getTableScorerFromCookie,
  setTableScorerSessionCookie,
} from "@/lib/auth/session";
import {
  deriveTableAccessCode,
  normalizeTableCodeInput,
} from "@/lib/auth/table-code";
import {
  assertTrustedMutationOrigin,
  buildSafeErrorResponse,
  getHashedRequestClientKey,
} from "@/lib/security/http";
import { checkServerRateLimit } from "@/lib/security/rate-limit";
import { sanitizePlainName } from "@/lib/security/sanitize";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface StoredTableLock {
  matchId: string;
  tableCode: string;
  holderId: string | null;
  holderLabel: string | null;
  lockVersion: number;
}

const memoryTableLocks = new Map<string, StoredTableLock>();

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

async function readTableLock(matchId: string): Promise<StoredTableLock | null> {
  if (isSupabaseConfigured()) {
    try {
      const adminClient = createSupabaseAdminClient();
      const { data, error } = await adminClient
        .from("table_scorer_locks")
        .select("match_id, table_code, holder_id, holder_label, lock_version")
        .eq("match_id", matchId)
        .maybeSingle();
      if (error === null && data !== null) {
        const row = data as {
          match_id: string;
          table_code: string;
          holder_id: string;
          holder_label: string;
          lock_version: number;
        };
        let holderId: string | null = row.holder_id;
        if (holderId === "__released__") {
          holderId = null;
        }
        return {
          matchId: row.match_id,
          tableCode: row.table_code,
          holderId,
          holderLabel: row.holder_label,
          lockVersion: Number(row.lock_version) || 1,
        };
      }
    } catch {
      // Repli memoire
    }
  }
  return memoryTableLocks.get(matchId) ?? null;
}

async function upsertTableLock(lock: StoredTableLock): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const adminClient = createSupabaseAdminClient();
      const { error } = await adminClient.from("table_scorer_locks").upsert(
        {
          match_id: lock.matchId,
          table_code: lock.tableCode,
          holder_id: lock.holderId ?? "__released__",
          holder_label: lock.holderLabel ?? "",
          lock_version: lock.lockVersion,
          claimed_at: new Date().toISOString(),
        },
        { onConflict: "match_id" },
      );
      if (error === null) {
        return;
      }
    } catch {
      // Repli memoire
    }
  }
  memoryTableLocks.set(lock.matchId, lock);
}

const claimSchema = z.object({
  matchId: z.string().min(2).max(120),
  tableNumber: z.number().int().min(1).max(99).nullable(),
  tableCode: z.string().min(4).max(8),
  holderLabel: z.string().max(60).optional(),
});

const releaseSchema = z.object({
  matchId: z.string().min(2).max(120),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const matchId = request.nextUrl.searchParams.get("matchId")?.trim() ?? "";
  const adminSession = await getAdminSessionFromCookie();
  const accountSession = await getClubAccountFromCookie();
  const scorerCookie = await getTableScorerFromCookie();

  let activeLock: StoredTableLock | null = null;
  if (matchId.length > 0) {
    activeLock = await readTableLock(matchId);
  }

  return NextResponse.json(
    {
      isAdmin: adminSession !== null,
      account: accountSession,
      scorerCookie: scorerCookie,
      activeLock: {
        holderId: activeLock?.holderId ?? null,
        holderLabel: activeLock?.holderLabel ?? null,
        lockVersion: activeLock?.lockVersion ?? 1,
      },
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertTrustedMutationOrigin(request);

    const rateDecision = await checkServerRateLimit({
      bucketKey: getHashedRequestClientKey(request, "table-claim-code"),
      maxAttempts: 12,
      windowSeconds: 300,
      blockSeconds: 300,
    });
    if (!rateDecision.allowed) {
      return NextResponse.json(
        { error: "Trop d'essais de code table. Patientez quelques minutes." },
        {
          status: 429,
          headers: { "Retry-After": String(rateDecision.retryAfterSeconds) },
        },
      );
    }

    const rawBody: unknown = await request.json();
    const parsed = claimSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Code table à 4 caractères requis." },
        { status: 400 },
      );
    }

    const { matchId, tableNumber, tableCode } = parsed.data;
    const expectedCode = deriveTableAccessCode(matchId, tableNumber);
    const providedCode = normalizeTableCodeInput(tableCode);

    if (providedCode !== expectedCode) {
      return NextResponse.json(
        {
          error:
            "Code table incorrect. Vérifiez le code à 4 caractères auprès de l'admin.",
        },
        { status: 403 },
      );
    }

    const existingLock = await readTableLock(matchId);
    const currentCookie = await getTableScorerFromCookie();
    const lockVersion = existingLock?.lockVersion ?? 1;

    if (
      existingLock !== null &&
      existingLock.holderId !== null &&
      currentCookie?.holderId !== existingLock.holderId
    ) {
      return NextResponse.json(
        {
          error:
            "Cette table est déjà verrouillée sur un autre téléphone marqueur. Demandez à l'admin de la libérer.",
        },
        { status: 423 },
      );
    }

    let holderId = currentCookie?.holderId ?? `phone-${crypto.randomUUID()}`;
    if (currentCookie?.matchId !== matchId) {
      holderId = `phone-${crypto.randomUUID()}`;
    }

    let cleanLabel = "Téléphone marqueur";
    if (
      typeof parsed.data.holderLabel === "string" &&
      parsed.data.holderLabel.trim().length >= 2
    ) {
      cleanLabel = sanitizePlainName(parsed.data.holderLabel).slice(0, 50);
    }

    await upsertTableLock({
      matchId,
      tableCode: expectedCode,
      holderId,
      holderLabel: cleanLabel,
      lockVersion,
    });

    await setTableScorerSessionCookie({
      matchId,
      tableCode: expectedCode,
      holderId,
      holderLabel: cleanLabel,
      lockVersion,
    });

    return NextResponse.json(
      {
        claimed: true,
        matchId,
        holderId,
        holderLabel: cleanLabel,
        lockVersion,
      },
      { status: 200 },
    );
  } catch (error) {
    return buildSafeErrorResponse(error);
  }
}

/**
 * DELETE (Admin uniquement) : libere le telephone marqueur d'une table et incremente `lockVersion`
 * pour invalider immediatement l'ancien cookie marqueur.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    assertTrustedMutationOrigin(request);
    await requireAdmin();

    const rawBody: unknown = await request.json();
    const parsed = releaseSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "matchId requis." },
        { status: 400 },
      );
    }

    const existing = await readTableLock(parsed.data.matchId);
    const nextVersion = (existing?.lockVersion ?? 1) + 1;

    await upsertTableLock({
      matchId: parsed.data.matchId,
      tableCode: existing?.tableCode ?? "FREE",
      holderId: null,
      holderLabel: null,
      lockVersion: nextVersion,
    });

    await clearTableScorerSessionCookie();

    return NextResponse.json(
      {
        released: true,
        matchId: parsed.data.matchId,
        lockVersion: nextVersion,
      },
      { status: 200 },
    );
  } catch (error) {
    return buildSafeErrorResponse(error);
  }
}
