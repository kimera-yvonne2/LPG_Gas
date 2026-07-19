"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { PageHeading } from "@/components/ui-kit";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ApiList, rows, UserNotification } from "@/lib/domain";

export default function NotificationsPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications"],
    enabled: Boolean(user),
    refetchInterval: 15_000,
    queryFn: async () => (
      await api.get<ApiList<UserNotification>>("/notifications/?page_size=100")
    ).data,
  });
  const markRead = useMutation({
    mutationFn: async (id: number) => api.post(`/notifications/${id}/mark-read/`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] }),
      ]);
    },
  });
  const markAllRead = useMutation({
    mutationFn: async () => api.post("/notifications/mark-all-read/"),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] }),
      ]);
    },
  });

  if (loading || !user) return null;
  const notifications = rows(query.data);
  const unread = notifications.filter((notification) => !notification.is_read).length;

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeading
        title="Notifications"
        subtitle="Safety, refill, device, and account updates for your LPG Guardian account."
        action={unread > 0 ? <button type="button" disabled={markAllRead.isPending} onClick={() => markAllRead.mutate()} className="btn-secondary">Mark all read</button> : undefined}
      />
      {query.isLoading ? (
        <State text="Checking notifications…" />
      ) : query.isError ? (
        <State text="Notifications could not be loaded." />
      ) : !notifications.length ? (
        <div className="card grid min-h-64 place-items-center text-center">
          <div>
            <CheckCircle2 className="mx-auto text-green-700" size={35} />
            <h2 className="section-title mt-3">No notifications yet</h2>
            <p className="mt-1 text-xs text-slate-500">Important activity will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Link
              href={notification.target_url}
              key={notification.id}
              onClick={() => { if (!notification.is_read) markRead.mutate(notification.id); }}
              className={`card flex gap-4 border-l-4 p-4 transition hover:bg-slate-50 ${notification.severity === "critical" ? "border-l-red-600" : notification.severity === "warning" ? "border-l-orange-500" : "border-l-blue-500"}`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded ${notification.is_read ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-[#073b82]"}`}>
                <Bell size={18} />
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-extrabold">{notification.title}</h2>
                  {!notification.is_read && <span className="h-2 w-2 rounded-full bg-[#0b58b5]" aria-label="Unread" />}
                </div>
                <p className="mt-1 text-xs text-slate-600">{notification.message}</p>
                <span className="mt-2 inline-block text-[9px] font-bold uppercase tracking-wide text-slate-400">{notification.category}</span>
              </div>
              <time className="text-[10px] text-slate-500">{new Date(notification.created_at).toLocaleString()}</time>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function State({ text }: { text: string }) {
  return <div className="card grid min-h-64 place-items-center text-sm text-slate-500"><span className="flex items-center gap-2"><AlertTriangle size={16} />{text}</span></div>;
}
