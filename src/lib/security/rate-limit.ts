import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface RateLimitConfig {
  bucketKey: string;
  maxAttempts: number;
  windowSeconds: number;
  blockSeconds: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface MemoryBucket {
  attempts: number;
  windowStartedAtMs: number;
  blockedUntilMs: number | null;
}

const memoryBuckets = new Map<string, MemoryBucket>();

/**
 * Evaluation locale deterministe en memoire (utilisee en tests unitaires
 * ou en repli si Supabase n'est pas joignable).
 */
export function evaluateInMemoryRateLimit(
  config: RateLimitConfig,
  nowMs: number = Date.now(),
): RateLimitDecision {
  const existing = memoryBuckets.get(config.bucketKey);

  if (existing === undefined) {
    memoryBuckets.set(config.bucketKey, {
      attempts: 1,
      windowStartedAtMs: nowMs,
      blockedUntilMs: null,
    });
    return {
      allowed: true,
      remaining: Math.max(config.maxAttempts - 1, 0),
      retryAfterSeconds: 0,
    };
  }

  if (existing.blockedUntilMs !== null && existing.blockedUntilMs > nowMs) {
    const retrySeconds = Math.ceil((existing.blockedUntilMs - nowMs) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: retrySeconds,
    };
  }

  const windowDurationMs = config.windowSeconds * 1000;
  if (existing.windowStartedAtMs + windowDurationMs <= nowMs) {
    memoryBuckets.set(config.bucketKey, {
      attempts: 1,
      windowStartedAtMs: nowMs,
      blockedUntilMs: null,
    });
    return {
      allowed: true,
      remaining: Math.max(config.maxAttempts - 1, 0),
      retryAfterSeconds: 0,
    };
  }

  const nextAttempts = existing.attempts + 1;
  if (nextAttempts > config.maxAttempts) {
    const blockedUntilMs = nowMs + config.blockSeconds * 1000;
    memoryBuckets.set(config.bucketKey, {
      attempts: nextAttempts,
      windowStartedAtMs: existing.windowStartedAtMs,
      blockedUntilMs,
    });
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: config.blockSeconds,
    };
  }

  memoryBuckets.set(config.bucketKey, {
    attempts: nextAttempts,
    windowStartedAtMs: existing.windowStartedAtMs,
    blockedUntilMs: null,
  });

  return {
    allowed: true,
    remaining: Math.max(config.maxAttempts - nextAttempts, 0),
    retryAfterSeconds: 0,
  };
}

export function resetInMemoryRateLimits(): void {
  memoryBuckets.clear();
}

/**
 * Consomme un jeton de limitation de debit via la fonction RPC atomique Postgres
 * (partagee entre toutes les instances serverless Vercel), avec repli memoire.
 */
export async function checkServerRateLimit(
  config: RateLimitConfig,
): Promise<RateLimitDecision> {
  try {
    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient.rpc("consume_rate_limit", {
      p_bucket_key: config.bucketKey,
      p_max_attempts: config.maxAttempts,
      p_window_seconds: config.windowSeconds,
      p_block_seconds: config.blockSeconds,
    });

    if (error !== null || !Array.isArray(data) || data.length === 0) {
      return evaluateInMemoryRateLimit(config);
    }

    const row = data[0] as {
      allowed?: unknown;
      remaining?: unknown;
      retry_after_seconds?: unknown;
    };

    if (
      typeof row.allowed === "boolean" &&
      typeof row.remaining === "number" &&
      typeof row.retry_after_seconds === "number"
    ) {
      return {
        allowed: row.allowed,
        remaining: row.remaining,
        retryAfterSeconds: row.retry_after_seconds,
      };
    }

    return evaluateInMemoryRateLimit(config);
  } catch {
    return evaluateInMemoryRateLimit(config);
  }
}
