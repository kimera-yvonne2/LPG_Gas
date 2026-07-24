"use client";

import { Bell, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

import {
  enableWebPush,
  getWebPushStatus,
  type WebPushStatus,
} from "@/lib/web-push";

export function NotificationPermissionBanner() {
  const [status, setStatus] = useState<WebPushStatus | "loading" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void getWebPushStatus().then(setStatus).catch(() => setStatus("error"));
  }, []);

  const enable = async () => {
    setBusy(true);
    setMessage("");
    try {
      await enableWebPush();
      setStatus("enabled");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Notifications could not be enabled.");
      setStatus(await getWebPushStatus().catch(() => "error"));
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading" || status === "enabled" || status === "unsupported") return null;
  if (status === "server-disabled" || status === "error") return null;

  if (status === "insecure") {
    return (
      <section className="mx-6 mt-5 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
        <Bell size={20} className="shrink-0" aria-hidden="true" />
        <div>
          <p className="text-xs font-extrabold">Device notifications require a secure connection</p>
          <p className="mt-0.5 text-[11px] leading-4">
            Open Lumora over HTTPS. For development on this computer, use localhost rather than its network IP address.
          </p>
        </div>
      </section>
    );
  }

  if (status === "blocked") {
    return (
      <section className="mx-6 mt-5 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-white">
        <Bell size={20} className="shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold">Device notifications are blocked</p>
          <p className="mt-0.5 text-[11px] leading-4">
            Allow notifications for this site in your browser settings, then return to Settings.
          </p>
        </div>
        <Link to="/settings" className="btn-secondary shrink-0">
          Settings <ExternalLink size={13} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-6 mt-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-[#0b2442]">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#073b82]">
          <Bell size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold">Get important Lumora alerts on this device</p>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-600">
            Enable notifications for safety alerts, refill updates, and device events.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void enable()}
          className="btn-primary shrink-0"
        >
          {busy ? "Enabling…" : "Enable notifications"}
        </button>
      </div>
      {message && <p className="mt-2 text-[11px] text-red-700">{message}</p>}
    </section>
  );
}
