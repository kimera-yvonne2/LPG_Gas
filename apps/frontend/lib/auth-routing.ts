import type { Role } from "./auth";

export function postLoginPath(_next: string | null, role?: Role): string {
  // Each sign-in starts at the user's role-specific landing page. In
  // particular, do not reuse the protected route from a previous user's
  // session when they sign in from the shared browser.
  return role === "technician" ? "/refills" : "/dashboard";
}
