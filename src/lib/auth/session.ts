import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { isProductionEnvironment } from "@/lib/env/server";

export const TEAM_SESSION_COOKIE_NAME = "coincheirb_team_session";
export const ADMIN_SESSION_COOKIE_NAME = "coincheirb_admin_session";
export const CLUB_ACCOUNT_COOKIE_NAME = "coincheirb_club_account";
export const TABLE_SCORER_COOKIE_NAME = "coincheirb_table_scorer";

const DEFAULT_TEAM_SESSION_TTL_SECONDS = 16 * 60 * 60; // 16 heures
const DEFAULT_ADMIN_SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 heures
const DEFAULT_CLUB_ACCOUNT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 jours
const DEFAULT_TABLE_SCORER_TTL_SECONDS = 8 * 60 * 60; // 8 heures

const teamSessionPayloadSchema = z.object({
  teamId: z.string().uuid(),
  tournamentId: z.string().uuid(),
  issuedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
});

const adminSessionPayloadSchema = z.object({
  adminId: z.string().min(3).max(80),
  displayName: z.string().min(2).max(60),
  role: z.literal("admin"),
  issuedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
});

const clubAccountPayloadSchema = z.object({
  accountId: z.string().min(3).max(80),
  pseudo: z.string().min(2).max(40),
  firstName: z.string().min(2).max(40),
  schoolYear: z.string().min(4).max(20),
  issuedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
});

const tableScorerPayloadSchema = z.object({
  matchId: z.string().min(2).max(120),
  tableCode: z.string().min(4).max(8),
  holderId: z.string().min(4).max(80),
  holderLabel: z.string().min(2).max(60),
  lockVersion: z.number().int().min(1),
  issuedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
});

export type TeamSessionPayload = z.infer<typeof teamSessionPayloadSchema>;
export type AdminSessionPayload = z.infer<typeof adminSessionPayloadSchema>;
export type ClubAccountSessionPayload = z.infer<typeof clubAccountPayloadSchema>;
export type TableScorerSessionPayload = z.infer<typeof tableScorerPayloadSchema>;

/**
 * Retourne le secret HMAC serveur (>= 32 caracteres).
 * En production, exige strictement `SESSION_HMAC_SECRET`.
 * En developpement local sans `.env.local`, derive une cle locale deterministe cote serveur uniquement.
 */
export function resolveServerHmacSecret(): string {
  const configured = process.env.SESSION_HMAC_SECRET;
  if (
    configured !== undefined &&
    configured.length >= 32 &&
    !configured.includes("replace-with-at-least-32")
  ) {
    return configured;
  }

  if (isProductionEnvironment()) {
    throw new Error(
      "SESSION_HMAC_SECRET d'au moins 32 caracteres requis en production.",
    );
  }

  return crypto
    .createHash("sha256")
    .update(`coincheirb-dev-only-hmac-secret:${process.cwd()}`)
    .digest("hex");
}

function signPayloadBase64Url(payloadB64: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");
}

function verifySignedRawPayload(token: string, secret: string): unknown | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const payloadB64 = parts[0];
  const providedSig = parts[1];
  if (payloadB64 === undefined || providedSig === undefined) {
    return null;
  }

  const expectedSig = signPayloadBase64Url(payloadB64, secret);
  const providedBuf = Buffer.from(providedSig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");

  if (providedBuf.byteLength !== expectedBuf.byteLength) {
    return null;
  }

  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  try {
    const decodedJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    return JSON.parse(decodedJson) as unknown;
  } catch {
    return null;
  }
}

/**
 * Encode et signe un jeton de session d'equipe avec HMAC-SHA256 cote serveur.
 */
export function createSignedTeamSessionToken(
  input: { teamId: string; tournamentId: string },
  secret: string,
  nowMs: number = Date.now(),
  ttlSeconds: number = DEFAULT_TEAM_SESSION_TTL_SECONDS,
): string {
  const payload: TeamSessionPayload = {
    teamId: input.teamId,
    tournamentId: input.tournamentId,
    issuedAt: Math.floor(nowMs / 1000),
    expiresAt: Math.floor(nowMs / 1000) + ttlSeconds,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = signPayloadBase64Url(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

/**
 * Verifie en temps constant la signature HMAC et la date d'expiration d'un jeton d'equipe.
 */
export function verifySignedTeamSessionToken(
  token: string,
  secret: string,
  nowMs: number = Date.now(),
): TeamSessionPayload | null {
  const decoded = verifySignedRawPayload(token, secret);
  if (decoded === null) {
    return null;
  }

  const parsed = teamSessionPayloadSchema.safeParse(decoded);
  if (!parsed.success) {
    return null;
  }

  const nowSec = Math.floor(nowMs / 1000);
  if (parsed.data.expiresAt <= nowSec) {
    return null;
  }

  return parsed.data;
}

/**
 * Encode et signe un jeton de session Administrateur avec HMAC-SHA256 cote serveur.
 */
export function createSignedAdminSessionToken(
  input: { adminId: string; displayName: string },
  secret: string,
  nowMs: number = Date.now(),
  ttlSeconds: number = DEFAULT_ADMIN_SESSION_TTL_SECONDS,
): string {
  const payload: AdminSessionPayload = {
    adminId: input.adminId,
    displayName: input.displayName,
    role: "admin",
    issuedAt: Math.floor(nowMs / 1000),
    expiresAt: Math.floor(nowMs / 1000) + ttlSeconds,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = signPayloadBase64Url(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

/**
 * Verifie en temps constant la signature HMAC et l'expiration d'un jeton Administrateur.
 */
export function verifySignedAdminSessionToken(
  token: string,
  secret: string,
  nowMs: number = Date.now(),
): AdminSessionPayload | null {
  const decoded = verifySignedRawPayload(token, secret);
  if (decoded === null) {
    return null;
  }

  const parsed = adminSessionPayloadSchema.safeParse(decoded);
  if (!parsed.success) {
    return null;
  }

  const nowSec = Math.floor(nowMs / 1000);
  if (parsed.data.expiresAt <= nowSec) {
    return null;
  }

  return parsed.data;
}

export async function setTeamSessionCookie(input: {
  teamId: string;
  tournamentId: string;
}): Promise<void> {
  const secret = resolveServerHmacSecret();
  const token = createSignedTeamSessionToken(input, secret);
  const cookieStore = await cookies();

  cookieStore.set(TEAM_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProductionEnvironment(),
    sameSite: "lax",
    path: "/",
    maxAge: DEFAULT_TEAM_SESSION_TTL_SECONDS,
  });
}

export async function getTeamSessionFromCookie(): Promise<TeamSessionPayload | null> {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(TEAM_SESSION_COOKIE_NAME);
  if (rawCookie === undefined || rawCookie.value.trim() === "") {
    return null;
  }

  try {
    const secret = resolveServerHmacSecret();
    return verifySignedTeamSessionToken(rawCookie.value, secret);
  } catch {
    return null;
  }
}

export async function clearTeamSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(TEAM_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProductionEnvironment(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Depose le cookie de session Administrateur en `httpOnly`, `secure` (prod) et `sameSite=strict`.
 */
export async function setAdminSessionCookie(input: {
  adminId: string;
  displayName: string;
}): Promise<void> {
  const secret = resolveServerHmacSecret();
  const token = createSignedAdminSessionToken(input, secret);
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProductionEnvironment(),
    sameSite: "strict",
    path: "/",
    maxAge: DEFAULT_ADMIN_SESSION_TTL_SECONDS,
  });
}

export async function getAdminSessionFromCookie(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(ADMIN_SESSION_COOKIE_NAME);
  if (rawCookie === undefined || rawCookie.value.trim() === "") {
    return null;
  }

  try {
    const secret = resolveServerHmacSecret();
    return verifySignedAdminSessionToken(rawCookie.value, secret);
  } catch {
    return null;
  }
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProductionEnvironment(),
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Jeton HMAC signe de compte joueur club (`pseudo` + mot de passe `scrypt`).
 */
export function createSignedClubAccountToken(
  input: {
    accountId: string;
    pseudo: string;
    firstName: string;
    schoolYear: string;
  },
  secret: string,
  nowMs: number = Date.now(),
  ttlSeconds: number = DEFAULT_CLUB_ACCOUNT_TTL_SECONDS,
): string {
  const payload: ClubAccountSessionPayload = {
    accountId: input.accountId,
    pseudo: input.pseudo,
    firstName: input.firstName,
    schoolYear: input.schoolYear,
    issuedAt: Math.floor(nowMs / 1000),
    expiresAt: Math.floor(nowMs / 1000) + ttlSeconds,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = signPayloadBase64Url(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

export function verifySignedClubAccountToken(
  token: string,
  secret: string,
  nowMs: number = Date.now(),
): ClubAccountSessionPayload | null {
  const decoded = verifySignedRawPayload(token, secret);
  if (decoded === null) {
    return null;
  }
  const parsed = clubAccountPayloadSchema.safeParse(decoded);
  if (!parsed.success) {
    return null;
  }
  const nowSec = Math.floor(nowMs / 1000);
  if (parsed.data.expiresAt <= nowSec) {
    return null;
  }
  return parsed.data;
}

export async function setClubAccountSessionCookie(input: {
  accountId: string;
  pseudo: string;
  firstName: string;
  schoolYear: string;
}): Promise<void> {
  const secret = resolveServerHmacSecret();
  const token = createSignedClubAccountToken(input, secret);
  const cookieStore = await cookies();
  cookieStore.set(CLUB_ACCOUNT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProductionEnvironment(),
    sameSite: "lax",
    path: "/",
    maxAge: DEFAULT_CLUB_ACCOUNT_TTL_SECONDS,
  });
}

export async function getClubAccountFromCookie(): Promise<ClubAccountSessionPayload | null> {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(CLUB_ACCOUNT_COOKIE_NAME);
  if (rawCookie === undefined || rawCookie.value.trim() === "") {
    return null;
  }
  try {
    const secret = resolveServerHmacSecret();
    return verifySignedClubAccountToken(rawCookie.value, secret);
  } catch {
    return null;
  }
}

export async function clearClubAccountSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CLUB_ACCOUNT_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProductionEnvironment(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Jeton HMAC signe de « Telephone Marqueur » pour verrouiller une table contre le troll.
 */
export function createSignedTableScorerToken(
  input: {
    matchId: string;
    tableCode: string;
    holderId: string;
    holderLabel: string;
    lockVersion: number;
  },
  secret: string,
  nowMs: number = Date.now(),
  ttlSeconds: number = DEFAULT_TABLE_SCORER_TTL_SECONDS,
): string {
  const payload: TableScorerSessionPayload = {
    matchId: input.matchId,
    tableCode: input.tableCode,
    holderId: input.holderId,
    holderLabel: input.holderLabel,
    lockVersion: input.lockVersion,
    issuedAt: Math.floor(nowMs / 1000),
    expiresAt: Math.floor(nowMs / 1000) + ttlSeconds,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = signPayloadBase64Url(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

export function verifySignedTableScorerToken(
  token: string,
  secret: string,
  nowMs: number = Date.now(),
): TableScorerSessionPayload | null {
  const decoded = verifySignedRawPayload(token, secret);
  if (decoded === null) {
    return null;
  }
  const parsed = tableScorerPayloadSchema.safeParse(decoded);
  if (!parsed.success) {
    return null;
  }
  const nowSec = Math.floor(nowMs / 1000);
  if (parsed.data.expiresAt <= nowSec) {
    return null;
  }
  return parsed.data;
}

export async function setTableScorerSessionCookie(input: {
  matchId: string;
  tableCode: string;
  holderId: string;
  holderLabel: string;
  lockVersion: number;
}): Promise<void> {
  const secret = resolveServerHmacSecret();
  const token = createSignedTableScorerToken(input, secret);
  const cookieStore = await cookies();
  cookieStore.set(TABLE_SCORER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProductionEnvironment(),
    sameSite: "lax",
    path: "/",
    maxAge: DEFAULT_TABLE_SCORER_TTL_SECONDS,
  });
}

export async function getTableScorerFromCookie(): Promise<TableScorerSessionPayload | null> {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(TABLE_SCORER_COOKIE_NAME);
  if (rawCookie === undefined || rawCookie.value.trim() === "") {
    return null;
  }
  try {
    const secret = resolveServerHmacSecret();
    return verifySignedTableScorerToken(rawCookie.value, secret);
  } catch {
    return null;
  }
}

export async function clearTableScorerSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(TABLE_SCORER_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProductionEnvironment(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
