"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Radio } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeading } from "@/components/ui-kit";
import { api } from "@/lib/api";
import { ApiList, Reading, rows } from "@/lib/domain";

export default function AnalyticsPage() {
  const query = useQuery({ queryKey: ["readings", "analytics"], queryFn: async () => (await api.get<ApiList<Reading>>("/readings/?ordering=timestamp&page_size=100")).data });
  const readings = rows(query.data);
  const data = readings.map(item => ({ time: new Date(item.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }), gas: Number(item.gas_percentage), weight: Number(item.weight) }));
  const average = readings.length ? readings.reduce((sum, item) => sum + Number(item.gas_percentage), 0) / readings.length : null;
  const latest = readings.at(-1);
  return <div className="mx-auto max-w-[1180px]"><PageHeading title="Usage Analytics" subtitle="Live sensor history returned by the LPG Guardian backend." />{query.isLoading ? <Empty text="Loading telemetry…" /> : query.isError ? <Empty text="Telemetry could not be loaded." /> : !readings.length ? <Empty text="No sensor readings are available yet." /> : <><div className="grid gap-4 sm:grid-cols-2"><Card icon={<Activity />} title="Latest gas level" value={`${Number(latest?.gas_percentage).toFixed(1)}%`} /><Card icon={<Radio />} title="Average recorded level" value={`${average?.toFixed(1)}%`} /></div><section className="card mt-5 p-5"><h2 className="section-title">Gas level history</h2><p className="mb-5 text-xs text-slate-500">Up to the latest 100 readings</p><div className="h-[315px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid vertical={false} stroke="#e5ebf2" /><XAxis dataKey="time" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="gas" name="Gas %" fill="#073b82" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></div></section></>}</div>;
}
function Card({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) { return <article className="card p-5"><div className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-500">{icon}{title}</div><div className="mt-7 text-4xl font-black text-[#073b82]">{value}</div></article>; }
function Empty({ text }: { text: string }) { return <div className="card grid min-h-64 place-items-center text-sm text-slate-500">{text}</div>; }
