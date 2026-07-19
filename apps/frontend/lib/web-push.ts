import { api } from "./api";

type WebPushConfig = { enabled: boolean; public_key: string };
export type WebPushStatus =
  | "unsupported"
  | "insecure"
  | "server-disabled"
  | "blocked"
  | "enabled"
  | "available";

function decodeApplicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

export function webPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

async function config() {
  return (await api.get<WebPushConfig>("/web-push/config/")).data;
}

async function saveSubscription(subscription: PushSubscription) {
  await api.post("/push-subscriptions/", subscription.toJSON());
}

async function serviceWorkerRegistration() {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration?.pushManager.getSubscription() ?? null;
}

function usesApplicationServerKey(subscription: PushSubscription, expected: Uint8Array<ArrayBuffer>) {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const currentBytes = new Uint8Array(current);
  return (
    currentBytes.length === expected.length &&
    currentBytes.every((value, index) => value === expected[index])
  );
}

export async function enableWebPush() {
  if (!webPushSupported()) throw new Error("This browser does not support Web Push.");
  if (!window.isSecureContext) {
    throw new Error("Device notifications require HTTPS (localhost is supported for development).");
  }
  const pushConfig = await config();
  if (!pushConfig.enabled || !pushConfig.public_key) {
    throw new Error("Web Push has not been configured on the server.");
  }
  if (Notification.permission === "denied") {
    throw new Error("Notifications are blocked. Allow them in this browser's site settings.");
  }
  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted. Select Allow when prompted.");
  }

  const applicationServerKey = decodeApplicationServerKey(pushConfig.public_key);
  if (applicationServerKey.length !== 65) {
    throw new Error("The server's Web Push public key is invalid.");
  }
  const registration = await serviceWorkerRegistration();
  let existing = await registration.pushManager.getSubscription();
  if (existing && !usesApplicationServerKey(existing, applicationServerKey)) {
    await existing.unsubscribe();
    existing = null;
  }
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
  await saveSubscription(subscription);
  return subscription;
}

export async function registerExistingPushSubscription() {
  if (!webPushSupported() || Notification.permission !== "granted") return false;
  const registration = await serviceWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;
  await saveSubscription(subscription);
  return true;
}

export async function disableWebPush() {
  if (!webPushSupported()) return;
  const subscription = await currentSubscription();
  if (!subscription) return;
  await api.post("/push-subscriptions/remove-endpoint/", { endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}

export async function detachWebPushFromCurrentUser() {
  if (!webPushSupported() || Notification.permission !== "granted") return;
  const subscription = await currentSubscription();
  if (subscription) {
    await api.post("/push-subscriptions/remove-endpoint/", { endpoint: subscription.endpoint });
  }
}

export async function getWebPushStatus(): Promise<WebPushStatus> {
  if (!webPushSupported()) return "unsupported" as const;
  if (!window.isSecureContext) return "insecure" as const;
  const pushConfig = await config();
  if (!pushConfig.enabled) return "server-disabled" as const;
  if (Notification.permission === "denied") return "blocked" as const;
  const subscription = await currentSubscription();
  return subscription ? "enabled" as const : "available" as const;
}
