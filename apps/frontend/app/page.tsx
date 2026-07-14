"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleCheckBig,
  Clock3,
  Inbox,
  PackageCheck,
  Radio,
  ShieldAlert,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { GasRing } from "@/components/gas-ring";
import { PageHeading } from "@/components/ui-kit";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  ApiList,
  Cylinder,
  Reading,
  RefillRequest,
  RefillStatus,
  Sensor,
  rows,
} from "@/lib/domain";

export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === "technician") {
    return <TechnicianDashboard username={user.username} />;
  }
  return <MonitoringDashboard username={user?.username || "Guardian"} />;
}

function TechnicianDashboard({ username }: { username: string }) {
  const client = useQueryClient();
  const requestsQuery = useQuery({
    queryKey: ["refill-requests", "technician-dashboard"],
    queryFn: async () => (
      await api.get<ApiList<RefillRequest>>("/refill-requests/?ordering=-requested_at&page_size=100")
    ).data,
  });
  const transition = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: number; status: RefillStatus }) => (
      await api.post(`/refill-requests/${requestId}/transition/`, { status })
    ).data,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["refill-requests"] });
    },
  });

  const requests = rows(requestsQuery.data);
  const pending = requests.filter(request => request.status === "pending").length;
  const accepted = requests.filter(request => request.status === "accepted").length;
  const inTransit = requests.filter(request => request.status === "in_transit").length;
  const completed = requests.filter(request => request.status === "completed").length;
  const active = requests
    .filter(request => ["pending", "accepted", "in_transit"].includes(request.status))
    .slice(0, 5);

  return <div className="mx-auto max-w-[1180px]">
    <PageHeading
      title={`Welcome, ${username}`}
      subtitle="Receive and process refill requests assigned to your provider account."
      action={<Link href="/refills" className="btn-secondary">View all requests <ChevronRight size={14} /></Link>}
    />

    {requestsQuery.isLoading
      ? <State text="Loading assigned refill requests…" />
      : requestsQuery.isError
        ? <State text="Assigned refill requests could not be loaded." />
        : <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <RequestMetric title="Pending" value={pending} icon={Inbox} tone="orange" />
            <RequestMetric title="Accepted" value={accepted} icon={Clock3} tone="blue" />
            <RequestMetric title="In transit" value={inTransit} icon={Truck} tone="purple" />
            <RequestMetric title="Completed" value={completed} icon={CircleCheckBig} tone="green" />
          </div>

          <section className="mt-6">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="section-title">Active Requests</h2>
                <p className="mt-1 text-xs text-slate-500">Your most recent requests that still require processing.</p>
              </div>
              <span className="text-xs font-bold text-slate-500">{requests.length} total assigned</span>
            </div>
            {!active.length
              ? <div className="card grid min-h-52 place-items-center p-8 text-center text-sm text-slate-500">
                <span><PackageCheck className="mx-auto mb-3 text-green-700" size={30} />No active refill requests.</span>
              </div>
              : <div className="space-y-3">
                {active.map(request => {
                  const action = nextAction(request.status);
                  const processing = transition.isPending && transition.variables?.requestId === request.id;
                  const failed = transition.isError && transition.variables?.requestId === request.id;
                  return <article key={request.id} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm text-[#073b82]">{request.customer?.name || "Household customer"}</strong>
                          <StatusBadge status={request.status} />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Requested {new Date(request.requested_at).toLocaleString()}
                        </p>
                        {request.customer && <p className="mt-2 text-xs text-slate-600">
                          {request.customer.phone || "No phone provided"} · {request.customer.email}
                        </p>}
                      </div>
                      {action && <button
                        type="button"
                        className="btn-primary"
                        disabled={processing}
                        onClick={() => transition.mutate({ requestId: request.id, status: action.status })}
                      >
                        {processing ? "Updating…" : action.label}
                      </button>}
                    </div>
                    {failed && <p className="mt-3 text-xs text-red-700">
                      The request status could not be updated. Refresh and check its current state.
                    </p>}
                  </article>;
                })}
              </div>}
          </section>
        </>}
  </div>;
}

function MonitoringDashboard({ username }: { username: string }) {
  const cylindersQuery = useQuery({
    queryKey: ["cylinders"],
    queryFn: async () => (await api.get<ApiList<Cylinder>>("/cylinders/")).data,
  });
  const sensorsQuery = useQuery({
    queryKey: ["sensors"],
    queryFn: async () => (await api.get<ApiList<Sensor>>("/sensors/")).data,
  });
  const readingsQuery = useQuery({
    queryKey: ["readings", "latest"],
    queryFn: async () => (
      await api.get<ApiList<Reading>>("/readings/?ordering=-timestamp&page_size=10")
    ).data,
  });
  const cylinders = rows(cylindersQuery.data);
  const sensors = rows(sensorsQuery.data);
  const readings = rows(readingsQuery.data);
  const latest = readings[0];
  const gas = latest
    ? Number(latest.gas_percentage)
    : cylinders[0]
      ? Number(cylinders[0].gas_percentage)
      : null;
  const critical = readings.filter(item =>
    item.gas_leak_detected
    || Number(item.gas_percentage) <= 15
    || Number(item.temperature) >= 60,
  );
  const loading = cylindersQuery.isLoading || readingsQuery.isLoading;

  return <div className="mx-auto max-w-[1180px]">
    <PageHeading title={`Welcome back, ${username}!`} subtitle="Live LPG system status from the monitoring backend." />
    {loading
      ? <State text="Loading live monitoring data…" />
      : <>
        <div className="grid gap-5 lg:grid-cols-3">
          <section className="card p-5">
            <div className="mb-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Latest gas level</div>
            <div className="flex min-h-[205px] flex-col items-center justify-center">
              {gas === null
                ? <p className="text-xs text-slate-500">No cylinder readings received yet.</p>
                : <GasRing value={Math.round(gas)} />}
              <Link href="/cylinders" className="mt-4 text-xs font-bold text-[#073b82]">
                View cylinders <ChevronRight className="inline" size={13} />
              </Link>
            </div>
          </section>
          <Metric title="Cylinders" value={String(cylinders.length)} detail={`${cylinders.filter(x => x.status === "active").length} active`} />
          <Metric title="Sensors online" value={String(sensors.filter(x => x.online_status).length)} detail={`${sensors.length} registered`} />
        </div>
        <section className="card mt-5 p-5">
          <h2 className="section-title">Current safety status</h2>
          {critical.length
            ? <div className="mt-4 flex items-center gap-3 rounded bg-red-50 p-4 text-red-800">
              <ShieldAlert />
              <div><strong className="text-sm">{critical.length} critical reading{critical.length === 1 ? "" : "s"}</strong><p className="text-xs">Low gas, a gas leak, or high temperature requires attention.</p></div>
              <Link href="/alerts" className="ml-auto text-xs font-bold">Review</Link>
            </div>
            : <div className="mt-4 flex items-center gap-3 rounded bg-green-50 p-4 text-green-800">
              <CheckCircle2 />
              <div><strong className="text-sm">No critical readings</strong><p className="text-xs">Based on the latest telemetry received.</p></div>
            </div>}
        </section>
      </>}
  </div>;
}

function nextAction(status: RefillStatus): { status: RefillStatus; label: string } | null {
  if (status === "pending") return { status: "accepted", label: "Accept Request" };
  if (status === "accepted") return { status: "in_transit", label: "Mark In Transit" };
  if (status === "in_transit") return { status: "completed", label: "Mark Completed" };
  return null;
}

function RequestMetric({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number;
  icon: typeof Inbox;
  tone: "orange" | "blue" | "purple" | "green";
}) {
  const styles = {
    orange: "bg-orange-50 text-orange-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    green: "bg-green-50 text-green-700",
  };
  return <section className="card p-5">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{title}</span>
      <span className={`grid h-9 w-9 place-items-center rounded-lg ${styles[tone]}`}><Icon size={18} /></span>
    </div>
    <strong className="mt-5 block text-4xl text-[#073b82]">{value}</strong>
  </section>;
}

function StatusBadge({ status }: { status: RefillStatus }) {
  const tone = status === "completed"
    ? "badge-green"
    : status === "cancelled"
      ? "badge-red"
      : status === "pending"
        ? "badge-orange"
        : "badge-blue";
  return <span className={`badge ${tone}`}>{status.replaceAll("_", " ")}</span>;
}

function Metric({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <section className="card flex flex-col p-5">
    <div className="text-[11px] font-extrabold uppercase text-slate-500">{title}</div>
    <div className="my-auto flex items-center gap-4"><Radio className="text-[#073b82]" /><strong className="text-[42px] text-[#073b82]">{value}</strong></div>
    <div className="border-t border-slate-200 pt-3 text-xs text-slate-600">{detail}</div>
  </section>;
}

function State({ text }: { text: string }) {
  return <div className="card grid min-h-64 place-items-center text-sm text-slate-500">
    <span className="flex items-center gap-2"><AlertTriangle size={17} />{text}</span>
  </div>;
}
