import { describe, expect, it } from "vitest";
import { isInjectedWalletError } from "./auth";

describe("isInjectedWalletError", () => {
  it("recognizes MetaMask failures injected by a browser extension", () => {
    expect(isInjectedWalletError(new Error("Failed to connect to MetaMask"))).toBe(true);
    expect(
      isInjectedWalletError({
        message: "Provider connection failed",
        cause: new Error("MetaMask extension not found"),
      }),
    ).toBe(true);
  });

  it("does not hide application or authentication failures", () => {
    expect(isInjectedWalletError(new Error("Invalid email or password"))).toBe(false);
    expect(isInjectedWalletError({ message: "Network Error" })).toBe(false);
    expect(isInjectedWalletError(null)).toBe(false);
  });
});
