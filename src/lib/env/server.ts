import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SESSION_HMAC_SECRET: z.string().min(32),
  ADMIN_BOOTSTRAP_PASSWORD_HASH: z.string().optional(),
});

export interface ServerEnv {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SESSION_HMAC_SECRET: string;
  ADMIN_BOOTSTRAP_PASSWORD_HASH: string | undefined;
}

export function isProductionEnvironment(): boolean {
  if (process.env.NODE_ENV === "production") {
    return true;
  }
  return false;
}

/**
 * Lit et valide les secrets strictement cote serveur.
 * Protege au build par `server-only` contre toute importation dans un composant client.
 */
export function getServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SESSION_HMAC_SECRET: process.env.SESSION_HMAC_SECRET,
    ADMIN_BOOTSTRAP_PASSWORD_HASH: process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH,
  });

  if (!parsed.success) {
    const missingKeys = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Variables d'environnement serveur invalides ou manquantes : ${missingKeys}`,
    );
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
    SESSION_HMAC_SECRET: parsed.data.SESSION_HMAC_SECRET,
    ADMIN_BOOTSTRAP_PASSWORD_HASH: parsed.data.ADMIN_BOOTSTRAP_PASSWORD_HASH,
  };
}
