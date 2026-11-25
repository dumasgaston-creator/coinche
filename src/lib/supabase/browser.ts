import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientEnv } from "@/lib/env/client";

/**
 * Cree le client Supabase navigateur restreint a la cle publique `anon`
 * pour les souscriptions Realtime et les lectures autorisees par RLS.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  const env = getClientEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
