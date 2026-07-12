"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { FormEvent, useState } from "react";
import { GasRing } from "@/components/gas-ring";
import { Modal, PageHeading } from "@/components/ui-kit";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ApiList, Cylinder, Household, Sensor, rows } from "@/lib/domain";

export default function CylindersPage() {
  const { user } = useAuth(); const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ household: "", serial_number: "", capacity: "12", empty_weight: "", current_weight: "", installation_date: new Date().toISOString().slice(0, 10), status: "active" });
  const cylindersQuery = useQuery({ queryKey: ["cylinders"], queryFn: async () => (await api.get<ApiList<Cylinder>>("/cylinders/")).data });
  const householdsQuery = useQuery({ queryKey: ["households"], queryFn: async () => (await api.get<ApiList<Household>>("/households/")).data });
  const sensorsQuery = useQuery({ queryKey: ["sensors"], queryFn: async () => (await api.get<ApiList<Sensor>>("/sensors/")).data });
  const mutation = useMutation({ mutationFn: async () => (await api.post("/cylinders/", { ...form, household: Number(form.household) })).data, onSuccess: async () => { await client.invalidateQueries({ queryKey: ["cylinders"] }); setOpen(false); } });
  const cylinders = rows(cylindersQuery.data); const households = rows(householdsQuery.data); const sensors = rows(sensorsQuery.data);
  const canAdd = user?.role !== "technician";
  const submit = (event: FormEvent) => { event.preventDefault(); mutation.mutate(); };
  return <div className="mx-auto max-w-[1180px]"><PageHeading title="Cylinder Management" subtitle="Live cylinders and connected monitoring hardware." action={canAdd ? <button onClick={() => setOpen(true)} className="btn-primary"><Plus size={15} /> Add Cylinder</button> : undefined} />{cylindersQuery.isLoading ? <Empty text="Loading cylinders…" /> : cylindersQuery.isError ? <Empty text="Cylinders could not be loaded." /> : !cylinders.length ? <Empty text="No cylinders have been registered for this account." /> : <div className="grid gap-4 lg:grid-cols-2">{cylinders.map(cylinder => { const sensor = sensors.find(item => item.cylinder === cylinder.id); return <article key={cylinder.id} className="card p-5"><div className="flex items-start justify-between"><div><div className="text-sm font-extrabold text-[#073b82]">{cylinder.serial_number}</div><div className="mt-1 text-xs text-slate-500">{cylinder.household_name}</div></div><span className={`badge ${cylinder.status === "active" ? "badge-green" : "badge-orange"}`}>{cylinder.status}</span></div><div className="mt-5 grid items-center gap-5 sm:grid-cols-[150px_1fr]"><GasRing value={Math.round(Number(cylinder.gas_percentage))} size={145} /><dl className="grid grid-cols-2 gap-3 text-xs"><Datum label="Capacity" value={`${cylinder.capacity} kg`} /><Datum label="Current weight" value={`${cylinder.current_weight} kg`} /><Datum label="Installed" value={new Date(cylinder.installation_date).toLocaleDateString()} /><Datum label="Sensor" value={sensor ? `${sensor.esp32_id} · ${sensor.online_status ? "Online" : "Offline"}` : "Not connected"} /></dl></div></article>; })}</div>}<Modal open={open} title="Register Cylinder" onClose={() => setOpen(false)}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><label className="label">Household</label><select required className="field" value={form.household} onChange={e => setForm({ ...form, household: e.target.value })}><option value="">Select household</option>{households.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>{(["serial_number", "capacity", "empty_weight", "current_weight", "installation_date"] as const).map(name => <div key={name}><label className="label capitalize">{name.replaceAll("_", " ")}</label><input required type={name === "installation_date" ? "date" : name === "serial_number" ? "text" : "number"} step="0.001" className="field" value={form[name]} onChange={e => setForm({ ...form, [name]: e.target.value })} /></div>)}{mutation.isError && <p className="sm:col-span-2 text-xs text-red-700">The backend rejected this cylinder. Check all values and permissions.</p>}<div className="sm:col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button disabled={mutation.isPending} className="btn-primary">{mutation.isPending ? "Saving…" : "Register"}</button></div></form></Modal></div>;
}
function Datum({ label, value }: { label: string; value: string }) { return <div className="rounded bg-slate-50 p-3"><dt className="text-[9px] font-bold uppercase text-slate-500">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>; }
function Empty({ text }: { text: string }) { return <div className="card grid min-h-64 place-items-center text-sm text-slate-500">{text}</div>; }
