import { describe, expect, it } from "vitest";
import { postLoginPath } from "./auth-routing";

describe("postLoginPath", () => {
  it("uses the authenticated dashboard for household and admin accounts", () => {
    expect(postLoginPath(null)).toBe("/dashboard");
    expect(postLoginPath("/")).toBe("/dashboard");
    expect(postLoginPath("/auth/login")).toBe("/dashboard");
    expect(postLoginPath("/cylinders?filter=active", "household")).toBe("/dashboard");
    expect(postLoginPath("/users", "admin")).toBe("/dashboard");
  });

  it("sends technicians directly to refill requests", () => {
    expect(postLoginPath(null, "technician")).toBe("/refills");
    expect(postLoginPath("/dashboard", "technician")).toBe("/refills");
  });

  it("does not reuse a previous user's protected destination", () => {
    expect(postLoginPath("/cylinders", "technician")).toBe("/refills");
    expect(postLoginPath("//example.com", "admin")).toBe("/dashboard");
  });
});
