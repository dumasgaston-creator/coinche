import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AppHeader } from "@/components/layout/AppHeader";
import { MobileNavBar } from "@/components/layout/MobileNavBar";
import { CookieBanner } from "@/components/layout/CookieBanner";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://coincheirb.vercel.app",
  ),
  title: "Coinch'Eirb | Tournoi de Coinche ENSEIRB-MATMECA",
  description:
    "Suivi temps réel des tables, scores et poules du tournoi de coinche Coinch'Eirb à l'ENSEIRB-MATMECA.",
  icons: {
    icon: [{ url: "/assets/logo-coincheirb.jpg", type: "image/jpeg" }],
    apple: [{ url: "/assets/logo-coincheirb.jpg", type: "image/jpeg" }],
  },
  openGraph: {
    title: "Coinch'Eirb | Tournoi de Coinche ENSEIRB-MATMECA",
    description:
      "Feuilles de marque temps réel, classement des poules, arbre final et vidéoprojecteur Coinch'Eirb.",
    type: "website",
    locale: "fr_FR",
    siteName: "Coinch'Eirb",
    images: [
      {
        url: "/assets/affiche-soiree.jpg",
        width: 1080,
        height: 1080,
        alt: "Affiche officielle de la soirée tournoi Coinch'Eirb ENSEIRB-MATMECA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Coinch'Eirb | Tournoi de Coinche ENSEIRB-MATMECA",
    description:
      "Suivi temps réel des tables, scores et poules du tournoi Coinch'Eirb.",
    images: ["/assets/affiche-soiree.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7F2E8",
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("coincheirb-theme");var m="light";if(t==="dark"||t==="light"){m=t;}document.documentElement.setAttribute("data-theme",m);document.documentElement.style.colorScheme=m;}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

export default function RootLayout(props: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <AppHeader />
          <main className="app-main">{props.children}</main>
          <CookieBanner />
          <MobileNavBar />
        </ThemeProvider>
      </body>
    </html>
  );
}
