import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Coinch'Eirb · Tournoi & BAR",
    short_name: "Coinch'Eirb",
    description:
      "Tournoi temps réel de coinche et parties libres au BAR de l'ENSEIRB-MATMECA.",
    start_url: "/",
    display: "standalone",
    background_color: "#14100e",
    theme_color: "#e8a628",
    lang: "fr",
    icons: [
      {
        src: "/assets/media/logo-abeilles.jpg",
        sizes: "512x512",
        type: "image/jpeg",
      },
    ],
  };
}
