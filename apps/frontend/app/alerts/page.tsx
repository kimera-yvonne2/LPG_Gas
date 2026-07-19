"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Weight } from "lucide-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeading } from "@/components/ui-kit";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Alert, ApiList, rows } from "@/lib/domain";

export default function AlertsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && user?.role === "admin") router.replace("/dashboard");
  }, [loading, router, user]);
  const query = useQuery({
    queryKey: ["alerts"],
    enabled: user?.role === "household",
    queryFn: async () =>
      (
        await api.get<ApiList<Alert>>(
          "/alerts/?page_size=100",
        )
      ).data,
  });
  if (loading || user?.role !== "household") return null;
  const alerts = rows(query.data).flatMap((reading) => {
    const items: {
      key: string;
      title: string;
      text: string;
      timestamp: string;
      severity: "critical" | "warning";
    }[] = [];
    items.push({
      key: String(reading.id),
      title: reading.title,
      text: reading.message,
      timestamp: reading.created_at,
      severity: reading.severity,
    });
    return items;
  });
  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeading
        title="Safety Alerts"
        subtitle="Alerts calculated from live sensor readings; no sample events are shown."
      />
      {query.isLoading ? (
        <State text="Checking telemetry…" />
      ) : query.isError ? (
        <State text="Telemetry could not be loaded." />
      ) : !alerts.length ? (
        <div className="card grid min-h-64 place-items-center text-center">
          <div>
            <CheckCircle2 className="mx-auto text-green-700" size={35} />
            <h2 className="section-title mt-3">No active telemetry alerts</h2>
            <p className="mt-1 text-xs text-slate-500">
              No gas-leak or low-gas readings were found.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <article
              key={alert.key}
              className={`card flex gap-4 border-l-4 p-4 ${alert.severity === "critical" ? "border-l-red-600" : "border-l-orange-500"}`}
            >
              <span className="grid h-9 w-9 place-items-center rounded bg-orange-50 text-orange-700">
                <Weight size={18} />
              </span>
              <div className="flex-1">
                <h2 className="text-sm font-extrabold">{alert.title}</h2>
                <p className="mt-1 text-xs text-slate-600">{alert.text}</p>
              </div>
              <time className="text-[10px] text-slate-500">
                {new Date(alert.timestamp).toLocaleString()}
              </time>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
function State({ text }: { text: string }) {
  return (
    <div className="card grid min-h-64 place-items-center text-sm text-slate-500">
      <span className="flex items-center gap-2">
        <AlertTriangle size={16} />
        {text}
      </span>
    </div>
  );
}
