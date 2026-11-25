import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getClientEnv } from "@/lib/env/client";
import { isProductionEnvironment } from "@/lib/env/server";

/**
 * Cree un client Supabase SSR lie aux cookies de la requete courante,
 * en imposant systématiquement httpOnly, secure (en production) et sameSite=lax.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const env = getClientEnv();
  const cookieStore = await cookies();
  const secureCookie = isProductionEnvironment();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options: CookieOptions;
          }>,
        ) {
          try {
            for (const cookieItem of cookiesToSet) {
              cookieStore.set(cookieItem.name, cookieItem.value, {
                ...cookieItem.options,
                httpOnly: true,
                secure: secureCookie,
                sameSite: "lax",
                path: "/",
              });
            }
          } catch {
            // Appele depuis un Server Component en lecture seule : le rafraichissement est gere par middleware.ts
          }
        },
      },
    },
  );
}
