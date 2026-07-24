import { Check, Gauge, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <main className="auth-theme relative grid min-h-screen overflow-hidden bg-[#08111f] lg:grid-cols-[.85fr_1.15fr]">
    <div className="pointer-events-none absolute -left-40 -top-40 size-[520px] rounded-full bg-orange-500/10 blur-[120px]" />
    <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[.07] bg-[#0a1424] p-12 lg:flex">
      <div><Link to="/" className="inline-flex items-center gap-3"><span className="grid size-11 place-items-center rounded-[15px] bg-gradient-to-br from-orange-300 via-orange-500 to-orange-700 text-white shadow-xl shadow-orange-600/20"><Gauge size={21} /></span><span><strong className="block text-base text-white">Lumora</strong><span className="text-[9px] font-bold uppercase tracking-[.2em] text-slate-500">Gas, made visible</span></span></Link></div>
      <div className="relative"><span className="mb-7 grid size-14 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20"><ShieldCheck size={26} /></span><h2 className="max-w-md text-4xl font-black leading-tight tracking-[-.045em] text-white">Confidence in every cylinder.</h2><p className="mt-5 max-w-md text-sm leading-7 text-slate-500">One secure workspace for live levels, early leak alerts, accurate forecasts, and dependable refill operations.</p><div className="mt-9 space-y-3">{["Continuous safety monitoring", "Role-based secure access", "Real-time cylinder insight"].map(item => <p key={item} className="flex items-center gap-3 text-xs font-semibold text-slate-400"><span className="grid size-6 place-items-center rounded-full bg-emerald-400/10 text-emerald-300"><Check size={12} /></span>{item}</p>)}</div></div>
      <p className="text-[10px] text-slate-600">© 2026 Lumora · Kampala, Uganda</p>
    </aside>
    <section className="relative grid place-items-center px-4 py-10 sm:px-8"><div className="w-full max-w-[630px]"><Link to="/" className="mb-8 flex items-center justify-center gap-2 text-sm font-black text-white lg:hidden"><Gauge className="text-orange-400" /> Lumora</Link><div className="lumora-panel rounded-[28px] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-9"><div className="mb-7"><p className="mb-2 text-[10px] font-black uppercase tracking-[.2em] text-orange-400">Secure access</p><h1 className="text-3xl font-black tracking-[-.04em] text-white">{title}</h1><p className="mt-2 text-sm text-slate-500">{subtitle}</p></div>{children}</div></div></section>
  </main>;
}

export function SignupFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="auth-theme lumora-grid relative min-h-[100svh] overflow-hidden bg-[#070f1b] px-4 py-8 text-slate-100 sm:px-6 sm:py-10">
      <div className="lumora-orb -left-48 -top-48 size-[520px] bg-orange-500/[.09]" />
      <div className="lumora-orb -bottom-56 -right-32 size-[560px] bg-orange-500/[.07]" />
      <svg aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] w-full opacity-70" viewBox="0 0 1440 620" preserveAspectRatio="none">
        <path d="M0 165C233 257 361 53 636 148c282 97 425-39 804 27v445H0Z" fill="#fb923c" fillOpacity=".025" />
        <path d="M0 261c285-89 441 178 759 67 269-94 445 63 681 15v277H0Z" fill="#ffffff" fillOpacity=".018" />
        <path d="M0 410c248-93 417 109 690 62 329-57 472 76 750 4v144H0Z" fill="#fb923c" fillOpacity=".035" />
      </svg>

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-[760px] flex-col items-center justify-center sm:min-h-[calc(100svh-5rem)]">
        <Link to="/" className="group mb-7 flex items-center gap-3" aria-label="Lumora home">
          <span className="relative grid size-12 place-items-center overflow-hidden rounded-[16px] bg-gradient-to-br from-orange-300 via-orange-500 to-orange-700 text-white shadow-[0_16px_35px_-15px_rgba(249,115,22,.9)] transition group-hover:-rotate-3">
            <span className="absolute inset-[3px] rounded-[13px] border border-white/25" />
            <Gauge size={22} className="relative" />
          </span>
          <span><strong className="block font-[Raleway] text-lg font-black tracking-[-.035em] text-white">Lumora</strong><span className="block text-[8px] font-extrabold uppercase tracking-[.22em] text-slate-500">Gas, made visible</span></span>
        </Link>

        <div className="mb-7 text-center">
          <p className="lumora-kicker justify-center">Household registration</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-.045em] text-white sm:text-[40px]">{title}</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">{subtitle}</p>
        </div>

        <section className="lumora-panel w-full rounded-[28px] p-5 shadow-[0_30px_90px_-42px_rgba(0,0,0,.95)] sm:p-8">
          {children}
        </section>

        <p className="mt-6 text-center text-[9px] text-slate-700">© 2026 Lumora · Secure household monitoring</p>
      </div>
    </main>
  );
}
