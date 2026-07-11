"use client";

import { X } from "lucide-react";

export function PageHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex items-start justify-between gap-4"><div><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>;
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#061a32]/55 p-4"><div className="card w-full max-w-lg p-5"><div className="mb-5 flex items-center justify-between"><h2 className="section-title">{title}</h2><button onClick={onClose} aria-label="Close"><X size={20} /></button></div>{children}</div></div>;
}

export function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) { return <button className="switch" data-on={on} onClick={onChange} aria-pressed={on} />; }
