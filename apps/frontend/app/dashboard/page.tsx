"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, Scale, Wifi } from "lucide-react";
import { useRouter } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { GasCylinderLevel } from "@/components/gas-cylinder-level";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ApiList, Cylinder, DepletionEstimate, Reading, Sensor, rows } from "@/lib/domain";
import { telemetryErrorMessage, toTelemetryPoints } from "@/lib/telemetry";

const TelemetryChart = dynamic(() => import("@/components/telemetry-chart"), {
  ssr: false,
  loading: () => <div className="grid h-[300px] place-items-center text-sm text-slate-500">Loading chart...</div>,
});

type History = { cylinder: number; sample_minutes: number; latest?: Reading; points: Reading[] };

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [selectedCylinder, setSelectedCylinder] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && user?.role === "technician") {
      router.replace("/refills");
    }
  }, [authLoading, router, user]);

  const overviewQuery = useQuery({
    queryKey: ["household-dashboard-overview"],
    enabled: Boolean(user && user.role === "household"),
    queryFn: async () => {
      const [cylindersResponse, sensorsResponse] = await Promise.all([
        api.get<ApiList<Cylinder>>("/cylinders/?page_size=100&include_retired=true"),
        api.get<ApiList<Sensor>>("/sensors/?page_size=100"),
      ]);
      return {
        cylinders: rows(cylindersResponse.data),
        sensors: rows(sensorsResponse.data),
      };
    },
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  const cylinders = overviewQuery.data?.cylinders ?? [];
  const activeCylinder = [...cylinders].sort(
    (a, b) => new Date(b.latest_reading_at ?? 0).getTime() - new Date(a.latest_reading_at ?? 0).getTime(),
  )[0];
  const cylinderId = selectedCylinder ?? activeCylinder?.id;

  const historyQuery = useQuery({
    queryKey: ["reading-history", cylinderId],
    queryFn: async () => (await api.get<History>(`/readings/history/?cylinder=${cylinderId}&sample_minutes=15`)).data,
    enabled: Boolean(user?.role === "household" && cylinderId),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: (attempt, error) =>
      !(axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) && attempt < 1,
  });

  const currentQuery = useQuery({
    queryKey: ["latest-reading", cylinderId],
    queryFn: async () =>
      (await api.get<ApiList<Reading>>(`/readings/?cylinder=${cylinderId}&ordering=-timestamp&page_size=1`)).data,
    enabled: Boolean(user?.role === "household" && cylinderId),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const predictionQuery = useQuery({
    queryKey: ["latest-depletion-estimate", cylinderId],
    queryFn: async () =>
      (
        await api.get<{
          cylinder: number;
          estimate: DepletionEstimate | null;
          failure_reason?: string;
        }>(`/depletion-estimates/latest/?cylinder=${cylinderId}`)
      ).data,
    enabled: Boolean(user?.role === "household" && cylinderId),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  if (authLoading || !user) {
    return <div className="grid min-h-64 place-items-center text-sm font-bold text-[#073b82]">Loading your dashboard...</div>;
  }
  if (user.role === "admin") return <AdminDashboard username={user.username} />;
  if (user.role !== "household") return null;

  const history = historyQuery.data;
  const latest = rows(currentQuery.data)[0] ?? history?.latest;
  const gasLevel =
    latest?.gas_percentage !== null && latest?.gas_percentage !== undefined
      ? Number(latest.gas_percentage)
      : null;
  const weight =
    latest?.weight !== null && latest?.weight !== undefined ? Number(latest.weight) : null;
  const points = toTelemetryPoints(history?.points ?? []);
  const sensor = overviewQuery.data?.sensors.find((item) => item.cylinder === cylinderId);
  const isOnline = Boolean(sensor?.online_status && sensor?.is_active);
  const hasLeak = Boolean(latest?.gas_leak_detected);
  const estimate = predictionQuery.data?.estimate;
  const daysRemaining =
    estimate?.status === "available" && estimate.estimated_days_remaining !== null
      ? Number(estimate.estimated_days_remaining)
      : null;
  const loading = overviewQuery.isLoading || (Boolean(cylinderId) && (historyQuery.isLoading || currentQuery.isLoading));
  const error = overviewQuery.error ?? historyQuery.error ?? currentQuery.error;

  return (
    <div className="mx-auto max-w-[1120px]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-[#0b2442]">
            Hello, {user.username}
          </h1>
          <p className="mt-1 text-[12px] text-slate-500">Your gas level at a glance.</p>
        </div>
        {cylinders.length > 1 && cylinderId && (
          <div className="w-full sm:w-auto">
            <label className="label" htmlFor="dashboard-cylinder">Cylinder</label>
            <select
              id="dashboard-cylinder"
              className="field min-w-[230px]"
              value={cylinderId}
              onChange={(event) => setSelectedCylinder(Number(event.target.value))}
            >
              {cylinders.map((cylinder) => (
                <option key={cylinder.id} value={cylinder.id}>
                  Cylinder #{cylinder.id}{cylinder.id === activeCylinder?.id ? " · current" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      {loading ? (
        <State text="Loading your gas level..." />
      ) : error ? (
        <ErrorState
          text={telemetryErrorMessage(error)}
          onRetry={() => {
            void overviewQuery.refetch();
            void historyQuery.refetch();
            void currentQuery.refetch();
          }}
        />
      ) : !cylinderId ? (
        <State text="Connect a sensor and cylinder to see your gas level here." />
      ) : (
        <>
          <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]" aria-label="Current gas status">
            <article className="card min-h-[350px] p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="section-title">Gas remaining</h2>
                  <p className="mt-1 text-[11px] text-slate-500">Live cylinder reading</p>
                </div>
                <span className={`badge ${isOnline ? "badge-green" : "badge-orange"}`}>
                  <Wifi size={12} className="mr-1" aria-hidden="true" />
                  {isOnline ? "Live" : "Offline"}
                </span>
              </div>
              <div className="grid min-h-[270px] place-items-center py-3">
                {Number.isFinite(gasLevel) ? (
                  <GasCylinderLevel value={gasLevel!} />
                ) : (
                  <p className="text-sm text-slate-500">No gas reading received yet.</p>
                )}
              </div>
            </article>

            <article className="card p-5 sm:p-6">
              <h2 className="section-title">At a glance</h2>
              <div className="mt-4 divide-y divide-slate-200">
                <StatusRow
                  icon={<Scale size={18} />}
                  label="Cylinder weight"
                  value={Number.isFinite(weight) ? `${weight!.toFixed(1)} kg` : "Unavailable"}
                />
                <StatusRow
                  icon={hasLeak ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                  label="Safety"
                  value={hasLeak ? "Leak detected" : "No leak detected"}
                  danger={hasLeak}
                />
                <StatusRow
                  icon={<Clock3 size={18} />}
                  label="Estimated time left"
                  value={Number.isFinite(daysRemaining) ? `${daysRemaining!.toFixed(1)} days` : "Still learning"}
                />
              </div>
              <p className="mt-5 text-[10px] leading-4 text-slate-500">
                Updated {latest?.timestamp ? new Date(latest.timestamp).toLocaleString() : "when a new reading arrives"}.
              </p>
            </article>
          </section>

          <section className="card mt-5 p-5 sm:p-6" aria-labelledby="gas-history-title">
            <div>
              <h2 id="gas-history-title" className="section-title">Gas level history</h2>
              <p id="gas-history-description" className="mt-1 text-[11px] text-slate-500">
                See how your gas level changes over time.
              </p>
            </div>
            {points.length ? (
              <TelemetryChart points={points} />
            ) : (
              <div className="grid min-h-[220px] place-items-center text-sm text-slate-500">
                History will appear after valid readings are received.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatusRow({
  icon,
  label,
  value,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-5 first:pt-2">
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${danger ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-xs text-slate-500">{label}</span>
      <strong className={`text-right text-sm ${danger ? "text-red-700" : "text-slate-700"}`}>{value}</strong>
    </div>
  );
}

function State({ text }: { text: string }) {
  return <div className="card grid min-h-64 place-items-center p-6 text-center text-sm text-slate-500">{text}</div>;
}

function ErrorState({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="card grid min-h-64 place-items-center gap-4 p-6 text-center">
      <div>
        <AlertTriangle className="mx-auto mb-3 text-orange-700" />
        <p role="alert" className="text-sm text-slate-700">{text}</p>
      </div>
      <button type="button" onClick={onRetry} className="btn-primary">
        <RefreshCw size={14} /> Try again
      </button>
    </div>
  );
}
