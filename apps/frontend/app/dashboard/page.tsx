"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BarChart3, ShieldCheck, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PageHeading } from "@/components/ui-kit";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && user.role !== "household") {
      router.replace(user.role === "technician" ? "/refills" : "/analytics");
    }
  }, [loading, router, user]);

  if (loading || !user || user.role !== "household") return (
    <div className="grid min-h-64 place-items-center text-sm font-bold text-[#073b82]">
      Loading your dashboard…
    </div>
  );

  const actions = [
    { href: "/cylinders", label: "Cylinders & Devices", description: "View gas levels and connected sensors.", icon: ShieldCheck },
    { href: "/analytics", label: "Usage Analytics", description: "Review gas usage and telemetry history.", icon: BarChart3 },
    { href: "/refills", label: "Request a Refill", description: "Find a provider and track refill requests.", icon: Truck },
    { href: "/alerts", label: "Safety Alerts", description: "Check leak, temperature, and low-gas warnings.", icon: Bell },
  ];

  return <div className="mx-auto max-w-[1180px]">
    <PageHeading title={`Welcome, ${user.username}`} subtitle="Your household LPG monitoring dashboard." />
    <div className="grid gap-4 sm:grid-cols-2">
      {actions.map(({ href, label, description, icon: Icon }) => <Link key={href} href={href} className="card flex items-start gap-4 p-5 transition hover:border-[#0b58b5] hover:shadow-sm">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-[#073b82]"><Icon size={20} /></span>
        <span><strong className="text-sm text-[#073b82]">{label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span>
      </Link>)}
    </div>
  </div>;
}
