"use client";

import axios from "axios";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AuthFrame } from "@/components/auth-frame";
import { apiErrorMessage } from "@/lib/api-error";

export default function SignupPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ username: "", email: "", phone_number: "", password: "", password_confirm: "" });
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const change = (name: keyof typeof form, value: string) => setForm(current => ({ ...current, [name]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (form.password !== form.password_confirm) return setError("The passwords do not match.");
    setBusy(true);
    try { await register(form); setComplete(true); }
    catch (reason) {
      if (axios.isAxiosError(reason)) {
        if (!reason.response) {
          setError("The Lumora server is unavailable. Please try again once the backend is running.");
          return;
        }
        setError(apiErrorMessage(reason.response.data, "We could not create your account."));
      } else setError("We could not create your account.");
    } finally { setBusy(false); }
  };
  if (complete) return <AuthFrame title="Account created" subtitle="Your household monitoring account is ready."><div className="text-center"><CheckCircle2 className="mx-auto text-green-700" size={44} /><p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-slate-600">Your account for <strong>{form.email}</strong> is active. You can sign in immediately.</p><Link href="/auth/login" className="btn-primary mt-6">Sign in now</Link></div></AuthFrame>;
  return <AuthFrame title="Create a household account" subtitle="Connect your home to Lumora monitoring."><div className="mb-5 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900"><strong>Household registration</strong><br />Technician and administrator accounts are securely issued by a platform administrator.</div><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">{error && <div className="sm:col-span-2 flex gap-2 rounded-md bg-red-50 p-3 text-xs font-semibold text-red-700"><AlertCircle size={16} />{error}</div>}<Field label="Full name" value={form.username} onChange={value => change("username", value)} placeholder="e.g. Amina Nakato" /><Field label="Phone number" value={form.phone_number} onChange={value => change("phone_number", value)} placeholder="+256 700 000 000" /><div className="sm:col-span-2"><Field type="email" label="Email address" value={form.email} onChange={value => change("email", value)} placeholder="amina@example.com" /></div><Field type="password" label="Password" value={form.password} onChange={value => change("password", value)} placeholder="At least 8 characters" /><Field type="password" label="Confirm password" value={form.password_confirm} onChange={value => change("password_confirm", value)} placeholder="Repeat password" /><button disabled={busy} className="btn-primary sm:col-span-2">{busy ? "Creating account…" : "Create household account"}</button></form><p className="mt-5 text-center text-xs text-slate-600">Already registered? <Link className="font-extrabold text-[#073b82]" href="/auth/login">Sign in</Link></p></AuthFrame>;
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  return <div><label className="label">{label}</label><input required={label !== "Phone number"} type={type} className="field" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></div>;
}
