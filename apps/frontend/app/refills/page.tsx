"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Mail, PackageCheck, Phone, Search, Send, Truck } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Modal, PageHeading } from "@/components/ui-kit";
import { api } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { useAuth } from "@/lib/auth";
import {
  ApiList,
  RefillProvider,
  RefillRequest,
  RefillStatus,
  rows,
} from "@/lib/domain";

export default function RefillsPage() {
  const { user } = useAuth();
  if (user?.role === "technician") return <TechnicianRequestQueue />;
  return <HouseholdRefillsPage />;
}

function HouseholdRefillsPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<RefillProvider | null>(null);
  const isHousehold = user?.role === "household";

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

  const providers = useMemo(() => rows(providersQuery.data), [providersQuery.data]);
  const requests = rows(requestsQuery.data);
  const visibleProviders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return providers;
    return providers.filter(provider =>
      [provider.name, provider.email, provider.phone_number]
        .some(value => value.toLowerCase().includes(term)),
    );
  }, [providers, search]);

  const createRequest = useMutation({
    mutationFn: async (providerId: number) => (
      await api.post("/refill-requests/", { assigned_technician: providerId })
    ).data,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["refill-requests"] });
      setSelectedProvider(null);
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

  const submitRequest = (event: FormEvent) => {
    event.preventDefault();
    if (selectedProvider) createRequest.mutate(selectedProvider.id);
  };
  const createError = apiErrorMessage(
    (createRequest.error as { response?: { data?: unknown } } | null)?.response?.data,
    "The refill request could not be sent.",
  );

  if (!isHousehold) {
    return <State icon="requests" text="This refill-provider screen is available to household accounts." />;
  }

  return <div className="mx-auto max-w-[1180px]">
    <PageHeading
      title="Refill Providers"
      subtitle="Choose the provider branch you want to receive and process your refill request."
    />

    <section className="card p-5">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
        <label className="sr-only" htmlFor="provider-search">Search refill providers</label>
        <input
          id="provider-search"
          className="field pl-10"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search by provider, branch, email, or phone"
          type="search"
        />
      </div>
    </section>

    <section className="mt-5">
      {providersQuery.isLoading
        ? <State icon="providers" text="Loading refill providers…" />
        : providersQuery.isError
          ? <State icon="providers" text="Refill providers could not be loaded." />
          : !providers.length
            ? <State icon="providers" text="No refill providers have been registered yet." />
            : !visibleProviders.length
              ? <State icon="providers" text={`No refill providers match “${search.trim()}”.`} />
              : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleProviders.map(provider => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    onRequest={() => {
                      createRequest.reset();
                      setSelectedProvider(provider);
                    }}
                  />
                ))}
              </div>}
    </section>

    <section className="mt-10">
      <div className="mb-4">
        <h2 className="section-title">My Refill Requests</h2>
        <p className="mt-1 text-xs text-slate-500">Track requests you have sent to refill providers.</p>
      </div>
      {requestsQuery.isLoading
        ? <State icon="requests" text="Loading refill requests…" />
        : requestsQuery.isError
          ? <State icon="requests" text="Refill requests could not be loaded." />
          : !requests.length
            ? <State icon="requests" text="You have not sent any refill requests yet." />
            : <div className="grid gap-4 lg:grid-cols-2">
              {requests.map(request => {
                const provider = request.provider
                  ?? providers.find(item => item.id === request.assigned_technician);
                const canCancel = request.status === "pending" || request.status === "accepted";
                const cancelling = cancelRequest.isPending && cancelRequest.variables === request.id;
                const cancellationFailed = cancelRequest.isError && cancelRequest.variables === request.id;
                return <article key={request.id} className="card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-extrabold text-[#073b82]">
                        <Truck size={16} />
                        {provider?.name || "Provider unavailable"}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Requested {new Date(request.requested_at).toLocaleString()}
                      </p>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
                    <Datum label="Request source" value={request.source} />
                    <Datum label="Last updated" value={new Date(request.updated_at).toLocaleString()} />
                  </dl>
                  {canCancel && <button
                    type="button"
                    className="btn-secondary mt-4 w-full"
                    disabled={cancelling}
                    onClick={() => cancelRequest.mutate(request.id)}
                  >
                    {cancelling ? "Cancelling…" : "Cancel Request"}
                  </button>}
                  {cancellationFailed && <p className="mt-3 text-xs text-red-700">
                    The request could not be cancelled. Refresh and check its current status.
                  </p>}
                </article>;
              })}
            </div>}
    </section>

    <Modal
      open={Boolean(selectedProvider)}
      title="Confirm Refill Request"
      onClose={() => setSelectedProvider(null)}
    >
      <form onSubmit={submitRequest} className="grid gap-5">
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs text-slate-600">Send your refill request to</p>
          <p className="mt-1 text-base font-extrabold text-[#073b82]">{selectedProvider?.name}</p>
          <p className="mt-2 text-xs text-slate-600">The provider will receive your contact details with this request.</p>
        </div>
        {createRequest.isError && <p className="text-xs text-red-700">{createError}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setSelectedProvider(null)}>Cancel</button>
          <button className="btn-primary" disabled={createRequest.isPending}>
            <Send size={14} /> {createRequest.isPending ? "Sending…" : "Send Request"}
          </button>
        </div>
      </form>
    </Modal>
  </div>;
}

function TechnicianRequestQueue() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | RefillStatus>("all");
  const requestsQuery = useQuery({
    queryKey: ["refill-requests", "technician-queue"],
    queryFn: async () => (
      await api.get<ApiList<RefillRequest>>("/refill-requests/?ordering=-requested_at&page_size=100")
    ).data,
  });
  const transition = useMutation({
    mutationFn: async ({ requestId, nextStatus }: { requestId: number; nextStatus: RefillStatus }) => (
      await api.post(`/refill-requests/${requestId}/transition/`, { status: nextStatus })
    ).data,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["refill-requests"] });
    },
  });

  const requests = useMemo(() => rows(requestsQuery.data), [requestsQuery.data]);
  const visibleRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter(request => {
      if (status !== "all" && request.status !== status) return false;
      if (!term) return true;
      return [request.customer?.name, request.customer?.email, request.customer?.phone]
        .filter((value): value is string => Boolean(value))
        .some(value => value.toLowerCase().includes(term));
    });
  }, [requests, search, status]);
  const statusOptions: Array<{ value: "all" | RefillStatus; label: string }> = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "accepted", label: "Accepted" },
    { value: "in_transit", label: "In Transit" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return <div className="mx-auto max-w-[1180px]">
    <PageHeading
      title="Refill Requests"
      subtitle="Review and process refill requests assigned to your provider account."
    />

    <section className="card p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <label className="sr-only" htmlFor="request-search">Search assigned requests</label>
          <input
            id="request-search"
            className="field pl-10"
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search by customer name, email, or phone"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map(option => <button
            key={option.value}
            type="button"
            className={status === option.value ? "btn-primary" : "btn-secondary"}
            onClick={() => setStatus(option.value)}
          >
            {option.label}
          </button>)}
        </div>
      </div>
    </section>

    <section className="mt-5">
      {requestsQuery.isLoading
        ? <State icon="requests" text="Loading assigned refill requests…" />
        : requestsQuery.isError
          ? <State icon="requests" text="Assigned refill requests could not be loaded." />
          : !visibleRequests.length
            ? <State icon="requests" text="No refill requests match the selected filters." />
            : <div className="space-y-4">
              {visibleRequests.map(request => {
                const action = nextTechnicianAction(request.status);
                const updating = transition.isPending && transition.variables?.requestId === request.id;
                const failed = transition.isError && transition.variables?.requestId === request.id;
                const canCancel = ["pending", "accepted", "in_transit"].includes(request.status);
                return <article key={request.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-extrabold text-[#073b82]">
                          {request.customer?.name || "Household customer"}
                        </h2>
                        <StatusBadge status={request.status} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Requested {new Date(request.requested_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Request #{request.id}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 p-4">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Customer email</div>
                      <a className="mt-1 block break-all text-xs font-bold text-[#073b82]" href={`mailto:${request.customer?.email || ""}`}>
                        {request.customer?.email || "Not provided"}
                      </a>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-4">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Customer phone</div>
                      <a className="mt-1 block text-xs font-bold text-[#073b82]" href={`tel:${request.customer?.phone || ""}`}>
                        {request.customer?.phone || "Not provided"}
                      </a>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                    {canCancel && <button
                      type="button"
                      className="btn-secondary text-red-700"
                      disabled={updating}
                      onClick={() => transition.mutate({ requestId: request.id, nextStatus: "cancelled" })}
                    >
                      Cancel Request
                    </button>}
                    {action && <button
                      type="button"
                      className="btn-primary"
                      disabled={updating}
                      onClick={() => transition.mutate({ requestId: request.id, nextStatus: action.status })}
                    >
                      {updating ? "Updating…" : action.label}
                    </button>}
                  </div>
                  {failed && <p className="mt-3 text-xs text-red-700">
                    The request status could not be updated. Refresh and check its current state.
                  </p>}
                </article>;
              })}
            </div>}
    </section>
  </div>;
}

function nextTechnicianAction(status: RefillStatus): { status: RefillStatus; label: string } | null {
  if (status === "pending") return { status: "accepted", label: "Accept Request" };
  if (status === "accepted") return { status: "in_transit", label: "Mark In Transit" };
  if (status === "in_transit") return { status: "completed", label: "Mark Completed" };
  return null;
}

function ProviderCard({ provider, onRequest }: { provider: RefillProvider; onRequest: () => void }) {
  const initials = provider.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("");

  return <article className="card flex min-h-64 flex-col p-5">
    <div className="flex items-start gap-3">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#e6eef8] text-sm font-extrabold text-[#073b82]">
        {initials || <Building2 size={20} />}
      </span>
      <div className="min-w-0">
        <h2 className="truncate text-sm font-extrabold text-[#073b82]">{provider.name}</h2>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Refill Provider</p>
      </div>
    </div>
    <div className="mt-6 space-y-3 text-xs text-slate-600">
      <a className="flex items-center gap-2 break-all hover:text-[#073b82]" href={`mailto:${provider.email}`}>
        <Mail className="shrink-0" size={15} /> {provider.email}
      </a>
      <a className="flex items-center gap-2 hover:text-[#073b82]" href={`tel:${provider.phone_number}`}>
        <Phone className="shrink-0" size={15} /> {provider.phone_number || "No office phone provided"}
      </a>
    </div>
    <button type="button" className="btn-primary mt-auto w-full" onClick={onRequest}>
      <Send size={14} /> Request Refill
    </button>
  </article>;
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

function Datum({ label, value }: { label: string; value: string }) {
  return <div className="rounded bg-slate-50 p-3">
    <dt className="text-[9px] font-bold uppercase text-slate-500">{label}</dt>
    <dd className="mt-1 font-bold capitalize">{value}</dd>
  </div>;
}

function State({ text, icon }: { text: string; icon: "providers" | "requests" }) {
  const Icon = icon === "providers" ? Building2 : PackageCheck;
  return <div className="card grid min-h-52 place-items-center p-8 text-center text-sm text-slate-500">
    <span><Icon className="mx-auto mb-3" size={28} />{text}</span>
  </div>;
}
