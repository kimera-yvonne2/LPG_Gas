"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, Plus, Truck } from "lucide-react";
import { FormEvent, useState } from "react";
import { Modal, PageHeading } from "@/components/ui-kit";
import { api } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { useAuth } from "@/lib/auth";
import {
  ApiList,
  Cylinder,
  RefillProvider,
  RefillRequest,
  RefillStatus,
  rows,
} from "@/lib/domain";

export default function RefillsPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ cylinder: "", provider: "" });
  const isHousehold = user?.role === "household";
  const cylindersQuery = useQuery({
    queryKey: ["cylinders"],
    queryFn: async () => (await api.get<ApiList<Cylinder>>("/cylinders/")).data,
    enabled: isHousehold,
  });
  const providersQuery = useQuery({
    queryKey: ["refill-providers"],
    queryFn: async () => (await api.get<ApiList<RefillProvider>>("/refill-providers/")).data,
    enabled: isHousehold,
  });
  const requestsQuery = useQuery({
    queryKey: ["refill-requests"],
    queryFn: async () => (await api.get<ApiList<RefillRequest>>("/refill-requests/")).data,
    enabled: isHousehold,
  });
  const cylinders = rows(cylindersQuery.data);
  const providers = rows(providersQuery.data);
  const requests = rows(requestsQuery.data);
  const createRequest = useMutation({
    mutationFn: async () => {
      const cylinder = cylinders.find(item => item.id === Number(form.cylinder));
      if (!cylinder) throw new Error("Select a cylinder.");
      return (await api.post("/refill-requests/", {
        household: cylinder.household,
        cylinder: cylinder.id,
        assigned_technician: Number(form.provider),
        source: "manual",
      })).data;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["refill-requests"] });
      setForm({ cylinder: "", provider: "" });
      setOpen(false);
    },
  });
  const cancelRequest = useMutation({
    mutationFn: async (requestId: number) => (
      await api.post(`/refill-requests/${requestId}/transition/`, { status: "cancelled" })
    ).data,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["refill-requests"] });
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    createRequest.mutate();
  };
  const createError = apiErrorMessage(
    (createRequest.error as { response?: { data?: unknown } } | null)?.response?.data,
    createRequest.error instanceof Error
      ? createRequest.error.message
      : "The refill request could not be sent.",
  );

  if (!isHousehold) {
    return <State text="This refill request screen is available to household accounts." />;
  }

  return <div className="mx-auto max-w-[1180px]">
    <PageHeading
      title="Refill Requests"
      subtitle="Choose a refill provider and track your cylinder refill."
      action={<button className="btn-primary" onClick={() => { createRequest.reset(); setOpen(true); }}><Plus size={15} /> Request Refill</button>}
    />
    {requestsQuery.isLoading ? <State text="Loading refill requests…" /> : requestsQuery.isError ? <State text="Refill requests could not be loaded." /> : !requests.length ? <State text="You have not sent any refill requests yet." /> : <div className="grid gap-4 lg:grid-cols-2">{requests.map(request => {
      const cylinder = cylinders.find(item => item.id === request.cylinder);
      const provider = providers.find(item => item.id === request.assigned_technician);
      const canCancel = request.status === "pending" || request.status === "accepted";
      return <article key={request.id} className="card p-5">
        <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-extrabold text-[#073b82]"><Truck size={16} />{cylinder?.serial_number || `Cylinder #${request.cylinder}`}</div><p className="mt-1 text-xs text-slate-500">Refill Provider: {provider?.name || "Provider unavailable"}</p></div><StatusBadge status={request.status} /></div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-xs"><Datum label="Requested" value={new Date(request.requested_at).toLocaleString()} /><Datum label="Request source" value={request.source} /></dl>
        {canCancel && <button type="button" className="btn-secondary mt-4 w-full" disabled={cancelRequest.isPending} onClick={() => cancelRequest.mutate(request.id)}>{cancelRequest.isPending ? "Cancelling…" : "Cancel Request"}</button>}
        {cancelRequest.isError && <p className="mt-3 text-xs text-red-700">The request could not be cancelled. Refresh and check its current status.</p>}
      </article>;
    })}</div>}
    <Modal open={open} title="Request a Refill" onClose={() => setOpen(false)}>
      <form onSubmit={submit} className="grid gap-4">
        <div><label className="label">Cylinder</label><select required className="field" value={form.cylinder} onChange={event => setForm({ ...form, cylinder: event.target.value })}><option value="">Select your cylinder</option>{cylinders.map(cylinder => <option key={cylinder.id} value={cylinder.id}>{cylinder.serial_number} · {cylinder.gas_percentage}% gas</option>)}</select></div>
        <div><label className="label">Refill Provider</label><select required className="field" value={form.provider} onChange={event => setForm({ ...form, provider: event.target.value })}><option value="">Select a refill provider</option>{providers.map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select>{!providersQuery.isLoading && !providers.length && <p className="mt-2 text-xs text-orange-700">No refill providers are currently available.</p>}</div>
        {createRequest.isError && <p className="text-xs text-red-700">{createError}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={createRequest.isPending || !providers.length}>{createRequest.isPending ? "Sending…" : "Send Request"}</button></div>
      </form>
    </Modal>
  </div>;
}

function StatusBadge({ status }: { status: RefillStatus }) {
  const tone = status === "completed" ? "badge-green" : status === "cancelled" ? "badge-red" : status === "pending" ? "badge-orange" : "badge-blue";
  return <span className={`badge ${tone}`}>{status.replaceAll("_", " ")}</span>;
}

function Datum({ label, value }: { label: string; value: string }) {
  return <div className="rounded bg-slate-50 p-3"><dt className="text-[9px] font-bold uppercase text-slate-500">{label}</dt><dd className="mt-1 font-bold capitalize">{value}</dd></div>;
}

function State({ text }: { text: string }) {
  return <div className="card grid min-h-64 place-items-center p-8 text-center text-sm text-slate-500"><span><PackageCheck className="mx-auto mb-3" size={28} />{text}</span></div>;
}
