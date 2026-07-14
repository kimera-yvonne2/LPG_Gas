import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("renders the public landing page", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: /Know your gas level/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/auth/signup");
  });
});
