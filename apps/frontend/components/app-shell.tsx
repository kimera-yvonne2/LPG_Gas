"use client";

import {
  BarChart3,
  Bell,
  Gauge,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Truck,
  UserRound,
  Users,
  X,
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
  { href: "/refills", label: "Refill Requests", icon: Truck, roles: ["technician"] },
  { href: "/alerts", label: "Alerts", icon: Bell, roles: ["household"] },
  { href: "/users", label: "User Management", icon: Users, roles: ["admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin", "technician", "household"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  if (pathname === "/" || pathname.startsWith("/auth/")) {
  return <>{children}</>;
  }
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f3f6fa] text-sm font-bold text-[#073b82]">Loading LPG Guardian…</div>;
  if (!user) {
    if (typeof window !== "undefined") window.location.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
    return null;
  }
  const roleLabel = user.role === "admin" ? "Administrator" : user.role === "technician" ? "Technician" : "Household";
  return (
    <div className="min-h-screen bg-[#f3f6fa]">
      <aside className={`desktop-sidebar fixed inset-y-0 left-0 z-40 w-[218px] bg-[#073b82] text-white ${open ? "!block" : ""}`}>
        <div className="flex h-[68px] items-center justify-between border-b border-white/15 px-5">
          <div><div className="text-[18px] font-extrabold">LPG Guardian</div><div className="text-[10px] text-blue-100">Smart Gas Monitoring</div></div>
          <button className="md:hidden" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <nav className="space-y-1 px-3 py-5">
          {navigation.filter(item => item.roles.includes(user.role)).map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return <Link key={`${href}-${label}`} href={href} onClick={() => setOpen(false)} className={`flex h-11 items-center gap-3 rounded-md px-4 text-[13px] font-semibold transition ${active ? "bg-[#0b58b5] text-white" : "text-blue-50 hover:bg-white/10"}`}><Icon size={17} />{label}</Link>;
          })}
        </nav>
        <button onClick={() => void logout()} className="absolute bottom-5 left-4 flex items-center gap-3 px-3 text-[12px] font-semibold text-blue-100"><LogOut size={16} /> Logout</button>
      </aside>
      <div className="app-main ml-[218px] min-h-screen">
        <header className="sticky top-0 z-30 flex h-[62px] items-center gap-4 border-b border-[#d8e1ec] bg-white px-6">
          <button className="md:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu /></button>
          <div className="text-sm font-extrabold text-[#073b82]">{user.role === "technician" ? "Refill Operations" : "Live Monitoring"}</div>
          <div className="ml-auto flex items-center gap-4">{user.role === "household" && <Link href="/alerts" className="text-slate-600" aria-label="Notifications"><Bell size={19} /></Link>}<div className="h-7 w-px bg-slate-200" /><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#e6eef8] text-[#073b82]"><UserRound size={16} /></span><div className="hidden text-right sm:block"><div className="text-[12px] font-bold">{user.username}</div><div className="text-[10px] text-slate-500">{roleLabel}</div></div></div></div>
        </header>
        <main className="min-h-[calc(100vh-110px)] p-6">{children}</main>
        <footer className="flex min-h-12 items-center justify-between border-t border-[#d8e1ec] bg-white px-6 text-[10px] text-slate-500"><span>© 2026 LPG Guardian.</span><div className="flex gap-5"><span>Terms of Service</span><span>Privacy Policy</span><span>Contact Support</span></div></footer>
      </div>
    </div>
  );
}
