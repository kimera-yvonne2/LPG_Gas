import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";
import { Providers } from "./providers";

describe("Home", () => {
  it("identifies the platform", () => {
    render(<Providers><Home /></Providers>);
    expect(screen.getByRole("heading", { name: /Welcome back/ })).toBeInTheDocument();
  });
});
