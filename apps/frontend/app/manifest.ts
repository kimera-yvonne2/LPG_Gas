import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LPG Guardian",
    short_name: "LPG Guardian",
    description: "Smart LPG monitoring, safety alerts, and refill tracking.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f3f6fa",
    theme_color: "#073b82",
  };
}
