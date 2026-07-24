import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lumora",
    short_name: "Lumora",
    description: "Smart LPG monitoring, safety alerts, and refill tracking.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#08111f",
    theme_color: "#f97316",
  };
}
