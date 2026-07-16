import type { Role } from "./auth";

export function postLoginPath(next: string | null, role?: Role): string {
  // Keep intended in-app destinations, but never send a signed-in user back to
  // the public landing/auth pages (or allow a protocol-relative redirect).
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    next !== "/" &&
    !next.startsWith("/auth/") &&
    !(role === "technician" && next === "/dashboard")
  ) {
    return next;
  }

  return role === "technician" ? "/refills" : "/dashboard";
}
