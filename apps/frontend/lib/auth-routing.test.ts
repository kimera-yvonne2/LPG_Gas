import { describe, expect, it } from "vitest";
import { postLoginPath } from "./auth-routing";

describe("postLoginPath", () => {
  it("uses the authenticated dashboard when no protected destination was requested", () => {
    expect(postLoginPath(null)).toBe("/dashboard");
    expect(postLoginPath("/")).toBe("/dashboard");
    expect(postLoginPath("/auth/login")).toBe("/dashboard");
  });

  it("sends technicians directly to refill requests", () => {
    expect(postLoginPath(null, "technician")).toBe("/refills");
    expect(postLoginPath("/dashboard", "technician")).toBe("/refills");
  });

  it("preserves safe protected destinations", () => {
    expect(postLoginPath("/cylinders?filter=active")).toBe("/cylinders?filter=active");
  });

  it("rejects external protocol-relative destinations", () => {
    expect(postLoginPath("//example.com")).toBe("/dashboard");
  });
});
