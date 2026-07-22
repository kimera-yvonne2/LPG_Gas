import { Check, Gauge, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <main className="auth-theme relative grid min-h-screen overflow-hidden bg-[#08111f] lg:grid-cols-[.85fr_1.15fr]">
    <div className="pointer-events-none absolute -left-40 -top-40 size-[520px] rounded-full bg-orange-500/10 blur-[120px]" />
    <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[.07] bg-[#0a1424] p-12 lg:flex">
      <div><Link href="/" className="inline-flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-xl shadow-orange-600/20"><Gauge size={21} /></span><span><strong className="block text-base text-white">LPG Guardian</strong><span className="text-[9px] font-bold uppercase tracking-[.2em] text-slate-500">Smart gas monitoring</span></span></Link></div>
      <div className="relative"><span className="mb-7 grid size-14 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20"><ShieldCheck size={26} /></span><h2 className="max-w-md text-4xl font-black leading-tight tracking-[-.045em] text-white">Confidence in every cylinder.</h2><p className="mt-5 max-w-md text-sm leading-7 text-slate-500">One secure workspace for live levels, early leak alerts, accurate forecasts, and dependable refill operations.</p><div className="mt-9 space-y-3">{["Continuous safety monitoring", "Role-based secure access", "Real-time cylinder insight"].map(item => <p key={item} className="flex items-center gap-3 text-xs font-semibold text-slate-400"><span className="grid size-6 place-items-center rounded-full bg-emerald-400/10 text-emerald-300"><Check size={12} /></span>{item}</p>)}</div></div>
      <p className="text-[10px] text-slate-600">© 2026 LPG Guardian · Kampala, Uganda</p>
    </aside>
    <section className="relative grid place-items-center px-4 py-10 sm:px-8"><div className="w-full max-w-[630px]"><Link href="/" className="mb-8 flex items-center justify-center gap-2 text-sm font-black text-white lg:hidden"><Gauge className="text-orange-400" /> LPG Guardian</Link><div className="rounded-[28px] border border-white/[.09] bg-[#0d192b]/90 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-9"><div className="mb-7"><p className="mb-2 text-[10px] font-black uppercase tracking-[.2em] text-orange-400">Secure access</p><h1 className="text-3xl font-black tracking-[-.04em] text-white">{title}</h1><p className="mt-2 text-sm text-slate-500">{subtitle}</p></div>{children}</div></div></section>
  </main>;
}
