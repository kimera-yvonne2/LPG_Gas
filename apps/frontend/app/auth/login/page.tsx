"use client";

import axios from "axios";
import { AlertCircle, Eye, EyeOff, Home, LockKeyhole, Mail, ShieldCheck, Wrench, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { SignupFrame } from "@/components/auth-frame";
import { apiErrorMessage } from "@/lib/api-error";
import { postLoginPath } from "@/lib/auth-routing";
import { type Role, useAuth } from "@/lib/auth";

const roles: { id: Role; label: string; detail: string; icon: typeof Home }[] = [
  { id: "household", label: "Household", detail: "Monitor your cylinder and request refills", icon: Home },
  { id: "technician", label: "Technician", detail: "Review and process assigned refill requests", icon: Wrench },
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
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(email, password);
      if (user.role !== role) {
        await logout();
        throw new Error(`This account is registered as ${user.role}, not ${role}.`);
      }
      router.replace(
        postLoginPath(new URLSearchParams(window.location.search).get("next"), user.role),
      );
    } catch (reason) {
      if (axios.isAxiosError(reason)) {
        setError(
          apiErrorMessage(
            reason.response?.data,
            "We could not sign you in. Check your email and password.",
          ),
        );
      } else {
        setError(reason instanceof Error ? reason.message : "Sign in failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SignupFrame title="Welcome back" subtitle="Sign in to your Lumora workspace.">
      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        {roles.map(({ id, label, detail, icon: Icon }) => (
          <button
            type="button"
            key={id}
            onClick={() => setRole(id)}
            className={`group relative rounded-2xl border p-4 text-left transition ${role === id ? "border-orange-400 bg-orange-400/10 shadow-[0_0_20px_-5px_rgba(249,115,22,.3)] ring-1 ring-orange-400/50" : "border-white/[.09] bg-white/[.035] hover:bg-white/[.06] hover:border-white/[.15]"}`}
          >
            <Icon size={20} className={`mb-3 transition ${role === id ? "text-orange-400" : "text-slate-500 group-hover:text-slate-300"}`} />
            <div className={`text-xs font-black tracking-wide transition ${role === id ? "text-white" : "text-slate-300"}`}>{label}</div>
            <div className="mt-1.5 text-[9px] leading-4 text-slate-500">{detail}</div>
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="grid gap-y-5">
        {error && (
          <div role="alert" className="flex gap-2 rounded-xl border border-red-400/15 bg-red-400/[.07] p-3 text-xs font-semibold text-red-300">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </div>
        )}
        <Field
          name="email"
          type="email"
          label="Email address"
          value={email}
          onChange={setEmail}
          placeholder="Enter your email address"
          icon={Mail}
          autoComplete="email"
        />
        <Field
          name="password"
          type="password"
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="Enter your password"
          icon={LockKeyhole}
          autoComplete="current-password"
        />
        <button disabled={busy} className="group mt-2 flex min-h-[52px] items-center justify-center rounded-2xl bg-gradient-to-b from-orange-400 to-orange-600 px-6 text-sm font-extrabold text-white shadow-[0_18px_38px_-20px_rgba(249,115,22,.95)] transition hover:-translate-y-0.5 hover:from-orange-300 hover:to-orange-500 disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? "Signing in..." : `Sign in as ${roles.find((item) => item.id === role)?.label}`}
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-slate-500">
        New household?{" "}
        <Link className="font-extrabold text-orange-400 transition hover:text-orange-300" href="/auth/signup">Create your monitoring account</Link>
      </p>
      {role !== "household" && (
        <p className="mt-4 text-center text-[10px] leading-4 text-slate-700">
          This role is created by an administrator from User Management.
        </p>
      )}
    </SignupFrame>
  );
}

function Field({
  name,
  label,
  value,
  onChange,
  placeholder,
  icon: Icon,
  type = "text",
  autoComplete,
  required = true,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon: LucideIcon;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <div>
      <label className="mb-2 block text-[10px] font-extrabold uppercase tracking-[.09em] text-slate-400" htmlFor={name}>
        {label}{!required && <span className="ml-1 font-normal normal-case tracking-normal text-slate-600">(optional)</span>}
      </label>
      <div className="group relative">
        <Icon size={16} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 transition group-focus-within:text-orange-400" />
        <input
          id={name}
          required={required}
          type={isPassword && visible ? "text" : type}
          autoComplete={autoComplete}
          className="min-h-[52px] w-full rounded-2xl border border-white/[.09] bg-white/[.035] py-3 pl-11 pr-11 text-sm text-white outline-none transition placeholder:text-slate-700 hover:border-white/[.14] focus:border-orange-400/60 focus:bg-orange-400/[.025] focus:ring-4 focus:ring-orange-400/[.07]"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-600 transition hover:bg-white/[.05] hover:text-slate-300"
            aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}
