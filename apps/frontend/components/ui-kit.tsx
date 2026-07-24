"use client";

import { X } from "lucide-react";

export function PageHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[9px] font-black uppercase tracking-[.2em] text-orange-400">Lumora</p><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>;
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><div className="card w-full max-w-lg p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="section-title">{title}</h2><button className="grid size-9 place-items-center rounded-lg border border-white/10 text-slate-400 hover:text-white" onClick={onClose} aria-label="Close"><X size={18} /></button></div>{children}</div></div>;
}

export function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) { return <button className="switch" data-on={on} onClick={onChange} aria-pressed={on} />; }
