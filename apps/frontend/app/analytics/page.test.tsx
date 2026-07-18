import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Reading } from "@/lib/domain";
import { telemetryErrorMessage, toTelemetryPoints } from "@/lib/telemetry";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { get } }));
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="lazy-chart" /> }));

import AnalyticsPage from "./page";

const reading = (overrides: Partial<Reading> = {}): Reading => ({ id: 1, sensor: 1, cylinder: 1, esp32_id: "ESP-1", message_id: "msg-1", timestamp: "2026-07-14T08:30:00Z", weight: "12.5", gas_percentage: "55", mq2_raw: 900, mq2_ready: true, hx711_ok: true, gas_leak_detected: false, ...overrides });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AnalyticsPage /></QueryClientProvider>);
}

describe("AnalyticsPage", () => {
  afterEach(cleanup);
  beforeEach(() => get.mockReset());

  it("shows API telemetry metrics and its accessible data table", async () => {
  get.mockImplementation((url?: string) => {
    if (!url) {
      return Promise.resolve({ data: {} });
    }

    if (url.includes("/cylinders/")) {
      return Promise.resolve({
        data: {
          results: [
            {
              id: 1,
              latest_reading_at: "2026-07-14T09:30:00Z",
            },
          ],
        },
      });
    }
    if (url.includes("/readings/history/")) {
      return Promise.resolve({
        data: {
          cylinder: 1,
          sample_minutes: 15,
          latest: reading({
            gas_percentage: "50",
            weight: "11.5",
          }),
          points: [
            reading({
              id: 1,
              gas_percentage: "55",
            }),
            reading({
              id: 2,
              timestamp: "2026-07-14T09:30:00Z",
              gas_percentage: "50",
              weight: "11.5",
            }),
          ],
        },
      });
    }

    if (url.includes("/readings/")) {
      return Promise.resolve({
        data: {
          results: [
            reading({
              gas_percentage: "50",
              weight: "11.5",
            }),
          ],
        },
      });
    }

    return Promise.resolve({ data: {} });
  });    renderPage();
    expect(await screen.findByText("Current gas level")).toBeInTheDocument();
    expect(screen.getAllByText("50.0%")).not.toHaveLength(0);
    expect(screen.getByTestId("lazy-chart")).toBeInTheDocument();
  });

  it("explains an authorization failure without exposing backend details", () => {
    expect(telemetryErrorMessage(Object.assign(new Error("Forbidden"), { isAxiosError: true, response: { status: 403 } }))).toBe("You don’t have permission to view telemetry analytics.");
  });

  it("filters malformed readings instead of charting invalid values", () => {
    const points = toTelemetryPoints([reading({ timestamp: "bad-date" }), reading({ id: 2, gas_percentage: "not-a-number" }), reading({ id: 3, timestamp: "2026-07-14T07:30:00Z" })]);
    expect(points).toHaveLength(1);
    expect(points[0].timestamp).toBe("2026-07-14T07:30:00Z");
  });

  it("shows an empty state when no valid readings are returned", async () => {
    get.mockResolvedValue({ data: [reading({ timestamp: "bad-date" })] });
    renderPage();
    await waitFor(() => expect(screen.getByText("No valid weight measurements are available for this cylinder yet.")).toBeInTheDocument());
  });
});
