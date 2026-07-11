"use client";

import { AlertTriangle, BellRing, CheckCircle2, Download, Info, Wrench, X } from "lucide-react";
import { useState } from "react";
import { PageHeading } from "@/components/ui-kit";

const seed = [
  { id: 1, group: "Critical Priority", title: "Low Gas Level Detected - Tank #01", text: "Cylinder has dropped below 15%. Refill recommended immediately.", time: "2 min ago", tone: "red", action: "Schedule Refill" },
  { id: 2, group: "Critical Priority", title: "Gas Leakage Detected", text: "High pressure drop detected. Main valve isolated automatically.", time: "1 hour ago", tone: "red", action: "Call Emergency Services" },
  { id: 3, group: "Maintenance & Info", title: "Scheduled System Update", text: "Cloud service maintenance is scheduled for Sunday at 02:00 AM.", time: "Yesterday", tone: "blue", action: "Learn More" },
  { id: 4, group: "Maintenance & Info", title: "Monthly Consumption Report Ready", text: "Your monthly gas usage report is now available.", time: "2 days ago", tone: "blue", action: "Download PDF" },
  { id: 5, group: "Activity Log", title: "Refill Successful - Tank #01", text: "Cylinder refilled successfully at Shell Uganda.", time: "3 days ago", tone: "green", action: "" },
];
export default function AlertsPage() {
  const [items, setItems] = useState(seed);
  const groups = ["Critical Priority", "Maintenance & Info", "Activity Log"];
  return <div className="mx-auto max-w-[1180px]"><PageHeading title="Notifications & Alerts" subtitle="Review critical events, maintenance updates, and activity." action={<div className="flex gap-2"><button onClick={() => setItems([])} className="btn-danger">Clear All</button><button className="btn-secondary">Unread</button></div>} />{groups.map(group => { const rows = items.filter(x => x.group === group); if (!rows.length) return null; return <section key={group} className="mb-6"><h2 className={`mb-3 flex items-center gap-2 text-[14px] font-extrabold ${group === "Critical Priority" ? "text-red-700" : "text-[#17314d]"}`}>{group === "Critical Priority" ? <AlertTriangle size={16} /> : group === "Activity Log" ? <CheckCircle2 size={16} /> : <Info size={16} />}{group}</h2><div className="space-y-3">{rows.map(item => <article key={item.id} className={`card flex gap-4 border-l-4 p-4 ${item.tone === "red" ? "border-l-red-600" : item.tone === "green" ? "border-l-green-600" : "border-l-[#0b58b5]"}`}><span className={`grid h-9 w-9 place-items-center rounded ${item.tone === "red" ? "bg-red-50 text-red-700" : item.tone === "green" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>{item.tone === "red" ? <BellRing size={18} /> : item.tone === "green" ? <CheckCircle2 size={18} /> : <Wrench size={18} />}</span><div className="flex-1"><div className="text-[13px] font-extrabold">{item.title}</div><p className="mt-1 text-[11px] text-slate-600">{item.text}</p>{item.action && <button className={item.tone === "red" ? "btn-danger mt-3" : "btn-secondary mt-3"}>{item.action === "Download PDF" && <Download size={13} />}{item.action}</button>}</div><div className="flex flex-col items-end gap-3"><span className="text-[9px] text-slate-500">{item.time}</span><button onClick={() => setItems(items.filter(x => x.id !== item.id))} aria-label="Dismiss"><X size={15} className="text-slate-500" /></button></div></article>)}</div></section>; })}{!items.length && <div className="card grid min-h-64 place-items-center text-center"><div><CheckCircle2 className="mx-auto mb-3 text-green-700" size={32} /><div className="section-title">All caught up</div></div></div>}</div>;
}
