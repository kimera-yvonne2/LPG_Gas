"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeading } from "@/components/ui-kit";
import { WebPushSettings } from "@/components/web-push-settings";
import { useAuth } from "@/lib/auth";

export default function SettingsPage() {
  const { user, updateProfile, deleteAccount } = useAuth();
  const [form, setForm] = useState({ username: "", phone_number: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");

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
      "Delete your LPG Guardian account? You will lose access immediately. This cannot be undone.",
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
    <PageHeading title="Account Settings" subtitle="Your profile data from the LPG Guardian backend." />
    <section className="card p-6">
      <div className="mb-6"><h2 className="section-title">Profile</h2><p className="mt-1 text-xs text-slate-500">{user?.email}</p></div>
      <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2"><div><label className="label">Name</label><input required className="field" value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} /></div><div><label className="label">Phone number</label><input className="field" value={form.phone_number} onChange={event => setForm({ ...form, phone_number: event.target.value })} /></div><div><label className="label">Role</label><input disabled className="field capitalize disabled:bg-slate-100" value={user?.role || ""} /></div><div><label className="label">Account status</label><input disabled className="field disabled:bg-slate-100" value={user?.is_active ? "Active" : "Inactive"} /></div><div className="sm:col-span-2 flex items-center justify-between border-t border-slate-200 pt-5"><span className={`text-xs ${message.includes("updated") ? "text-green-700" : "text-red-700"}`}>{message}</span><button disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save Profile"}</button></div></form>
    </section>
    {user?.role === "household" && <section className="card mt-5 border border-red-200 p-6"><h2 className="text-sm font-extrabold text-red-800">Delete account</h2><p className="mt-2 text-xs leading-5 text-slate-600">This permanently disables your login and removes your personal account identifiers. Cylinder and refill records are retained for system integrity. You may register again using the same email address.</p><button type="button" disabled={deleting} onClick={() => void removeAccount()} className="mt-4 rounded-md bg-red-700 px-4 py-2 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-60">{deleting ? "Deleting…" : "Delete My Account"}</button></section>}
    <WebPushSettings />
  </div>;
}
