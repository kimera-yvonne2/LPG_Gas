import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

import AnalyticsPage from "./page";

describe("AnalyticsPage", () => {
  it("sends the retired analytics route to the dashboard", () => {
    render(<AnalyticsPage />);
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
