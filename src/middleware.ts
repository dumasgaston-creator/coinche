import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware serveur :
 * 1. Force la redirection HTTPS en production (derriere le proxy Vercel `x-forwarded-proto`).
 * 2. Rafraichit proprement les cookies de session Supabase si Supabase est configure,
 *    sans jamais bloquer l'application en cas d'absence ou de coupure reseau.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const isProd = process.env.NODE_ENV === "production";
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (isProd && forwardedProto === "http") {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 308);
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const hasValidSupabaseEnv =
    supabaseUrl !== undefined &&
    supabaseUrl.length >= 16 &&
    !supabaseUrl.includes("your-project-ref") &&
    supabaseAnonKey !== undefined &&
    supabaseAnonKey.length >= 20 &&
    !supabaseAnonKey.includes("your-public-anon-key");

  if (hasValidSupabaseEnv) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(
            cookiesToSet: Array<{
              name: string;
              value: string;
              options: CookieOptions;
            }>,
          ) {
            for (const cookieItem of cookiesToSet) {
              request.cookies.set(cookieItem.name, cookieItem.value);
              response.cookies.set(cookieItem.name, cookieItem.value, {
                ...cookieItem.options,
                httpOnly: true,
                secure: isProd,
                sameSite: "lax",
                path: "/",
              });
            }
          },
        },
      });

      await supabase.auth.getUser();
    } catch {
      // Ne bloque jamais le rendu des pages si Supabase est temporairement injoignable
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
