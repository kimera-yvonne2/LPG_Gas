"use client";
import axios from "axios";
import { AlertCircle, ShieldCheck, Wrench, Home } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth, type Role } from "@/lib/auth";
import { AuthFrame } from "@/components/auth-frame";
import { apiErrorMessage } from "@/lib/api-error";
import { postLoginPath } from "@/lib/auth-routing";

const roles: { id: Role; label: string; detail: string; icon: typeof Home }[] = [
  { id: "household", label: "Household", detail: "Monitor your cylinder and request refills", icon: Home },
  { id: "technician", label: "Technician", detail: "Review and process assigned refill requests", icon: Wrench },
  { id: "admin", label: "Admin", detail: "Manage users, devices and platform operations", icon: ShieldCheck },
];
export default function LoginPage() {
  const { login, logout } = useAuth(); const router = useRouter();
  const [role, setRole] = useState<Role>("household"); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [unverified, setUnverified] = useState(false); const [resendStatus, setResendStatus] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); setUnverified(false); setResendStatus(""); setBusy(true); try { const user = await login(email, password); if (user.role !== role) { await logout(); throw new Error(`This account is registered as ${user.role}, not ${role}.`); } router.replace(postLoginPath(new URLSearchParams(window.location.search).get("next"), user.role)); } catch (reason) { if (axios.isAxiosError(reason)) { const message = apiErrorMessage(reason.response?.data, "We could not sign you in. Check your email and password."); setError(message); setUnverified(message.toLowerCase().includes("not verified")); } else setError(reason instanceof Error ? reason.message : "Sign in failed."); } finally { setBusy(false); } };
  const resend = async () => { setResendStatus("Sending…"); try { await axios.post(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/auth/email/resend/`, { email }); setResendStatus("Verification requested. For local development, open the link printed in the backend server log."); } catch { setResendStatus("The verification request failed. Make sure the backend is running."); } };
  return <AuthFrame title="Welcome back" subtitle="Sign in to your LPG Guardian workspace."><div className="mb-5 grid gap-2 sm:grid-cols-3">{roles.map(({ id, label, detail, icon: Icon }) => <button type="button" key={id} onClick={() => setRole(id)} className={`rounded-lg border p-3 text-left ${role === id ? "border-[#0b58b5] bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white"}`}><Icon size={17} className="mb-2 text-[#073b82]" /><div className="text-xs font-extrabold">{label}</div><div className="mt-1 text-[9px] leading-3 text-slate-500">{detail}</div></button>)}</div><form onSubmit={submit} className="space-y-4">{error && <div className="rounded-md bg-red-50 p-3 text-xs font-semibold text-red-700"><div className="flex gap-2"><AlertCircle size={16} />{error}</div>{unverified && <button type="button" onClick={() => void resend()} className="mt-2 rounded border border-red-300 bg-white px-3 py-1.5 text-[11px] font-extrabold">Resend verification</button>}{resendStatus && <p className="mt-2 font-normal leading-4">{resendStatus}</p>}</div>}<div><label className="label">Email address</label><input required type="email" autoComplete="email" className="field" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email address" /></div><div><label className="label">Password</label><input required type="password" autoComplete="current-password" className="field" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" /></div><button disabled={busy} className="btn-primary w-full">{busy ? "Signing in…" : `Sign in as ${roles.find(x => x.id === role)?.label}`}</button></form><p className="mt-5 text-center text-xs text-slate-600">New household? <Link className="font-extrabold text-[#073b82]" href="/auth/signup">Create your monitoring account</Link></p>{role !== "household" && <p className="mt-2 text-center text-[10px] text-slate-500">This role is created by an administrator from User Management.</p>}</AuthFrame>;
}
