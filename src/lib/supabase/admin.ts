import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env/server";

/**
 * Client d'administration strictement cote serveur (`service_role`).
 * Ne doit etre invoque qu'apres verification explicite des droits et anti-IDOR dans `guards.ts`.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const env = getServerEnv();

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
