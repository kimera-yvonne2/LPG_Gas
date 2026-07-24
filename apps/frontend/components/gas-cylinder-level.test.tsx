import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GasCylinderLevel, gasLevelTone } from "./gas-cylinder-level";

describe("GasCylinderLevel", () => {
  it("uses green above 60 percent", () => {
    expect(gasLevelTone(61).label).toBe("Good");
  });

  it("uses orange from 30 through 60 percent", () => {
    expect(gasLevelTone(30).label).toBe("Running low");
    expect(gasLevelTone(60).label).toBe("Running low");
  });

  it("uses red below 30 percent", () => {
    expect(gasLevelTone(29.9).label).toBe("Refill soon");
  });

  it("announces the exact gas level and status", () => {
    render(<GasCylinderLevel value={24.6} />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Gas cylinder is 24.6 percent full. Status: Refill soon.",
    );
    expect(screen.getByText("24.6%")).toBeInTheDocument();
  });
});
