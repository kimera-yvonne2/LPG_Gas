export function postLoginPath(next: string | null): string {
  // Keep intended in-app destinations, but never send a signed-in user back to
  // the public landing/auth pages (or allow a protocol-relative redirect).
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    next !== "/" &&
    !next.startsWith("/auth/")
  ) {
    return next;
  }

  return "/dashboard";
}
