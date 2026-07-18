"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Activity, AlertTriangle, Gauge, Radio, RefreshCw, Scale, ShieldCheck } from "lucide-react";
import { PageHeading } from "@/components/ui-kit";
import { api } from "@/lib/api";
import { ApiList, Cylinder, Reading, rows } from "@/lib/domain";
import { telemetryErrorMessage, toTelemetryPoints } from "@/lib/telemetry";

const TelemetryChart = dynamic(() => import("@/components/telemetry-chart"), {
  ssr: false,
  loading: () => <div className="grid h-[320px] place-items-center text-sm text-slate-500">Loading chart...</div>,
});

type History = { cylinder: number; sample_minutes: number; latest?: Reading; points: Reading[] };

export default function AnalyticsPage() {
  const [selectedCylinder, setSelectedCylinder] = useState<number | null>(null);
  const cylindersQuery = useQuery({
    queryKey: ["cylinders", "analytics"],
    queryFn: async () => (await api.get<ApiList<Cylinder>>("/cylinders/?page_size=100&include_retired=true")).data,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
  const cylinders = rows(cylindersQuery.data);
  const activeCylinder = [...cylinders].sort(
    (a, b) => new Date(b.latest_reading_at ?? 0).getTime() - new Date(a.latest_reading_at ?? 0).getTime(),
  )[0];
  const cylinderId = selectedCylinder ?? activeCylinder?.id;
  const historyQuery = useQuery({
    queryKey: ["reading-history", cylinderId],
    queryFn: async () => (await api.get<History>(`/readings/history/?cylinder=${cylinderId}&sample_minutes=15`)).data,
    enabled: cylinderId !== undefined,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: (attempt, error) => !(axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) && attempt < 1,
  });
  const currentQuery = useQuery({
    queryKey: ["latest-reading", cylinderId],
    queryFn: async () => (await api.get<ApiList<Reading>>(`/readings/?cylinder=${cylinderId}&ordering=-timestamp&page_size=1`)).data,
    enabled: cylinderId !== undefined,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const history = historyQuery.data;
  const points = toTelemetryPoints(history?.points ?? []);
  const latest = rows(currentQuery.data)[0] ?? history?.latest;
  const latestGas = latest?.gas_percentage ? Number(latest.gas_percentage) : null;
  const latestWeight = latest?.weight ? Number(latest.weight) : null;

  const loading = cylindersQuery.isLoading || historyQuery.isLoading || currentQuery.isLoading;
  const error = cylindersQuery.error ?? historyQuery.error ?? currentQuery.error;
  return <div className="mx-auto max-w-[1180px]">
    <PageHeading title="Gas usage" subtitle="Your current cylinder is refreshed every 15 seconds. History is sampled every 15 minutes so a fast ESP32 stream stays readable." />
    {loading ? <State text="Loading gas usage..." /> : error ? <ErrorState text={telemetryErrorMessage(error)} onRetry={() => { void cylindersQuery.refetch(); void historyQuery.refetch(); void currentQuery.refetch(); }} /> : !cylinderId ? <State text="Connect a sensor to a cylinder to start seeing gas usage." /> : <>
      <section className="card p-4 sm:p-5" aria-labelledby="cylinder-selection-title">
        <label id="cylinder-selection-title" className="text-xs font-extrabold uppercase text-slate-500" htmlFor="analytics-cylinder">Cylinder history</label>
        <select id="analytics-cylinder" className="mt-2 block w-full max-w-md rounded border border-slate-300 bg-white px-3 py-2 text-sm" value={cylinderId} onChange={(event) => setSelectedCylinder(Number(event.target.value))}>
          {cylinders.map((cylinder) => <option key={cylinder.id} value={cylinder.id}>Cylinder #{cylinder.id}{cylinder.id === activeCylinder?.id ? " - currently monitored" : ""}</option>)}
        </select>
        <p className="mt-2 text-xs text-slate-500">Choose an older cylinder to see its complete measured history through the last time its sensor reported.</p>
      </section>
      <div className="mt-5 grid gap-4 sm:grid-cols-1 xl:grid-cols-3">
        <Metric icon={<Gauge />} label="Current gas level" value={latestGas === null ? "Unavailable" : `${latestGas.toFixed(1)}%`} />
        <Metric icon={<Scale />} label="Current cylinder weight" value={latestWeight === null ? "Unavailable" : `${latestWeight.toFixed(1)} kg`} />
        <Metric icon={<AlertTriangle />} label="Latest safety state" value={latest?.gas_leak_detected ? "Leak detected" : "No leak detected"} danger={Boolean(latest?.gas_leak_detected)} />
      </div>
      <section className="card mt-5 p-4 sm:p-5" aria-labelledby="gas-history-title">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="gas-history-title" className="section-title">Gas level over time</h2><p id="gas-history-description" className="mt-1 text-xs text-slate-500">{points.length} sampled points from full/first measurement to the last measurement. New device reports appear within 15 seconds.</p></div><span className={`rounded px-2 py-1 text-[11px] font-bold ${latest?.hx711_ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}><ShieldCheck size={13} className="mr-1 inline" />{latest?.hx711_ok ? "Scale reporting" : "Scale needs attention"}</span></div>
        {points.length ? <TelemetryChart points={points} /> : <State text="No valid weight measurements are available for this cylinder yet." />}
      </section>
    </>}
  </div>;
}

function Metric({ icon, label, value, danger = false }: { icon: React.ReactNode; label: string; value: string; danger?: boolean }) {
  return <article className="card p-5"><div className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-500">{icon}{label}</div><div className={`mt-6 text-3xl font-black ${danger ? "text-red-700" : "text-[#073b82]"}`}>{value}</div></article>;
}
function State({ text }: { text: string }) { return <div className="card grid min-h-64 place-items-center text-sm text-slate-500"><span className="flex items-center gap-2"><Radio size={17} />{text}</span></div>; }
function ErrorState({ text, onRetry }: { text: string; onRetry: () => void }) { return <div className="card grid min-h-64 place-items-center gap-4 p-6 text-center"><p role="alert" className="text-sm text-slate-700">{text}</p><button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded bg-[#073b82] px-3 py-2 text-xs font-bold text-white"><RefreshCw size={14} />Try again</button></div>; }
