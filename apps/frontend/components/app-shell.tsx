"use client";

import {
  BarChart3,
  Bell,
  Gauge,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigation = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/cylinders", label: "Cylinders", icon: ShieldCheck },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/providers", label: "Service Provider", icon: Truck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#f3f6fa]">
      <aside className={`desktop-sidebar fixed inset-y-0 left-0 z-40 w-[218px] bg-[#073b82] text-white ${open ? "!block" : ""}`}>
        <div className="flex h-[68px] items-center justify-between border-b border-white/15 px-5">
          <div><div className="text-[18px] font-extrabold">LPG Guardian</div><div className="text-[10px] text-blue-100">Smart Gas Monitoring</div></div>
          <button className="md:hidden" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <nav className="space-y-1 px-3 py-5">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex h-11 items-center gap-3 rounded-md px-4 text-[13px] font-semibold transition ${active ? "bg-[#0b58b5] text-white" : "text-blue-50 hover:bg-white/10"}`}><Icon size={17} />{label}</Link>;
          })}
        </nav>
        <button className="absolute bottom-5 left-4 flex items-center gap-3 px-3 text-[12px] font-semibold text-blue-100"><LogOut size={16} /> Logout</button>
      </aside>
      <div className="app-main ml-[218px] min-h-screen">
        <header className="sticky top-0 z-30 flex h-[62px] items-center gap-4 border-b border-[#d8e1ec] bg-white px-6">
          <button className="md:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu /></button>
          <div className="relative max-w-[520px] flex-1"><Search className="absolute left-3 top-2.5 text-slate-500" size={17} /><input className="field pl-10" placeholder="Search anything..." /></div>
          <div className="ml-auto flex items-center gap-4"><button className="relative text-slate-600" aria-label="Notifications"><Bell size={19} /><span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" /></button><div className="h-7 w-px bg-slate-200" /><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#e6eef8] text-[#073b82]"><UserRound size={16} /></span><div className="hidden text-right sm:block"><div className="text-[12px] font-bold">Johnathan Doe</div><div className="text-[10px] text-slate-500">Household</div></div></div></div>
        </header>
        <main className="min-h-[calc(100vh-110px)] p-6">{children}</main>
        <footer className="flex min-h-12 items-center justify-between border-t border-[#d8e1ec] bg-white px-6 text-[10px] text-slate-500"><span>© 2026 LPG Guardian.</span><div className="flex gap-5"><span>Terms of Service</span><span>Privacy Policy</span><span>Contact Support</span></div></footer>
      </div>
    </div>
  );
}
