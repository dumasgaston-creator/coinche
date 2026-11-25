import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://coincheirb.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/ma-table", "/classement", "/regles", "/equipe", "/settings", "/live", "/mentions-legales"],
        disallow: ["/admin", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
