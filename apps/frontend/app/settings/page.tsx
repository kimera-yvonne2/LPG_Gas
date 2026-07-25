"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageHeading } from "@/components/ui-kit";
import { WebPushSettings } from "@/components/web-push-settings";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { ApiList, Household, rows } from "@/lib/domain";

export default function SettingsPage() {
  const { user, updateProfile, deleteAccount } = useAuth();
  const [form, setForm] = useState({ username: "", phone_number: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();
  const householdQuery = useQuery({ queryKey: ["my-household"], enabled: user?.role === "household", queryFn: async () => (await api.get<ApiList<Household>>("/households/")).data });
  const household = rows(householdQuery.data)[0];
  const automaticRefills = useMutation({
    mutationFn: async (enabled: boolean) => (await api.patch(`/households/${household?.id}/`, { automatic_refills_enabled: enabled })).data,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["my-household"] }),
  });

  useEffect(() => {
    if (user) setForm({ username: user.username, phone_number: user.phone_number || "" });
  }, [user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await updateProfile(form);
      setMessage("Profile updated.");
    } catch {
      setMessage("The profile could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  const removeAccount = async () => {
    const confirmed = window.confirm(
      "Delete your Lumora account? You will lose access immediately. This cannot be undone.",
    );
    if (!confirmed) return;
    setDeleting(true);
    setMessage("");
    try {
      await deleteAccount();
      window.location.replace("/auth/signup");
    } catch {
      setMessage("The account could not be deleted.");
      setDeleting(false);
    }
  };

  return <div className="mx-auto max-w-[760px]">
    <PageHeading title="Account Settings" subtitle="Your profile data on the Lumora platform." />
    <section className="card p-6">
      <div className="mb-6"><h2 className="section-title">Profile</h2><p className="mt-1 text-xs text-slate-500">{user?.email}</p></div>
      <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2"><div><label className="label">Name</label><input required className="field" value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} /></div><div><label className="label">Phone number</label><input className="field" value={form.phone_number} onChange={event => setForm({ ...form, phone_number: event.target.value })} /></div><div><label className="label">Role</label><input disabled className="field capitalize disabled:bg-slate-100" value={user?.role || ""} /></div><div><label className="label">Account status</label><input disabled className="field disabled:bg-slate-100" value={user?.is_active ? "Active" : "Inactive"} /></div><div className="sm:col-span-2 flex items-center justify-between border-t border-slate-200 pt-5"><span className={`text-xs ${message.includes("updated") ? "text-green-700" : "text-red-700"}`}>{message}</span><button disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save Profile"}</button></div></form>
    </section>
    {user?.role === "household" && <section className="card mt-5 p-6"><h2 className="section-title">Automatic refill requests</h2><p className="mt-2 text-xs leading-5 text-slate-500">When enabled, Lumora sends one request to your selected provider when a cylinder reaches 2% or below. It will not send another until that cylinder later reaches 90% after a refill.</p><div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div><strong className="text-sm text-[#073b82]">{household?.automatic_refills_enabled ? "Enabled" : "Disabled"}</strong><p className="mt-1 text-xs text-slate-500">{household?.refill_provider_name ? `Provider: ${household.refill_provider_name}` : "Choose a provider before enabling."}</p></div><button type="button" disabled={!household || automaticRefills.isPending || (!household.refill_provider && !household.automatic_refills_enabled)} onClick={() => automaticRefills.mutate(!household.automatic_refills_enabled)} className="btn-primary">{automaticRefills.isPending ? "Saving..." : household?.automatic_refills_enabled ? "Turn off" : "Turn on"}</button></div>{!household?.refill_provider && <Link to="/refills" className="mt-4 inline-block text-xs font-bold text-orange-600 hover:text-orange-700">Choose a refill provider</Link>}</section>}
    {user?.role === "household" && <section className="card mt-5 border border-red-200 p-6"><h2 className="text-sm font-extrabold text-red-800">Delete account</h2><p className="mt-2 text-xs leading-5 text-slate-600">This permanently disables your login and removes your personal account identifiers. Cylinder and refill records are retained for system integrity. You may register again using the same email address.</p><button type="button" disabled={deleting} onClick={() => void removeAccount()} className="mt-4 rounded-md bg-red-700 px-4 py-2 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-60">{deleting ? "Deleting…" : "Delete My Account"}</button></section>}
    <WebPushSettings />
  </div>;
}
