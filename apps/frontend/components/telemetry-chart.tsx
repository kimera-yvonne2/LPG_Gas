"use client";

import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TelemetryPoint } from "@/lib/telemetry";

export default function TelemetryChart({ points }: { points: TelemetryPoint[] }) {
  const chartPoints = points.length > 40 ? points.filter((_, index) => index % Math.ceil(points.length / 40) === 0 || index === points.length - 1) : points;
  return <div className="mt-5 h-[280px] sm:h-[340px]" role="img" aria-label={`Line chart showing gas level from ${chartPoints[0]?.label} to ${chartPoints.at(-1)?.label}. Latest value is ${chartPoints.at(-1)?.gas.toFixed(1)} percent.`} aria-describedby="gas-history-description"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartPoints} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="rgba(255,255,255,.07)" /><XAxis dataKey="label" minTickGap={38} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "rgba(255,255,255,.08)" }} tickLine={false} /><YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#111f34", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, color: "#e2e8f0" }} labelStyle={{ color: "#94a3b8" }} /><Line type="monotone" dataKey="gas" name="Gas level" stroke="#fb923c" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: "#34d399", stroke: "#111f34" }} /></LineChart></ResponsiveContainer></div>;
}
