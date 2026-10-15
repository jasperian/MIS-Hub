import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MIS Hub",
    short_name: "MIS Hub",
    description:
      "Equipment, people, email accounts, and network inventory in one workspace.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f9f8",
    theme_color: "#142d2b",
    orientation: "any",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
