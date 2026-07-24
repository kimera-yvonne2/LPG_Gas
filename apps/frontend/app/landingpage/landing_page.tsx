"use client";

import {
  ArrowRight,
  BarChart3,
  BellRing,
  Check,
  ChevronRight,
  Clock3,
  Gauge,
  Menu,
  Radio,
  ShieldCheck,
  Sparkles,
  Truck,
  Wifi,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GasCylinderLevel } from "@/components/gas-cylinder-level";

const features = [
  {
    icon: ShieldCheck,
    title: "Safety that stays awake",
    copy: "Continuous monitoring catches warning signs early and puts the important alert in front of you.",
    tone: "emerald",
  },
  {
    icon: BarChart3,
    title: "A level you can trust",
    copy: "See the gas left in your cylinder as one clear percentage, backed by a simple usage history.",
    tone: "orange",
  },
  {
    icon: Clock3,
    title: "Refill before the flame goes out",
    copy: "Lumora learns from measured use and estimates how much cooking time remains.",
    tone: "violet",
  },
  {
    icon: Truck,
    title: "Help when it is time",
    copy: "Request a refill from a trusted provider and follow the request without phone-call guesswork.",
    tone: "sky",
  },
] as const;

const steps = [
  { number: "01", title: "Attach", copy: "Place the compact sensor beneath your cylinder.", icon: Gauge },
  { number: "02", title: "Connect", copy: "Pair the device and let Lumora receive live readings.", icon: Wifi },
  { number: "03", title: "Stay ready", copy: "Check your level, get alerts, and refill in good time.", icon: BellRing },
] as const;

const toneStyles = {
  emerald: "bg-emerald-400/10 text-emerald-300 ring-emerald-300/20",
  orange: "bg-orange-400/10 text-orange-300 ring-orange-300/20",
  violet: "bg-violet-400/10 text-violet-300 ring-violet-300/20",
  sky: "bg-sky-400/10 text-sky-300 ring-sky-300/20",
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-3" aria-label="Lumora home">
      <span className="relative grid size-11 place-items-center overflow-hidden rounded-[15px] bg-gradient-to-br from-orange-300 via-orange-500 to-orange-700 shadow-[0_12px_30px_-12px_rgba(249,115,22,.8)] transition-transform group-hover:-rotate-3">
        <span className="absolute inset-[3px] rounded-[12px] border border-white/25" />
        <Gauge className="relative size-5 text-white" strokeWidth={2.6} />
      </span>
      {!compact && (
        <span>
          <span className="block font-[Raleway] text-[17px] font-black tracking-[-0.035em] text-white">Lumora</span>
          <span className="block text-[8px] font-extrabold uppercase tracking-[0.24em] text-slate-500">Gas, made visible</span>
        </span>
      )}
    </Link>
  );
}

function MiniTrend() {
  return (
    <svg viewBox="0 0 250 78" className="h-20 w-full" role="img" aria-label="Gas level gently reducing over time">
      <defs>
        <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fb923c" stopOpacity=".3" />
          <stop offset="1" stopColor="#fb923c" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 18 C35 20 45 31 77 29 S125 40 153 38 S202 55 250 58 V78 H0Z" fill="url(#trend-fill)" />
      <path d="M0 18 C35 20 45 31 77 29 S125 40 153 38 S202 55 250 58" fill="none" stroke="#fb923c" strokeWidth="3" strokeLinecap="round" />
      <circle cx="250" cy="58" r="5" fill="#fb923c" stroke="#17243a" strokeWidth="3" />
    </svg>
  );
}

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[610px] lg:mr-0">
      <div className="lumora-orb -inset-10 bg-orange-500/12" />
     
      <div className="lumora-float absolute -bottom-6 -right-5 z-20 hidden min-w-36 rounded-2xl border border-white/10 bg-[#14233a]/90 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:block [--float-rotate:3deg] [--float-speed:8s]">
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Estimated left</p>
        <p className="mt-1 text-lg font-black text-white">12.4 days</p>
      </div>

      <div className="lumora-panel relative overflow-hidden rounded-[30px] p-2 shadow-[0_35px_100px_-45px_rgba(0,0,0,.95)]">
        <div className="overflow-hidden rounded-[23px] border border-white/[.06] bg-[#0b1628]">
          <div className="flex items-center justify-between border-b border-white/[.07] px-5 py-4">
            <div className="flex items-center gap-3">
              <Brand compact />
              <div><p className="text-[11px] font-extrabold text-white">Home overview</p><p className="mt-0.5 text-[8px] text-slate-500">Friday, 24 July</p></div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/[.08] px-2.5 py-1 text-[9px] font-bold text-emerald-300 ring-1 ring-emerald-400/15">
              <span className="lumora-pulse size-1.5 rounded-full bg-emerald-400" /> Live
            </span>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-[1.15fr_.85fr]">
            <div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-4">
              <p className="text-[9px] font-extrabold uppercase tracking-[.14em] text-slate-500">Gas remaining</p>
              <div className="-my-6 scale-[.68]">
                <GasCylinderLevel value={68} />
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-4">
                <p className="text-[9px] font-bold text-slate-500">Cylinder weight</p>
                <p className="mt-2 text-lg font-black text-white">11.8 kg</p>
                <p className="mt-1 text-[8px] text-emerald-300">Scale reporting normally</p>
              </div>
              <div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-4">
                <div className="flex items-center justify-between"><p className="text-[9px] font-bold text-slate-500">Level history</p><span className="text-[8px] text-orange-300">7 days</span></div>
                <MiniTrend />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LumoraApp() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-hidden bg-[#070f1b] text-slate-100 selection:bg-orange-500 selection:text-white">
      <div className="lumora-grid pointer-events-none fixed inset-0 opacity-60" />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[.06] bg-[#070f1b]/75 backdrop-blur-2xl">
        <nav className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between px-5 sm:px-8" aria-label="Main navigation">
          <Brand />
          <div className="hidden items-center gap-8 md:flex">
            {["How it works", "Features", "Dashboard"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`} className="text-[11px] font-bold text-slate-400 transition hover:text-white">{item}</a>
            ))}
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Link href="/auth/login" className="rounded-xl border border-white/[.08] bg-white/[.025] px-4 py-2.5 text-[11px] font-bold text-slate-200 shadow-inner transition hover:bg-white/[.06]">Log in</Link>
            <Link href="/auth/signup" className="group flex items-center gap-2 rounded-xl bg-gradient-to-b from-orange-400 to-orange-600 px-5 py-3 text-[11px] font-extrabold text-white shadow-[0_14px_34px_-16px_rgba(249,115,22,.9)] transition hover:-translate-y-0.5">Get started <ArrowRight size={14} className="transition group-hover:translate-x-0.5" /></Link>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="grid size-10 place-items-center rounded-xl border border-white/10 text-white md:hidden" aria-label="Toggle navigation" aria-expanded={menuOpen}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
        </nav>
        {menuOpen && (
          <div className="border-t border-white/[.07] bg-[#0b1628]/95 p-5 backdrop-blur-xl md:hidden">
            <div className="flex flex-col gap-2">
              {["How it works", "Features", "Dashboard"].map((item) => <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`} onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5">{item}</a>)}
              <Link href="/auth/signup" className="mt-2 rounded-xl bg-orange-500 px-4 py-3 text-center text-sm font-bold text-white">Get started</Link>
            </div>
          </div>
        )}
      </header>

      <main className="relative">
        <section className="relative mx-auto grid min-h-[790px] max-w-[1240px] items-center gap-16 px-5 pb-24 pt-32 sm:px-8 lg:grid-cols-[.95fr_1.05fr] lg:pt-24">
          <div className="lumora-orb -left-72 top-0 size-[560px] bg-orange-500/[.065]" />
          <div className="relative z-10 max-w-2xl">
            
            <h1 className="lumora-rise text-[clamp(3.2rem,6vw,5.7rem)] font-black leading-[.95] tracking-[-.065em] text-white [--rise-delay:.08s]">
              Know your gas level. <span className="bg-gradient-to-r from-orange-300 via-orange-400 to-amber-200 bg-clip-text text-transparent">Live without the guesswork.</span>
            </h1>
            <p className="lumora-rise mt-7 max-w-xl text-[15px] leading-7 text-slate-400 sm:text-[17px] sm:leading-8 [--rise-delay:.16s]">
              Lumora turns your LPG cylinder into one calm, clear view—how much is left, whether it is safe, and when to refill.
            </p>
            <div className="lumora-rise mt-9 flex flex-col gap-3 sm:flex-row [--rise-delay:.24s]">
              <Link href="/auth/signup" className="group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-orange-400 to-orange-600 px-7 py-4 text-sm font-extrabold text-white shadow-[0_18px_45px_-18px_rgba(249,115,22,.95)] transition hover:-translate-y-0.5">Start monitoring <ArrowRight size={17} className="transition group-hover:translate-x-1" /></Link>
              <a href="#how-it-works" className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[.03] px-7 py-4 text-sm font-bold text-white shadow-inner backdrop-blur transition hover:border-white/20 hover:bg-white/[.06]">See how it works <ChevronRight size={16} /></a>
            </div>
            <div className="lumora-rise mt-8 flex flex-wrap gap-x-6 gap-y-3 text-[10px] font-bold text-slate-500 [--rise-delay:.32s]">
              {["Set up in minutes", "No card required", "Made for standard cylinders"].map((item) => <span key={item} className="flex items-center gap-2"><Check size={13} className="text-orange-400" /> {item}</span>)}
            </div>
          </div>
          <div className="lumora-rise relative z-10 pt-4 [--rise-delay:.18s] lg:pt-0"><ProductPreview /></div>
        </section>

        <section className="border-y border-white/[.06] bg-white/[.018]">
          <div className="mx-auto grid max-w-[1240px] grid-cols-2 divide-x divide-white/[.06] px-5 sm:px-8 md:grid-cols-4">
            {[["15 sec", "Live refresh"], ["24/7", "Safety watch"], ["3 levels", "Clear status"], ["1 view", "Everything important"]].map(([value, label]) => (
              <div key={label} className="px-4 py-7 text-center"><p className="text-lg font-black text-white">{value}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">{label}</p></div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="relative mx-auto max-w-[1240px] scroll-mt-24 px-5 py-28 sm:px-8 sm:py-36">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <p className="lumora-kicker justify-center">How it works</p>
            <h2 className="mt-5 text-3xl font-black tracking-[-.045em] text-white sm:text-5xl">Ready in three simple steps.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-500">Thoughtful technology should feel simple from the first minute.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {steps.map(({ number, title, copy, icon: Icon }, index) => (
              <article key={title} className="lumora-panel group relative min-h-[360px] overflow-hidden rounded-[28px] p-2 transition duration-300 hover:-translate-y-1">
                <div className="relative h-full overflow-hidden rounded-[21px] border border-white/[.06] bg-[#0b1628] p-7 text-center">
                  <span className="absolute -right-3 -top-10 text-[110px] font-black text-white/[.025]">{number}</span>
                  <div className="mx-auto grid h-36 place-items-center rounded-2xl border border-white/[.06] bg-gradient-to-b from-orange-400/[.08] to-transparent">
                    <span className="grid size-16 place-items-center rounded-2xl bg-orange-400/10 text-orange-300 ring-1 ring-orange-300/15 shadow-[0_16px_35px_-20px_rgba(251,146,60,.8)]"><Icon size={27} /></span>
                  </div>
                  <div className="mx-auto -mt-3 inline-flex rounded-lg border border-orange-300/20 bg-[#14233a] px-3 py-1 text-[9px] font-black tracking-[.14em] text-orange-300">STEP {number}</div>
                  <h3 className="mt-7 text-xl font-black text-white">{title}</h3>
                  <p className="mx-auto mt-3 max-w-xs text-xs leading-6 text-slate-500">{copy}</p>
                  {index < 2 && <ArrowRight size={16} className="absolute -right-3 top-1/2 hidden text-slate-600 md:block" />}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="features" className="scroll-mt-24 border-y border-white/[.06] bg-[#091321] py-28 sm:py-36">
          <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
            <div className="mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-2xl"><p className="lumora-kicker">Designed around real life</p><h2 className="mt-5 text-3xl font-black tracking-[-.045em] text-white sm:text-5xl">Only the details that help you act.</h2></div>
              <p className="max-w-sm text-sm leading-7 text-slate-500">Every screen is built to answer supply, safety, timing, and service without making you hunt.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {features.map(({ icon: Icon, title, copy, tone }, index) => (
                <article key={title} className={`group rounded-[28px] border border-white/[.07] bg-gradient-to-br from-white/[.035] to-transparent p-7 transition duration-300 hover:border-orange-400/20 hover:bg-white/[.045] sm:p-9 ${index === 0 || index === 3 ? "md:min-h-[270px]" : ""}`}>
                  <div className="flex items-start justify-between gap-4"><span className={`grid size-12 place-items-center rounded-2xl ring-1 ${toneStyles[tone]}`}><Icon size={21} /></span><span className="text-[10px] font-black text-white/10">0{index + 1}</span></div>
                  <h3 className="mt-8 text-xl font-black tracking-tight text-white">{title}</h3>
                  <p className="mt-3 max-w-lg text-sm leading-7 text-slate-500">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="dashboard" className="mx-auto max-w-[1240px] scroll-mt-24 px-5 py-28 sm:px-8 sm:py-36">
          <div className="lumora-panel relative overflow-hidden rounded-[34px] px-6 py-14 sm:px-14 sm:py-16 lg:flex lg:items-center lg:justify-between lg:gap-16">
            <div className="lumora-orb -right-20 -top-40 size-96 bg-orange-500/15" />
            <div className="relative max-w-2xl"><span className="mb-6 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/20"><Sparkles size={21} /></span><h2 className="text-3xl font-black tracking-[-.045em] text-white sm:text-5xl">A calmer relationship with your gas.</h2><p className="mt-5 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">Replace tapping, lifting, and last-minute surprises with one useful view of your cylinder.</p></div>
            <div className="relative mt-9 shrink-0 lg:mt-0"><Link href="/auth/signup" className="group flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-b from-orange-300 to-orange-500 px-7 py-4 text-sm font-black text-[#241206] shadow-[0_18px_45px_-20px_rgba(249,115,22,.9)] transition hover:-translate-y-0.5">Create your free account <ArrowRight size={17} className="transition group-hover:translate-x-1" /></Link><p className="mt-3 text-center text-[10px] text-slate-500">Takes less than two minutes</p></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[.06] bg-[#050b14]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between"><Brand /><div className="flex flex-wrap gap-6 text-[10px] font-bold text-slate-500"><a href="#features" className="hover:text-white">Features</a><a href="#how-it-works" className="hover:text-white">How it works</a><Link href="/auth/login" className="hover:text-white">Log in</Link><span>© 2026 Lumora</span></div></div>
      </footer>
    </div>
  );
}
