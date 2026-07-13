"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronRight, Radio, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { GasRing } from "@/components/gas-ring";
import { PageHeading } from "@/components/ui-kit";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ApiList, Cylinder, Reading, Sensor, rows } from "@/lib/domain";

export default function Dashboard() {
  const { user } = useAuth();
  const cylindersQuery = useQuery({ queryKey: ["cylinders"], queryFn: async () => (await api.get<ApiList<Cylinder>>("/cylinders/")).data });
  const sensorsQuery = useQuery({ queryKey: ["sensors"], queryFn: async () => (await api.get<ApiList<Sensor>>("/sensors/")).data });
  const readingsQuery = useQuery({ queryKey: ["readings", "latest"], queryFn: async () => (await api.get<ApiList<Reading>>("/readings/?ordering=-timestamp&page_size=10")).data });
  const cylinders = rows(cylindersQuery.data); const sensors = rows(sensorsQuery.data); const readings = rows(readingsQuery.data);
  const latest = readings[0]; const gas = latest ? Number(latest.gas_percentage) : cylinders[0] ? Number(cylinders[0].gas_percentage) : null;
  const critical = readings.filter(item => item.gas_leak_detected || Number(item.gas_percentage) <= 15 || Number(item.temperature) >= 60);
  const loading = cylindersQuery.isLoading || readingsQuery.isLoading;
  return <div className="mx-auto max-w-[1180px]"><PageHeading title={`Welcome back, ${user?.username || "Guardian"}!`} subtitle="Live LPG system status from the monitoring backend." />{loading ? <State text="Loading live monitoring data…" /> : <><div className="grid gap-5 lg:grid-cols-3"><section className="card p-5"><div className="mb-4 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Latest gas level</div><div className="flex min-h-[205px] flex-col items-center justify-center">{gas === null ? <p className="text-xs text-slate-500">No cylinder readings received yet.</p> : <GasRing value={Math.round(gas)} />}<Link href="/cylinders" className="mt-4 font-bold text-[#073b82] text-xs">View cylinders <ChevronRight className="inline" size={13} /></Link></div></section><Metric title="Cylinders" value={String(cylinders.length)} detail={`${cylinders.filter(x => x.status === "active").length} active`} /><Metric title="Sensors online" value={String(sensors.filter(x => x.online_status).length)} detail={`${sensors.length} registered`} /></div><section className="card mt-5 p-5"><h2 className="section-title">Current safety status</h2>{critical.length ? <div className="mt-4 flex items-center gap-3 rounded bg-red-50 p-4 text-red-800"><ShieldAlert /><div><strong className="text-sm">{critical.length} critical reading{critical.length === 1 ? "" : "s"}</strong><p className="text-xs">Low gas or high temperature requires attention.</p></div><Link href="/alerts" className="ml-auto text-xs font-bold">Review</Link></div> : <div className="mt-4 flex items-center gap-3 rounded bg-green-50 p-4 text-green-800"><CheckCircle2 /><div><strong className="text-sm">No critical readings</strong><p className="text-xs">Based on the latest telemetry received.</p></div></div>}</section></>}</div>;
}
function Metric({ title, value, detail }: { title: string; value: string; detail: string }) { return <section className="card flex flex-col p-5"><div className="text-[11px] font-extrabold uppercase text-slate-500">{title}</div><div className="my-auto flex items-center gap-4"><Radio className="text-[#073b82]" /><strong className="text-[42px] text-[#073b82]">{value}</strong></div><div className="border-t border-slate-200 pt-3 text-xs text-slate-600">{detail}</div></section>; }
function State({ text }: { text: string }) { return <div className="card grid min-h-64 place-items-center text-sm text-slate-500"><span className="flex items-center gap-2"><AlertTriangle size={17} />{text}</span></div>; }
