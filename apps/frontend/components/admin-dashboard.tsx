"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Radio,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { User } from "@/lib/auth";
import {
  ApiList,
  Cylinder,
  Household,
  Reading,
  RefillRequest,
  Sensor,
  rows,
} from "@/lib/domain";

type AdminOverview = {
  users: ApiList<User>;
  households: ApiList<Household>;
  cylinders: ApiList<Cylinder>;
  sensors: ApiList<Sensor>;
  readings: ApiList<Reading>;
  refills: ApiList<RefillRequest>;
};

export function AdminDashboard({ username }: { username: string }) {
  const query = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async (): Promise<AdminOverview> => {
      const [users, households, cylinders, sensors, readings, refills] = await Promise.all([
        api.get<ApiList<User>>("/users/?page_size=100"),
        api.get<ApiList<Household>>("/households/?page_size=100"),
        api.get<ApiList<Cylinder>>("/cylinders/?page_size=100"),
        api.get<ApiList<Sensor>>("/sensors/?page_size=100"),
        api.get<ApiList<Reading>>("/readings/?ordering=-timestamp&page_size=100"),
        api.get<ApiList<RefillRequest>>("/refill-requests/?ordering=-requested_at&page_size=100"),
      ]);
      return {
        users: users.data,
        households: households.data,
        cylinders: cylinders.data,
        sensors: sensors.data,
        readings: readings.data,
        refills: refills.data,
      };
    },
    staleTime: 30_000,
  });

  const users = rows(query.data?.users);
  const sensors = rows(query.data?.sensors);
  const readings = rows(query.data?.readings);
  const refills = rows(query.data?.refills);
  const urgentReadings = readings.filter(reading =>
    reading.gas_leak_detected ||
    (reading.gas_percentage !== null && Number(reading.gas_percentage) <= 15),
  );
  const openRefills = refills.filter(request => !["completed", "cancelled"].includes(request.status));

  return <div className="mx-auto max-w-[1180px]">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#0b58b5]">Platform administration</p>
        <h1 className="mt-1 text-[26px] font-extrabold tracking-[-0.02em] text-[#0b2442]">Welcome back, {username}</h1>
        <p className="mt-1 text-[13px] text-[#56677d]">Full operational visibility and control across LPG Guardian.</p>
      </div>
      <Link href="/users" className="btn-primary"><Users size={15} /> Manage Users</Link>
    </header>

    {query.isError && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      The platform overview could not be loaded. Individual administration pages remain available below.
    </div>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Platform totals">
      <Metric label="Platform users" value={total(query.data?.users)} detail={`${users.filter(user => user.is_active).length} active`} icon={<Users />} loading={query.isLoading} />
      <Metric label="Households" value={total(query.data?.households)} detail="Registered customers" icon={<ShieldCheck />} loading={query.isLoading} />
      <Metric label="Cylinders" value={total(query.data?.cylinders)} detail={`${sensors.filter(sensor => sensor.online_status && sensor.is_active).length} sensors online`} icon={<Radio />} loading={query.isLoading} />
      <Metric label="Open refills" value={openRefills.length} detail={`${refills.filter(request => request.status === "pending").length} awaiting acceptance`} icon={<Truck />} loading={query.isLoading} />
    </section>

    <section className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div><h2 className="section-title">Recent refill operations</h2><p className="mt-1 text-xs text-slate-500">Latest requests across all households and technicians.</p></div>
          <Link href="/refills" className="text-xs font-extrabold text-[#073b82]">View all</Link>
        </div>
        {query.isLoading ? <State text="Loading refill operations…" /> : !refills.length ? <State text="No refill requests have been submitted." /> : <div className="divide-y divide-slate-100">
          {refills.slice(0, 5).map(request => <div key={request.id} className="flex items-center gap-3 px-5 py-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-[#073b82]"><Truck size={17} /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold">{request.customer?.name || `Household #${request.household}`}</p><p className="mt-1 text-[10px] text-slate-500">{new Date(request.requested_at).toLocaleString()}</p></div>
            <span className={`badge ${request.status === "completed" ? "badge-green" : request.status === "cancelled" ? "badge-red" : "badge-orange"}`}>{request.status.replace("_", " ")}</span>
          </div>)}
        </div>}
      </div>

      <div className="space-y-5">
        <article className={`card p-5 ${urgentReadings.length ? "border-red-200" : "border-green-200"}`}>
          <div className="flex items-start gap-3">
            {urgentReadings.length ? <AlertTriangle className="text-red-700" /> : <CheckCircle2 className="text-green-700" />}
            <div><h2 className="section-title">Safety status</h2><p className="mt-1 text-xs text-slate-600">{urgentReadings.length ? `${urgentReadings.length} warning readings require review.` : "No warnings in the latest telemetry."}</p></div>
          </div>
          <Link href="/analytics" className="btn-secondary mt-5 w-full">Review Telemetry <ArrowRight size={14} /></Link>
        </article>
        <nav className="card p-5" aria-label="Administration shortcuts">
          <h2 className="section-title">Administration</h2>
          <div className="mt-3 divide-y divide-slate-100">
            <AdminLink href="/users" label="Users and roles" />
            <AdminLink href="/cylinders" label="Households, cylinders and devices" />
            <AdminLink href="/analytics" label="Platform telemetry and analytics" />
            <AdminLink href="/refills" label="All refill requests" />
          </div>
        </nav>
      </div>
    </section>
  </div>;
}

function total<T>(data?: ApiList<T>) { return data && !Array.isArray(data) ? data.count : rows(data).length; }
function Metric({ label, value, detail, icon, loading }: { label: string; value: number; detail: string; icon: React.ReactNode; loading: boolean }) { return <article className="card p-5"><div className="flex items-center justify-between text-[#073b82]"><span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{label}</span>{icon}</div><div className="mt-5 text-3xl font-black text-[#0b2442]">{loading ? "—" : value}</div><p className="mt-2 text-[11px] text-slate-500">{loading ? "Loading…" : detail}</p></article>; }
function State({ text }: { text: string }) { return <div className="grid min-h-48 place-items-center p-5 text-xs text-slate-500">{text}</div>; }
function AdminLink({ href, label }: { href: string; label: string }) { return <Link href={href} className="flex items-center justify-between py-3 text-xs font-bold text-slate-700 hover:text-[#073b82]"><span>{label}</span><ArrowRight size={14} /></Link>; }
