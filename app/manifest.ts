import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NEXT",
    short_name: "NEXT",
    description: "Company hub for events, announcements, engagement, and rewards.",
    start_url: "/login",
    display: "standalone",
    background_color: "#F6F8FB",
    theme_color: "#002E6D",
    icons: [
      {
        src: "/next.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
