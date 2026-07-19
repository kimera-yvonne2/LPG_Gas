"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { disableWebPush, enableWebPush, getWebPushStatus } from "@/lib/web-push";

type Status = Awaited<ReturnType<typeof getWebPushStatus>> | "loading" | "error";

export function WebPushSettings() {
  const [status, setStatus] = useState<Status>("loading");
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
      setMessage("Device notifications are enabled on this browser.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Notifications could not be enabled.");
      setStatus(await getWebPushStatus().catch(() => "error"));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMessage("");
    try {
      await disableWebPush();
      setStatus("available");
      setMessage("Device notifications are disabled on this browser.");
    } catch {
      setMessage("Notifications could not be disabled.");
    } finally {
      setBusy(false);
    }
  };

  const unavailable = status === "unsupported" || status === "server-disabled" || status === "blocked";
  const detail = status === "unsupported"
    ? "This browser does not support Web Push."
    : status === "server-disabled"
      ? "The server administrator must configure the VAPID key pair first."
      : status === "blocked"
        ? "Notifications are blocked in this browser's site settings."
        : "Receive safety and refill updates even when LPG Guardian is not open.";

  return (
    <section className="card mt-5 p-6">
      <div className="flex items-start justify-between gap-5">
        <div className="flex gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-50 text-[#073b82]">
            {status === "enabled" ? <Bell size={19} /> : <BellOff size={19} />}
          </span>
          <div>
            <h2 className="section-title">Device notifications</h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-slate-600">{detail}</p>
            <p className="mt-1 text-[10px] text-slate-500">On iPhone or iPad, add LPG Guardian to the Home Screen before enabling notifications.</p>
          </div>
        </div>
        {status === "enabled" ? (
          <button type="button" disabled={busy} onClick={() => void disable()} className="btn-secondary shrink-0">{busy ? "Disabling…" : "Disable"}</button>
        ) : (
          <button type="button" disabled={busy || unavailable || status === "loading" || status === "error"} onClick={() => void enable()} className="btn-primary shrink-0">{busy ? "Enabling…" : "Enable notifications"}</button>
        )}
      </div>
      {message && <p className={`mt-4 text-xs ${message.includes("are enabled") || message.includes("are disabled") ? "text-green-700" : "text-red-700"}`}>{message}</p>}
      {status === "error" && <p className="mt-4 text-xs text-red-700">Notification configuration could not be loaded.</p>}
    </section>
  );
}
