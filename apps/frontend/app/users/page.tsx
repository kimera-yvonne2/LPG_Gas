"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Users, Wrench } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth, type User } from "@/lib/auth";
import { PageHeading } from "@/components/ui-kit";

type UsersResponse = { results?: User[] } | User[];
export default function UsersPage() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ["users"], queryFn: async () => (await api.get<UsersResponse>("/users/")).data, enabled: user?.role === "admin" });
  if (user?.role !== "admin") return <div className="card mx-auto max-w-xl p-8 text-center"><ShieldCheck className="mx-auto text-[#073b82]" /><h1 className="section-title mt-3">Administrator access required</h1><p className="mt-2 text-xs text-slate-500">User provisioning is restricted to LPG Guardian administrators.</p></div>;
  const users = Array.isArray(query.data) ? query.data : query.data?.results || [];
  return <div className="mx-auto max-w-[1180px]"><PageHeading title="User Management" subtitle="Manage LPG Guardian households, technicians and administrators." /><section className="card overflow-hidden"><div className="flex items-center gap-2 border-b border-slate-200 p-4 text-sm font-extrabold"><Users size={17} /> Platform accounts</div>{query.isLoading ? <div className="p-8 text-center text-sm text-slate-500">Loading users…</div> : query.isError ? <div className="p-8 text-center text-sm text-red-700">Could not load users from the backend.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-4">User</th><th className="p-4">Role</th><th className="p-4">Phone</th><th className="p-4">Verification</th><th className="p-4">Status</th></tr></thead><tbody>{users.map(account => <tr key={account.id} className="border-t border-slate-200"><td className="p-4"><strong>{account.username}</strong><div className="mt-1 text-[10px] text-slate-500">{account.email}</div></td><td className="p-4 capitalize"><span className="inline-flex items-center gap-1">{account.role === "technician" && <Wrench size={12} />}{account.role}</span></td><td className="p-4">{account.phone_number || "—"}</td><td className="p-4"><span className={`badge ${account.email_verified ? "badge-green" : "badge-orange"}`}>{account.email_verified ? "Verified" : "Pending"}</span></td><td className="p-4"><span className={`badge ${account.is_active ? "badge-green" : "badge-red"}`}>{account.is_active ? "Active" : "Inactive"}</span></td></tr>)}</tbody></table></div>}</section></div>;
}
