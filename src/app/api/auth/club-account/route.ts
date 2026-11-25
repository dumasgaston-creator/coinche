import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hashSecret, verifySecret } from "@/lib/auth/password";
import {
  clearClubAccountSessionCookie,
  getClubAccountFromCookie,
  setClubAccountSessionCookie,
} from "@/lib/auth/session";
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
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface StoredClubAccountRecord {
  id: string;
  pseudo: string;
  normalizedPseudo: string;
  firstName: string;
  passwordHash: string;
  schoolYear: string;
  createdAt: string;
}

// Repli memoire serveur en dev local sans Supabase (les mots de passe restent haches en scrypt)
const memoryClubAccounts = new Map<string, StoredClubAccountRecord>();

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

const clubAuthSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("register"),
    pseudo: z.string().trim().min(2).max(40),
    firstName: z.string().trim().min(2).max(40),
    password: z.string().min(6).max(100),
  }),
  z.object({
    mode: z.literal("login"),
    pseudo: z.string().trim().min(2).max(40),
    password: z.string().min(6).max(100),
  }),
]);

async function listVerifiedPseudos(): Promise<string[]> {
  if (isSupabaseConfigured()) {
    try {
      const adminClient = createSupabaseAdminClient();
      const { data, error } = await adminClient
        .from("club_accounts")
        .select("pseudo, first_name")
        .limit(300);
      if (error === null && Array.isArray(data)) {
        const out: string[] = [];
        for (const row of data) {
          const typed = row as { pseudo?: string; first_name?: string };
          if (typeof typed.pseudo === "string") {
            out.push(typed.pseudo);
          }
          if (typeof typed.first_name === "string") {
            out.push(typed.first_name);
          }
        }
        return out;
      }
    } catch {
      // Repli memoire
    }
  }

  const out: string[] = [];
  for (const acc of memoryClubAccounts.values()) {
    out.push(acc.pseudo);
    out.push(acc.firstName);
  }
  return out;
}

async function findAccountByNormalizedPseudo(
  normalizedPseudo: string,
): Promise<StoredClubAccountRecord | null> {
  if (isSupabaseConfigured()) {
    try {
      const adminClient = createSupabaseAdminClient();
      const { data, error } = await adminClient
        .from("club_accounts")
        .select(
          "id, pseudo, normalized_pseudo, first_name, password_hash, school_year, created_at",
        )
        .eq("normalized_pseudo", normalizedPseudo)
        .maybeSingle();

      if (error === null && data !== null) {
        const row = data as {
          id: string;
          pseudo: string;
          normalized_pseudo: string;
          first_name: string;
          password_hash: string;
          school_year: string;
          created_at: string;
        };
        return {
          id: row.id,
          pseudo: row.pseudo,
          normalizedPseudo: row.normalized_pseudo,
          firstName: row.first_name,
          passwordHash: row.password_hash,
          schoolYear: row.school_year,
          createdAt: row.created_at,
        };
      }
    } catch {
      // Repli memoire
    }
  }
  return memoryClubAccounts.get(normalizedPseudo) ?? null;
}

async function saveNewAccount(
  record: StoredClubAccountRecord,
): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const adminClient = createSupabaseAdminClient();
      const { error } = await adminClient.from("club_accounts").insert({
        id: record.id,
        pseudo: record.pseudo,
        normalized_pseudo: record.normalizedPseudo,
        first_name: record.firstName,
        password_hash: record.passwordHash,
        school_year: record.schoolYear,
        created_at: record.createdAt,
      });
      if (error === null) {
        return;
      }
    } catch {
      // Repli memoire
    }
  }
  memoryClubAccounts.set(record.normalizedPseudo, record);
}

export async function GET(): Promise<NextResponse> {
  const session = await getClubAccountFromCookie();
  const verifiedPseudos = await listVerifiedPseudos();

  if (session === null) {
    return NextResponse.json(
      {
        authenticated: false,
        account: null,
        verifiedPseudos,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      account: {
        id: session.accountId,
        pseudo: session.pseudo,
        firstName: session.firstName,
        schoolYear: session.schoolYear,
      },
      verifiedPseudos,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertTrustedMutationOrigin(request);

    const rateDecision = await checkServerRateLimit({
      bucketKey: getHashedRequestClientKey(request, "club-account-auth"),
      maxAttempts: 10,
      windowSeconds: 300,
      blockSeconds: 600,
    });
    if (!rateDecision.allowed) {
      return NextResponse.json(
        { error: "Trop de tentatives. Patientez quelques minutes." },
        {
          status: 429,
          headers: { "Retry-After": String(rateDecision.retryAfterSeconds) },
        },
      );
    }

    const rawBody: unknown = await request.json();
    const parsed = clubAuthSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Pseudo (min. 2 car.) et mot de passe (min. 6 car.) requis.",
        },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const cleanPseudo = sanitizePlainName(data.pseudo).slice(0, 40);
    const normPseudo = normalizeComparisonKey(cleanPseudo);

    if (normPseudo.length < 2) {
      return NextResponse.json(
        { error: "Pseudo invalide." },
        { status: 400 },
      );
    }

    if (data.mode === "register") {
      const existing = await findAccountByNormalizedPseudo(normPseudo);
      if (existing !== null) {
        return NextResponse.json(
          {
            error:
              "Ce pseudo est déjà protégé par un compte. Connectez-vous avec votre mot de passe.",
          },
          { status: 409 },
        );
      }

      const cleanFirst = sanitizePlainName(data.firstName).slice(0, 40);
      if (cleanFirst.length < 2) {
        return NextResponse.json(
          { error: "Prénom requis (min. 2 caractères)." },
          { status: 400 },
        );
      }

      const passwordHash = await hashSecret(data.password);
      const accountId = `acc-${crypto.randomUUID()}`;
      const newRecord: StoredClubAccountRecord = {
        id: accountId,
        pseudo: cleanPseudo,
        normalizedPseudo: normPseudo,
        firstName: cleanFirst,
        passwordHash,
        schoolYear: "2026-2027",
        createdAt: new Date().toISOString(),
      };

      await saveNewAccount(newRecord);
      await setClubAccountSessionCookie({
        accountId: newRecord.id,
        pseudo: newRecord.pseudo,
        firstName: newRecord.firstName,
        schoolYear: newRecord.schoolYear,
      });

      return NextResponse.json(
        {
          authenticated: true,
          account: {
            id: newRecord.id,
            pseudo: newRecord.pseudo,
            firstName: newRecord.firstName,
            schoolYear: newRecord.schoolYear,
          },
          verifiedPseudos: await listVerifiedPseudos(),
        },
        { status: 201 },
      );
    }

    // Mode login
    const existing = await findAccountByNormalizedPseudo(normPseudo);
    if (existing === null) {
      return NextResponse.json(
        { error: "Pseudo ou mot de passe incorrect." },
        { status: 401 },
      );
    }

    const ok = await verifySecret(data.password, existing.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Pseudo ou mot de passe incorrect." },
        { status: 401 },
      );
    }

    await setClubAccountSessionCookie({
      accountId: existing.id,
      pseudo: existing.pseudo,
      firstName: existing.firstName,
      schoolYear: existing.schoolYear,
    });

    return NextResponse.json(
      {
        authenticated: true,
        account: {
          id: existing.id,
          pseudo: existing.pseudo,
          firstName: existing.firstName,
          schoolYear: existing.schoolYear,
        },
        verifiedPseudos: await listVerifiedPseudos(),
      },
      { status: 200 },
    );
  } catch (error) {
    return buildSafeErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    assertTrustedMutationOrigin(request);
    await clearClubAccountSessionCookie();
    return NextResponse.json({ authenticated: false }, { status: 200 });
  } catch (error) {
    return buildSafeErrorResponse(error);
  }
}
