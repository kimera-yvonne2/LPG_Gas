"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Activity, AlertTriangle, Gauge, Radio, RefreshCw, Scale } from "lucide-react";
import { PageHeading } from "@/components/ui-kit";
import { api } from "@/lib/api";
import { ApiList, Reading, rows } from "@/lib/domain";

const TelemetryChart = dynamic(() => import("@/components/telemetry-chart"), { ssr: false, loading: () => <div className="grid h-[320px] place-items-center text-sm text-slate-500">Loading chart…</div> });

export type TelemetryPoint = { timestamp: string; label: string; gas: number; weight: number; temperature: number };

export function toTelemetryPoints(readings: Reading[]): TelemetryPoint[] {
  return readings.map((reading) => {
    const date = new Date(reading.timestamp);
    return { timestamp: reading.timestamp, label: Number.isNaN(date.getTime()) ? "Unknown time" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date), gas: Number(reading.gas_percentage), weight: Number(reading.weight), temperature: Number(reading.temperature) };
  }).filter((point) => !Number.isNaN(new Date(point.timestamp).getTime()) && Number.isFinite(point.gas) && Number.isFinite(point.weight) && Number.isFinite(point.temperature)).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) return "You don’t have permission to view telemetry analytics.";
  return "Telemetry could not be loaded. Check your connection and try again.";
}

export default function AnalyticsPage() {
  const query = useQuery({ queryKey: ["readings", "analytics"], queryFn: async () => (await api.get<ApiList<Reading>>("/readings/?ordering=timestamp&page_size=100")).data, staleTime: 30_000, retry: (attempt, error) => !(axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) && attempt < 1 });
  const points = toTelemetryPoints(rows(query.data));
  const latest = points.at(-1);
  const averageGas = points.length ? points.reduce((total, point) => total + point.gas, 0) / points.length : null;
  const leakCount = rows(query.data).filter((reading) => reading.gas_leak_detected).length;

  return <div className="mx-auto max-w-[1180px]"><PageHeading title="Usage Analytics" subtitle="Sensor history, fuel level, and safety signals from your approved monitoring API." />{query.isLoading ? <State text="Loading telemetry…" /> : query.isError ? <ErrorState text={errorMessage(query.error)} onRetry={() => void query.refetch()} /> : !points.length ? <State text="No valid sensor readings are available yet." /> : <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<Gauge />} label="Latest gas level" value={`${latest?.gas.toFixed(1)}%`} /><Metric icon={<Activity />} label="Average gas level" value={`${averageGas?.toFixed(1)}%`} /><Metric icon={<Scale />} label="Latest cylinder weight" value={`${latest?.weight.toFixed(1)} kg`} /><Metric icon={<AlertTriangle />} label="Leak alerts in range" value={String(leakCount)} danger={leakCount > 0} /></div><section className="card mt-5 p-4 sm:p-5" aria-labelledby="gas-history-title"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 id="gas-history-title" className="section-title">Gas level history</h2><p id="gas-history-description" className="mt-1 text-xs text-slate-500">{points.length} valid readings, ordered from oldest to newest. The table below provides the chart data in text form.</p></div><span className="rounded bg-blue-50 px-2 py-1 text-[11px] font-bold text-[#073b82]">Live API data</span></div><TelemetryChart points={points} /></section><section className="card mt-5 overflow-hidden" aria-labelledby="telemetry-table-title"><div className="border-b border-slate-200 p-4 sm:p-5"><h2 id="telemetry-table-title" className="section-title">Recent telemetry</h2><p className="mt-1 text-xs text-slate-500">Most recent 10 valid readings.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-bold">Recorded</th><th className="px-4 py-3 font-bold">Gas</th><th className="px-4 py-3 font-bold">Weight</th><th className="px-4 py-3 font-bold">Temperature</th></tr></thead><tbody>{points.slice(-10).reverse().map((point) => <tr key={point.timestamp} className="border-t border-slate-100 text-slate-700"><td className="px-4 py-3">{point.label}</td><td className="px-4 py-3 font-bold text-[#073b82]">{point.gas.toFixed(1)}%</td><td className="px-4 py-3">{point.weight.toFixed(1)} kg</td><td className="px-4 py-3">{point.temperature.toFixed(1)}°C</td></tr>)}</tbody></table></div></section></>}</div>;
}

function Metric({ icon, label, value, danger = false }: { icon: React.ReactNode; label: string; value: string; danger?: boolean }) { return <article className="card p-5"><div className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-500">{icon}{label}</div><div className={`mt-6 text-3xl font-black ${danger ? "text-red-700" : "text-[#073b82]"}`}>{value}</div></article>; }
function State({ text }: { text: string }) { return <div className="card grid min-h-64 place-items-center text-sm text-slate-500"><span className="flex items-center gap-2"><Radio size={17} />{text}</span></div>; }
function ErrorState({ text, onRetry }: { text: string; onRetry: () => void }) { return <div className="card grid min-h-64 place-items-center gap-4 p-6 text-center"><div><AlertTriangle className="mx-auto mb-3 text-red-700" aria-hidden="true" /><p role="alert" className="text-sm text-slate-700">{text}</p></div><button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded bg-[#073b82] px-3 py-2 text-xs font-bold text-white"><RefreshCw size={14} />Try again</button></div>; }
