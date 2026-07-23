"use client";

import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Clock3,
  Gauge,
  Menu,
  Radio,
  ShieldCheck,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const features = [
  {
    icon: ShieldCheck,
    title: "Leak detection that never sleeps",
    copy: "Guardian spots unusual pressure and flow changes, then sends an alert before a small leak becomes an emergency.",
    accent: "emerald",
  },
  {
    icon: BarChart3,
    title: "Usage you can understand",
    copy: "See daily consumption, compare trends, and find the habits that are quietly draining your cylinder.",
    accent: "orange",
  },
  {
    icon: Clock3,
    title: "Know your refill date",
    copy: "A forecast based on your real usage tells you when you will run out—not a generic calendar reminder.",
    accent: "violet",
  },
  {
    icon: Truck,
    title: "Refills without the scramble",
    copy: "Request a trusted local provider in a few taps and follow every refill from confirmation to delivery.",
    accent: "sky",
  },
] as const;

const steps = [
  ["01", "Attach", "Secure the compact Guardian sensor to your LPG cylinder. No plumbing changes or specialist tools."],
  ["02", "Connect", "Pair it with your account and watch live level, pressure, and usage data appear instantly."],
  ["03", "Relax", "Get smart alerts, accurate forecasts, and refill help exactly when you need it."],
] as const;

const accentStyles = {
  emerald: "bg-emerald-400/10 text-emerald-300 ring-emerald-300/20",
  orange: "bg-orange-400/10 text-orange-300 ring-orange-300/20",
  violet: "bg-violet-400/10 text-violet-300 ring-violet-300/20",
  sky: "bg-sky-400/10 text-sky-300 ring-sky-300/20",
};

function Brand() {
  return (
    <Link href="/" className="group flex items-center gap-3" aria-label="LPG Guardian home">
      <span className="relative grid size-10 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-500/20 transition-transform group-hover:rotate-3">
        <span className="absolute inset-1 rounded-[9px] border border-white/25" />
        <Gauge className="relative size-5 text-white" strokeWidth={2.5} />
      </span>
      <span>
        <span className="block text-[15px] font-black tracking-[-0.02em] text-white">LPG Guardian</span>
        <span className="block text-[9px] font-bold uppercase tracking-[0.22em] text-slate-500">Smart gas monitoring</span>
      </span>
    </Link>
  );
}

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[560px] lg:mr-0">
      <div className="absolute -inset-16 -z-10 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="absolute -right-8 top-14 -z-10 size-64 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#101b31]/90 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-orange-500 text-white"><Gauge size={16} /></span>
            <div><p className="text-xs font-bold text-white">Household dashboard</p><p className="text-[10px] text-slate-500">Live LPG system status</p></div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-400/20">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
          </span>
        </div>

        <div className="p-5">
          <div className="mb-4">
            <p className="text-sm font-extrabold text-white">Welcome back, Amina!</p>
            <p className="mt-1 text-[9px] text-slate-500">Live LPG system status from the monitoring backend.</p>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-white/8 bg-white/[.025] p-3.5">
              <p className="text-[8px] font-extrabold uppercase tracking-wide text-slate-500">Latest gas level</p>
              <div className="mt-5 text-center"><p className="text-2xl font-black text-orange-300">68.0%</p><p className="mt-1 text-[8px] text-slate-500">Latest cylinder reading</p></div>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[.025] p-3.5">
              <p className="text-[8px] font-extrabold uppercase tracking-wide text-slate-500">Cylinders</p>
              <div className="mt-5 flex items-center gap-2 text-orange-300"><Radio size={14} /><p className="text-2xl font-black">1</p></div>
              <p className="mt-4 border-t border-white/8 pt-2 text-[8px] text-slate-500">1 active</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[.025] p-3.5">
              <p className="text-[8px] font-extrabold uppercase tracking-wide text-slate-500">Sensors online</p>
              <div className="mt-5 flex items-center gap-2 text-orange-300"><Radio size={14} /><p className="text-2xl font-black">1</p></div>
              <p className="mt-4 border-t border-white/8 pt-2 text-[8px] text-slate-500">1 registered</p>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-white/8 bg-white/[.025] p-3.5">
            <div className="flex items-center gap-2"><Sparkles size={13} className="text-orange-300" /><p className="text-[10px] font-extrabold text-white">Gas forecast</p></div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <div><p className="text-[7px] font-bold uppercase text-slate-500">Estimated remaining</p><p className="mt-1 text-xs font-black text-orange-300">18.0 days</p></div>
              <div><p className="text-[7px] font-bold uppercase text-slate-500">Expected empty date</p><p className="mt-1 text-[8px] font-bold text-slate-300">Friday, Aug 9</p></div>
              <div><p className="text-[7px] font-bold uppercase text-slate-500">Likely window</p><p className="mt-1 text-[8px] font-bold text-slate-300">Aug 7 – Aug 11</p></div>
              <div><p className="text-[7px] font-bold uppercase text-slate-500">Confidence</p><p className="mt-1 text-[8px] font-bold text-slate-300">High · 96 periods</p></div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-white/8 bg-white/[.025] p-3.5">
            <p className="text-[10px] font-extrabold text-white">Current safety status</p>
            <div className="mt-2.5 flex items-center gap-2.5 rounded-lg bg-emerald-400/[.08] p-2.5 text-emerald-300">
              <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-current"><Check size={12} strokeWidth={3} /></span>
              <div><p className="text-[9px] font-extrabold">No critical readings</p><p className="mt-0.5 text-[8px] text-emerald-200/60">Based on the latest telemetry received.</p></div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LPGGuardianApp() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-hidden bg-[#08111f] font-sans text-slate-100 selection:bg-orange-500 selection:text-white">
      <div className="pointer-events-none fixed inset-0 opacity-[.025] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:48px_48px]" />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[.07] bg-[#08111f]/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8" aria-label="Main navigation">
          <Brand />
          <div className="hidden items-center gap-8 md:flex">
            {["How it works", "Features", "Dashboard"].map((item) => <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`} className="text-xs font-semibold text-slate-400 transition hover:text-white">{item}</a>)}
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <Link href="/auth/login" className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/5 hover:text-white">Log in</Link>
            <Link href="/auth/signup" className="group flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-xs font-extrabold text-white shadow-lg shadow-orange-600/20 transition hover:-translate-y-0.5 hover:bg-orange-400">Get started <ArrowRight size={14} className="transition group-hover:translate-x-0.5" /></Link>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="grid size-10 place-items-center rounded-xl border border-white/10 text-white md:hidden" aria-label="Toggle navigation" aria-expanded={menuOpen}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
        </nav>
        {menuOpen && <div className="border-t border-white/10 bg-[#0b1628] p-5 md:hidden"><div className="flex flex-col gap-2">{["How it works", "Features", "Dashboard"].map((item) => <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`} onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5">{item}</a>)}<Link href="/auth/signup" className="mt-2 rounded-xl bg-orange-500 px-4 py-3 text-center text-sm font-bold text-white">Get started</Link></div></div>}
      </header>

      <main className="relative">
        <section className="relative mx-auto grid min-h-[820px] max-w-7xl items-center gap-16 px-5 pb-28 pt-36 sm:px-8 lg:grid-cols-[1.02fr_.98fr] lg:pt-28">
          <div className="pointer-events-none absolute -left-64 top-10 size-[520px] rounded-full bg-emerald-500/[.07] blur-[100px]" />
          <div className="relative z-10 max-w-2xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/[.07] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-emerald-300"><Radio size={12} className="animate-pulse" /> Always-on safety for every cylinder</div>
            <h1 className="text-[clamp(3rem,6.5vw,5.9rem)] font-black leading-[.96] tracking-[-.065em] text-white">Know your gas level <span className="bg-gradient-to-r from-orange-300 via-orange-400 to-amber-300 bg-clip-text text-transparent">before it surprises you.</span></h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">See exactly how much LPG you have, catch leaks early, and arrange a refill before the flame goes out—all from one simple dashboard.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/auth/signup" className="group flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-7 py-4 text-sm font-extrabold text-white shadow-xl shadow-orange-600/20 transition hover:-translate-y-0.5 hover:bg-orange-400">Start monitoring free <ArrowRight size={17} className="transition group-hover:translate-x-1" /></Link>
              <a href="#how-it-works" className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[.035] px-7 py-4 text-sm font-bold text-white backdrop-blur transition hover:border-white/20 hover:bg-white/[.07]">See how it works <ChevronRight size={16} /></a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-[11px] font-semibold text-slate-500"><span className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> Setup in minutes</span><span className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> No card required</span><span className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> Works with standard cylinders</span></div>
          </div>
          <div className="relative z-10 pt-4 lg:pt-0"><ProductPreview /></div>
        </section>

        <section id="how-it-works" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-28 sm:px-8 sm:py-36">
          <div className="mb-14 max-w-2xl"><p className="mb-4 text-[11px] font-black uppercase tracking-[.2em] text-orange-400">Simple from day one</p><h2 className="text-3xl font-black tracking-[-.045em] text-white sm:text-5xl">From cylinder to confidence in three small steps.</h2></div>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map(([number, title, copy], index) => <article key={title} className="group relative overflow-hidden rounded-3xl border border-white/[.08] bg-white/[.025] p-7 transition duration-300 hover:-translate-y-1 hover:border-orange-400/25 hover:bg-white/[.045] sm:p-9"><span className="absolute -right-3 -top-8 text-[110px] font-black tracking-tighter text-white/[.025]">{number}</span><div className="mb-10 flex items-center justify-between"><span className="text-xs font-black tracking-[.14em] text-orange-400">STEP {number}</span>{index < 2 && <ArrowRight size={16} className="hidden text-slate-700 md:block" />}</div><h3 className="text-xl font-extrabold text-white">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{copy}</p></article>)}
          </div>
        </section>

        <section id="features" className="scroll-mt-24 border-y border-white/[.07] bg-[#0b1627] py-28 sm:py-36">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end"><div className="max-w-2xl"><p className="mb-4 text-[11px] font-black uppercase tracking-[.2em] text-emerald-400">Built around real life</p><h2 className="text-3xl font-black tracking-[-.045em] text-white sm:text-5xl">The right information, right when it matters.</h2></div><p className="max-w-sm text-sm leading-6 text-slate-500">Clear answers for the four things every gas user worries about: safety, supply, spending, and service.</p></div>
            <div className="grid gap-4 md:grid-cols-2">
              {features.map(({ icon: Icon, title, copy, accent }) => <article key={title} className="group rounded-3xl border border-white/[.08] bg-[#0e1b2e] p-7 transition duration-300 hover:border-white/15 hover:bg-[#112139] sm:p-9"><span className={`grid size-12 place-items-center rounded-2xl ring-1 ${accentStyles[accent]}`}><Icon size={21} /></span><h3 className="mt-7 text-xl font-extrabold tracking-tight text-white">{title}</h3><p className="mt-3 max-w-lg text-sm leading-7 text-slate-500">{copy}</p></article>)}
            </div>
          </div>
        </section>

        <section id="dashboard" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-28 sm:px-8 sm:py-36">
          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#172743] to-[#0d192b] px-6 py-14 sm:px-14 sm:py-16 lg:flex lg:items-center lg:justify-between lg:gap-16">
            <div className="absolute -right-20 -top-40 size-96 rounded-full bg-orange-500/15 blur-3xl" /><div className="relative max-w-2xl"><span className="mb-6 grid size-12 place-items-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/20"><Sparkles size={21} /></span><h2 className="text-3xl font-black tracking-[-.045em] text-white sm:text-5xl">A calmer way to manage your gas.</h2><p className="mt-5 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">Join households that have replaced guesswork with live insight, earlier warnings, and refills that arrive on time.</p></div>
            <div className="relative mt-9 shrink-0 lg:mt-0"><Link href="/auth/signup" className="group flex items-center justify-center gap-3 rounded-2xl bg-blue px-7 py-4 text-sm font-black text-[#0b1627] transition hover:-translate-y-0.5 hover:bg-orange-50">Create your free account <ArrowRight size={17} className="transition group-hover:translate-x-1" /></Link><p className="mt-3 text-center text-[10px] text-slate-500">Takes less than two minutes</p></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[.07] bg-[#060d18]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between"><Brand /><div className="flex flex-wrap gap-6 text-[11px] font-semibold text-slate-500"><a href="#features" className="hover:text-white">Features</a><a href="#how-it-works" className="hover:text-white">How it works</a><Link href="/auth/login" className="hover:text-white">Log in</Link><span>© 2026 LPG Guardian</span></div></div>
      </footer>
    </div>
  );
}
