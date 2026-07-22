"use client";

import {
  BarChart3, Bell, Gauge, LogOut, Menu, Settings, ShieldCheck, Truck,
  UserRound, Users, X, ChevronRight, Radio,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth, type Role } from "@/lib/auth";

const navigation: { href: string; label: string; icon: typeof Gauge; roles: Role[] }[] = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge, roles: ["admin", "household"] },
  { href: "/analytics", label: "Analytics", icon: BarChart3, roles: ["admin", "household"] },
  { href: "/cylinders", label: "Cylinders & Devices", icon: ShieldCheck, roles: ["admin", "household"] },
  { href: "/refills", label: "Refill Providers", icon: Truck, roles: ["household"] },
  { href: "/refills", label: "Refill Operations", icon: Truck, roles: ["admin"] },
  { href: "/refills", label: "Assigned Refills", icon: Truck, roles: ["technician"] },
  { href: "/alerts", label: "Safety Alerts", icon: Bell, roles: ["household"] },
  { href: "/users", label: "User Management", icon: Users, roles: ["admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin", "technician", "household"] },
];

const roleNames: Record<Role, string> = { admin: "Administrator", technician: "Technician", household: "Household" };

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  if (pathname === "/" || pathname === "/landingpage" || pathname.startsWith("/auth/")) return <>{children}</>;
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#08111f] text-sm font-bold text-orange-300"><span className="flex items-center gap-3"><Radio className="animate-pulse" size={18} /> Loading LPG Guardian…</span></div>;
  if (!user) {
    if (typeof window !== "undefined") window.location.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
    return null;
  }

  const visibleNavigation = navigation.filter(item => item.roles.includes(user.role));
  const current = visibleNavigation.find(item => pathname === item.href);

  return (
    <div className="app-theme min-h-screen bg-[#08111f] text-slate-100">
      {open && <button aria-label="Close navigation overlay" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-white/[.07] bg-[#0a1424]/95 text-white backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-20 items-center border-b border-white/[.07] px-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-600/20"><Gauge size={20} /></span>
            <span><span className="block text-[15px] font-black tracking-tight">LPG Guardian</span><span className="block text-[9px] font-bold uppercase tracking-[.16em] text-slate-500">Smart gas monitoring</span></span>
          </Link>
          <button className="ml-auto grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-white/5 lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>

        <div className="px-4 pt-6"><p className="px-3 text-[9px] font-black uppercase tracking-[.2em] text-slate-600">Workspace</p></div>
        <nav className="mt-3 space-y-1 px-3">
          {visibleNavigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return <Link key={`${href}-${label}`} href={href} onClick={() => setOpen(false)} className={`group flex h-11 items-center gap-3 rounded-xl px-3.5 text-[12px] font-bold transition ${active ? "bg-orange-500 text-white shadow-lg shadow-orange-950/20" : "text-slate-400 hover:bg-white/[.05] hover:text-white"}`}><Icon size={17} /><span>{label}</span>{active && <ChevronRight size={14} className="ml-auto" />}</Link>;
          })}
        </nav>

        <div className="mt-auto p-3">
          <div className="mb-2 rounded-2xl border border-emerald-400/10 bg-emerald-400/[.04] p-3.5"><div className="flex items-center gap-2 text-[10px] font-bold text-emerald-300"><span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> System operational</div><p className="mt-1.5 text-[9px] leading-4 text-slate-500">Live monitoring services are online.</p></div>
          <button onClick={() => void logout()} className="flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-[12px] font-bold text-slate-500 transition hover:bg-red-400/10 hover:text-red-300"><LogOut size={16} /> Sign out</button>
        </div>
      </aside>

      <div className="min-h-screen lg:ml-[260px]">
        <header className="sticky top-0 z-30 flex h-20 items-center gap-4 border-b border-white/[.07] bg-[#08111f]/80 px-5 backdrop-blur-xl sm:px-8">
          <button className="grid size-10 place-items-center rounded-xl border border-white/10 text-slate-300 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div><p className="text-[9px] font-black uppercase tracking-[.18em] text-orange-400">{roleNames[user.role]} workspace</p><p className="mt-1 text-sm font-extrabold text-white">{current?.label ?? "LPG Guardian"}</p></div>
          <div className="ml-auto flex items-center gap-3">
            {user.role === "household" && <Link href="/alerts" className="relative grid size-10 place-items-center rounded-xl border border-white/[.08] bg-white/[.03] text-slate-400 transition hover:text-white" aria-label="Notifications"><Bell size={17} /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-orange-400" /></Link>}
            <div className="hidden h-8 w-px bg-white/[.08] sm:block" />
            <div className="flex items-center gap-2.5"><span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-orange-300 ring-1 ring-white/10"><UserRound size={17} /></span><div className="hidden sm:block"><p className="max-w-36 truncate text-[11px] font-extrabold text-white">{user.username}</p><p className="mt-0.5 text-[9px] text-slate-500">{roleNames[user.role]}</p></div></div>
          </div>
        </header>
        <main className="min-h-[calc(100vh-80px)] px-5 py-7 sm:px-8 sm:py-9">{children}</main>
      </div>
    </div>
  );
}
