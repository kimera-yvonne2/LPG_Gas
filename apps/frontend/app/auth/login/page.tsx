"use client";

import axios from "axios";
import { AlertCircle, LockKeyhole, Mail, ShieldCheck, Wrench, Home } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth, type Role } from "@/lib/auth";
import { AuthFrame } from "@/components/auth-frame";

const roles: { id: Role; label: string; detail: string; icon: typeof Home }[] = [
  { id: "household", label: "Household", detail: "Monitor your cylinder and request refills", icon: Home },
  { id: "technician", label: "Technician", detail: "Inspect devices and respond to safety alerts", icon: Wrench },
  { id: "admin", label: "Admin", detail: "Manage users, devices and platform operations", icon: ShieldCheck },
];

export default function LoginPage() {
  const { login, logout } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<Role>("household");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const user = await login(email, password);
      if (user.role !== role) {
        await logout();
        throw new Error(`This account is registered as ${user.role}, not ${role}.`);
      }
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next || "/");
    } catch (reason) {
      if (axios.isAxiosError(reason)) {
        const detail = reason.response?.data;
        setError(detail?.email?.[0] || detail?.detail || "We could not sign you in. Check your email and password.");
      } else setError(reason instanceof Error ? reason.message : "Sign in failed.");
    } finally { setBusy(false); }
  };
  return <AuthFrame title="Welcome back" subtitle="Sign in to your LPG Guardian workspace."><div className="mb-5 grid gap-2 sm:grid-cols-3">{roles.map(({ id, label, detail, icon: Icon }) => <button type="button" key={id} onClick={() => setRole(id)} className={`rounded-lg border p-3 text-left ${role === id ? "border-[#0b58b5] bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white"}`}><Icon size={17} className="mb-2 text-[#073b82]" /><div className="text-xs font-extrabold">{label}</div><div className="mt-1 text-[9px] leading-3 text-slate-500">{detail}</div></button>)}</div><form onSubmit={submit} className="space-y-4">{error && <div className="flex gap-2 rounded-md bg-red-50 p-3 text-xs font-semibold text-red-700"><AlertCircle size={16} />{error}</div>}<div><label className="label">Email address</label><div className="relative"><Mail className="absolute left-3 top-3 text-slate-400" size={16} /><input required type="email" className="field pl-10" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div></div><div><label className="label">Password</label><div className="relative"><LockKeyhole className="absolute left-3 top-3 text-slate-400" size={16} /><input required type="password" className="field pl-10" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" /></div></div><button disabled={busy} className="btn-primary w-full">{busy ? "Signing in…" : `Sign in as ${roles.find(x => x.id === role)?.label}`}</button></form><p className="mt-5 text-center text-xs text-slate-600">New household? <Link className="font-extrabold text-[#073b82]" href="/auth/signup">Create your monitoring account</Link></p>{role !== "household" && <p className="mt-2 text-center text-[10px] text-slate-500">Admin and technician access is issued by an LPG Guardian administrator.</p>}</AuthFrame>;
}
