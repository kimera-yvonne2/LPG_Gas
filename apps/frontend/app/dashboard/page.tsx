"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, Radio } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ApiList, Cylinder, Reading, Sensor, rows } from "@/lib/domain";
import { AdminDashboard } from "@/components/admin-dashboard";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role === "technician") {
      router.replace("/refills");
    }
  }, [loading, router, user]);

  const dashboardQuery = useQuery({
    queryKey: ["household-dashboard"],
    enabled: Boolean(user && user.role === "household"),
    queryFn: async () => {
      const [cylindersResponse, sensorsResponse, readingsResponse] = await Promise.all([
        api.get<ApiList<Cylinder>>("/cylinders/"),
        api.get<ApiList<Sensor>>("/sensors/"),
        api.get<ApiList<Reading>>("/readings/?ordering=-timestamp&page_size=1"),
      ]);

      return {
        cylinders: rows(cylindersResponse.data),
        sensors: rows(sensorsResponse.data),
        readings: rows(readingsResponse.data),
      };
    },
    staleTime: 30_000,
  });

  if (loading || !user) {
    return (
      <div className="grid min-h-64 place-items-center text-sm font-bold text-[#073b82]">
        Loading your dashboard…
      </div>
    );
  }

  if (user.role === "admin") return <AdminDashboard username={user.username} />;

  if (user.role !== "household") return null;

  const cylinders = dashboardQuery.data?.cylinders ?? [];
  const sensors = dashboardQuery.data?.sensors ?? [];
  const latestReading = dashboardQuery.data?.readings[0];
  const activeCylinders = cylinders.filter((cylinder) => cylinder.status === "active").length;
  const onlineSensors = sensors.filter((sensor) => sensor.online_status && sensor.is_active).length;
  const gasLevel = latestReading ? Number(latestReading.gas_percentage) : null;
  const hasCriticalReading = Boolean(
    latestReading &&
      (latestReading.gas_leak_detected ||
        Number(latestReading.temperature) >= 60 ||
        Number(latestReading.gas_percentage) <= 5),
  );

  return (
    <div className="mx-auto max-w-[1180px]">
      <header className="mb-7">
        <h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-[#0b2442]">
          Welcome back, {user.username}!
        </h1>
        <p className="mt-1 text-[13px] text-[#56677d]">
          Live LPG system status from the monitoring backend.
        </p>
      </header>

      <section className="grid gap-5 md:grid-cols-3" aria-label="System overview">
        <article className="card flex min-h-[280px] flex-col p-5">
          <h2 className="text-[12px] font-extrabold uppercase tracking-wide text-slate-500">
            Latest gas level
          </h2>
          <div className="grid flex-1 place-items-center py-6 text-center">
            {dashboardQuery.isLoading ? (
              <p className="text-[13px] text-slate-500">Loading latest reading…</p>
            ) : Number.isFinite(gasLevel) ? (
              <div>
                <div className="text-[40px] font-black text-[#073b82]">{gasLevel!.toFixed(1)}%</div>
                <p className="mt-2 text-[12px] text-slate-500">Latest cylinder reading</p>
              </div>
            ) : (
              <div>
                <p className="text-[13px] text-slate-500">No cylinder readings received yet.</p>
                <Link
                  href="/cylinders"
                  className="mt-4 inline-flex items-center gap-1 text-[12px] font-extrabold text-[#071425]"
                >
                  View cylinders <ChevronRight size={14} aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </article>

        <MetricCard
          label="Cylinders"
          value={activeCylinders}
          footer={`${activeCylinders} active`}
          loading={dashboardQuery.isLoading}
        />
        <MetricCard
          label="Sensors online"
          value={onlineSensors}
          footer={`${sensors.length} registered`}
          loading={dashboardQuery.isLoading}
        />
      </section>

      <section className="card mt-5 p-5" aria-labelledby="safety-status-title">
        <h2 id="safety-status-title" className="text-[17px] font-extrabold text-[#0b2442]">
          Current safety status
        </h2>
        <div
          className={`mt-4 flex min-h-[72px] items-center gap-3 rounded-md px-4 py-3 ${
            hasCriticalReading ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"
          }`}
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-current">
            <Check size={14} strokeWidth={3} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[13px] font-extrabold">
              {hasCriticalReading ? "Critical reading detected" : "No critical readings"}
            </p>
            <p className="mt-0.5 text-[12px]">
              {hasCriticalReading
                ? "Review the latest alert and check your LPG system immediately."
                : "Based on the latest telemetry received."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  footer,
  loading,
}: {
  label: string;
  value: number;
  footer: string;
  loading: boolean;
}) {
  return (
    <article className="card flex min-h-[280px] flex-col p-5">
      <h2 className="text-[12px] font-extrabold uppercase tracking-wide text-slate-500">{label}</h2>
      <div className="flex flex-1 items-center gap-4 text-[#073b82]">
        <Radio size={23} aria-hidden="true" />
        <strong className="text-[40px] font-black leading-none">{loading ? "—" : value}</strong>
      </div>
      <p className="border-t border-slate-200 pt-3 text-[12px] text-[#35506f]">
        {loading ? "Loading…" : footer}
      </p>
    </article>
  );
}
