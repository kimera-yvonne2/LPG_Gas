import axios from "axios";
import type { Reading } from "./domain";

export type TelemetryPoint = {
  timestamp: string;
  label: string;
  gas: number;
  weight: number;
  temperature: number;
};

export function toTelemetryPoints(readings: Reading[]): TelemetryPoint[] {
  return readings.map((reading) => {
    const date = new Date(reading.timestamp);
    return { timestamp: reading.timestamp, label: Number.isNaN(date.getTime()) ? "Unknown time" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date), gas: Number(reading.gas_percentage), weight: Number(reading.weight), temperature: Number(reading.temperature) };
  }).filter((point) => !Number.isNaN(new Date(point.timestamp).getTime()) && Number.isFinite(point.gas) && Number.isFinite(point.weight) && Number.isFinite(point.temperature)).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function telemetryErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) return "You don’t have permission to view telemetry analytics.";
  return "Telemetry could not be loaded. Check your connection and try again.";
}
