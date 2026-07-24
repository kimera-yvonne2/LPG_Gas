import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("renders the public landing page", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /Know your gas level/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/auth/signup");
  });
});
