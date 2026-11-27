import type { NextConfig } from "next";

function buildContentSecurityPolicy(isProd: boolean): string {
  // En developpement local (`npm run dev`), webpack / React Fast Refresh utilise `eval()`
  // et un WebSocket HMR local. En production (Vercel), `'unsafe-eval'` est strictement interdit.
  let scriptSrc = "script-src 'self' 'unsafe-inline'";
  let connectSrc =
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co";

  if (!isProd) {
    scriptSrc = "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
    connectSrc =
      "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* https://*.supabase.co wss://*.supabase.co";
  }

  const directives: string[] = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.supabase.co",
    "media-src 'self' data: blob: https://*.supabase.co",
    connectSrc,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];

  if (isProd) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

function buildSecurityHeaders(): Array<{ key: string; value: string }> {
  const isProd = process.env.NODE_ENV === "production";

  const headers: Array<{ key: string; value: string }> = [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(isProd),
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
    {
      key: "Cross-Origin-Opener-Policy",
      value: "same-origin",
    },
    {
      key: "Cross-Origin-Resource-Policy",
      value: "same-origin",
    },
    {
      key: "X-DNS-Prefetch-Control",
      value: "off",
    },
  ];

  if (isProd) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: buildSecurityHeaders(),
      },
    ];
  },
};

export default nextConfig;
