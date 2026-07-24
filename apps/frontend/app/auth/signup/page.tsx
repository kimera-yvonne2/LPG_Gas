"use client";

import axios from "axios";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth";
import { SignupFrame } from "@/components/auth-frame";
import { apiErrorMessage } from "@/lib/api-error";

export default function SignupPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    username: "",
    email: "",
    phone_number: "",
    password: "",
    password_confirm: "",
  });
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);

  const change = (name: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [name]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (form.password !== form.password_confirm) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await register(form);
      setComplete(true);
    } catch (reason) {
      if (axios.isAxiosError(reason)) {
        if (!reason.response) {
          setError("The Lumora server is unavailable. Please try again once the backend is running.");
          return;
        }
        setError(apiErrorMessage(reason.response.data, "We could not create your account."));
      } else {
        setError("We could not create your account.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (complete) {
    return (
      <SignupFrame title="You’re ready to go" subtitle="Your household monitoring account has been created.">
        <div className="py-5 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-300/20">
            <CheckCircle2 size={30} />
          </span>
          <p className="mx-auto mt-5 max-w-sm text-sm leading-6 text-slate-400">
            Your account for <strong className="text-white">{form.email}</strong> is active. You can sign in immediately.
          </p>
          <Link href="/auth/login" className="btn-primary mt-7 min-w-44">Sign in now</Link>
        </div>
      </SignupFrame>
    );
  }

  return (
    <SignupFrame title="Create your Lumora account" subtitle="Set up your home and start seeing your cylinder clearly.">
      

      <form onSubmit={submit} className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        {error && (
          <div role="alert" className="flex gap-2 rounded-xl border border-red-400/15 bg-red-400/[.07] p-3 text-xs font-semibold text-red-300 sm:col-span-2">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </div>
        )}

        <Field
          name="full-name"
          label="Full name"
          value={form.username}
          onChange={(value) => change("username", value)}
          placeholder="e.g. Amina Nakato"
          icon={UserRound}
          autoComplete="name"
        />
        <Field
          name="phone-number"
          label="Phone number"
          value={form.phone_number}
          onChange={(value) => change("phone_number", value)}
          placeholder="+256 700 000 000"
          icon={Phone}
          autoComplete="tel"
          required={false}
        />
        <div className="sm:col-span-2">
          <Field
            name="email"
            type="email"
            label="Email address"
            value={form.email}
            onChange={(value) => change("email", value)}
            placeholder="you@example.com"
            icon={Mail}
            autoComplete="email"
          />
        </div>
        <Field
          name="password"
          type="password"
          label="Password"
          value={form.password}
          onChange={(value) => change("password", value)}
          placeholder="At least 8 characters"
          icon={LockKeyhole}
          autoComplete="new-password"
        />
        <Field
          name="password-confirm"
          type="password"
          label="Confirm password"
          value={form.password_confirm}
          onChange={(value) => change("password_confirm", value)}
          placeholder="Repeat your password"
          icon={LockKeyhole}
          autoComplete="new-password"
        />

        <button disabled={busy} className="group mt-1 flex min-h-[52px] items-center justify-center rounded-2xl bg-gradient-to-b from-orange-400 to-orange-600 px-6 text-sm font-extrabold text-white shadow-[0_18px_38px_-20px_rgba(249,115,22,.95)] transition hover:-translate-y-0.5 hover:from-orange-300 hover:to-orange-500 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2">
          {busy ? "Creating your account..." : "Create household account"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-500">
        Already have an account?{" "}
        <Link className="font-extrabold text-orange-400 transition hover:text-orange-300" href="/auth/login">Sign in</Link>
      </p>
      <p className="mt-4 text-center text-[9px] leading-4 text-slate-700">
        By creating an account, you agree to use Lumora responsibly and keep your login details secure.
      </p>
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
