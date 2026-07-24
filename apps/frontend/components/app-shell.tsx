"use client";

import {
  Bell, Gauge, LogOut, Menu, Settings, ShieldCheck, Truck,
  UserRound, Users, X, ChevronRight, PanelLeftClose, PanelLeftOpen, Moon, Sun,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth, type Role } from "@/lib/auth";
import { NotificationPermissionBanner } from "@/components/notification-permission-banner";

const navigation: { href: string; label: string; icon: typeof Gauge; roles: Role[] }[] = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge, roles: ["admin", "household"] },
  { href: "/cylinders", label: "Cylinders & Devices", icon: ShieldCheck, roles: ["admin", "household"] },
  { href: "/refills", label: "Refill Providers", icon: Truck, roles: ["household"] },
  { href: "/refills", label: "Refill Operations", icon: Truck, roles: ["admin"] },
  { href: "/refills", label: "Assigned Refills", icon: Truck, roles: ["technician"] },
  { href: "/alerts", label: "Notifications", icon: Bell, roles: ["household", "technician", "admin"] },
  { href: "/users", label: "User Management", icon: Users, roles: ["admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin", "technician", "household"] },
];

const roleNames: Record<Role, string> = { admin: "Administrator", technician: "Technician", household: "Household" };

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [lightMode, setLightMode] = useState(false);
  useEffect(() => {
    setLightMode(window.localStorage.getItem("lpg-theme") === "light");
  }, []);
  const toggleTheme = () => {
    setLightMode(current => {
      const next = !current;
      window.localStorage.setItem("lpg-theme", next ? "light" : "dark");
      return next;
    });
  };
  const unreadQuery = useQuery({
    queryKey: ["notification-unread-count"],
    enabled: Boolean(user),
    refetchInterval: 15_000,
    queryFn: async () => (await api.get<{ count: number }>("/notifications/unread-count/")).data,
  });
  if (pathname === "/" || pathname.startsWith("/auth/")) {
  return <>{children}</>;
  }
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#08111f] text-sm font-bold text-orange-400">Loading Lumora...</div>;
  if (!user) {
    if (typeof window !== "undefined") window.location.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
    return null;
  }

  const visibleNavigation = navigation.filter(item => item.roles.includes(user.role));
  const roleLabel = roleNames[user.role];

  return (
    <div className={`app-theme lumora-grid min-h-screen ${lightMode ? "app-theme-light" : ""}`}>
      {open && <button aria-label="Close navigation overlay" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" />}
      <aside className={`app-sidebar fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-white/[.07] bg-[#081321]/95 text-white shadow-[20px_0_70px_-50px_rgba(0,0,0,.95)] backdrop-blur-2xl transition-[transform,width] duration-300 lg:translate-x-0 ${collapsed ? "lg:w-20" : "lg:w-[260px]"} ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className={`flex h-[64px] items-center border-b border-white/[.07] ${collapsed ? "lg:justify-center lg:px-0" : "px-5"}`}>
          <Link to="/dashboard" className={`flex items-center gap-3 ${collapsed ? "lg:hidden" : ""}`}>
            <span className="relative grid size-10 place-items-center overflow-hidden rounded-[14px] bg-gradient-to-br from-orange-300 via-orange-500 to-orange-700 shadow-[0_12px_28px_-12px_rgba(249,115,22,.8)]"><span className="absolute inset-[3px] rounded-[11px] border border-white/25" /><Gauge size={19} className="relative" /></span>
            <span className={collapsed ? "lg:hidden" : ""}><span className="block font-[Raleway] text-[16px] font-black tracking-[-.035em]">Lumora</span><span className="block text-[8px] font-extrabold uppercase tracking-[.2em] text-slate-500">Gas, made visible</span></span>
          </Link>
          <button className={`hidden size-9 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white lg:grid ${collapsed ? "" : "ml-auto"}`} onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} title={collapsed ? "Expand navigation" : "Collapse navigation"}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button>
          <button className="ml-auto grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-white/5 lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>

        <div className={`px-4 pt-6 ${collapsed ? "lg:hidden" : ""}`}><p className="px-3 text-[8px] font-black uppercase tracking-[.22em] text-slate-600">Workspace</p></div>
        <nav className="mt-3 space-y-1 px-3">
          {visibleNavigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return <Link key={`${href}-${label}`} to={href} onClick={() => setOpen(false)} title={collapsed ? label : undefined} className={`group flex h-11 items-center gap-3 rounded-[13px] px-3.5 text-[11px] font-bold transition ${collapsed ? "lg:justify-center lg:px-0" : ""} ${active ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-[0_12px_28px_-16px_rgba(249,115,22,.8)] ring-1 ring-orange-300/20" : "text-slate-400 hover:bg-white/[.045] hover:text-white"}`}><Icon size={16} /><span className={collapsed ? "lg:hidden" : ""}>{label}</span>{active && <ChevronRight size={13} className={`ml-auto ${collapsed ? "lg:hidden" : ""}`} />}</Link>;
          })}
        </nav>

        <div className="mt-auto p-3">
          <div className={`mb-2 rounded-2xl border border-emerald-400/10 bg-emerald-400/[.04] p-3.5 ${collapsed ? "lg:hidden" : ""}`}><div className="flex items-center gap-2 text-[10px] font-bold text-emerald-300"><span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> System operational</div><p className="mt-1.5 text-[9px] leading-4 text-slate-500">Live monitoring services are online.</p></div>
          <button onClick={() => void logout()} title={collapsed ? "Sign out" : undefined} className={`flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-[12px] font-bold text-slate-500 transition hover:bg-red-400/10 hover:text-red-300 ${collapsed ? "lg:justify-center lg:px-0" : ""}`}><LogOut size={16} /> <span className={collapsed ? "lg:hidden" : ""}>Sign out</span></button>
        </div>
      </aside>
      <div className={`app-main ml-0 min-h-screen transition-[margin] duration-300 ${collapsed ? "lg:ml-20" : "lg:ml-[260px]"}`}>
        <header className="app-header sticky top-0 z-30 flex h-[64px] items-center gap-4 border-b border-white/[.07] bg-[#081321]/85 px-4 backdrop-blur-2xl sm:px-7">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu /></button>
          <div><div className="text-[12px] font-extrabold text-white">{user.role === "technician" ? "Refill operations" : "Live monitoring"}</div><div className="mt-0.5 hidden text-[8px] font-bold uppercase tracking-[.14em] text-slate-600 sm:block">Lumora workspace</div></div>
          <div className="ml-auto flex items-center gap-3"><button onClick={toggleTheme} className="theme-toggle grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-orange-300" aria-label={`Switch to ${lightMode ? "dark" : "light"} mode`} title={`Switch to ${lightMode ? "dark" : "light"} mode`}>{lightMode ? <Moon size={18} /> : <Sun size={18} />}</button><Link to="/alerts" className="notification-bell relative text-white transition hover:text-orange-300" aria-label={`${unreadQuery.data?.count || 0} unread notifications`}>{Boolean(unreadQuery.data?.count) && <span className="absolute -right-2 -top-2 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">{Math.min(unreadQuery.data?.count || 0, 99)}</span>}</Link><div className="h-7 w-px bg-white/15" /><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-orange-500/15 text-orange-300 ring-1 ring-orange-400/20"><UserRound size={16} /></span><div className="hidden text-right sm:block"><div className="text-[12px] font-bold text-slate-100">{user.username}</div><div className="text-[10px] text-slate-400">{roleLabel}</div></div></div></div>
        </header>
        <NotificationPermissionBanner />
        <main className="min-h-[calc(100vh-110px)] p-4 sm:p-7 lg:p-8">{children}</main>
        <footer className="app-footer flex min-h-12 items-center justify-between border-t border-white/[.06] bg-[#081321]/80 px-6 text-[9px] text-slate-600"><span>© 2026 Lumora.</span><div className="hidden gap-5 sm:flex"><span>Terms</span><span>Privacy</span><span>Support</span></div></footer>
      </div>
    </div>
  );
}
