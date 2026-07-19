import { api } from "./api";

type WebPushConfig = { enabled: boolean; public_key: string };

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

export function webPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

async function config() {
  return (await api.get<WebPushConfig>("/web-push/config/")).data;
}

async function saveSubscription(subscription: PushSubscription) {
  await api.post("/push-subscriptions/", subscription.toJSON());
}

export async function enableWebPush() {
  if (!webPushSupported()) throw new Error("This browser does not support Web Push.");
  const pushConfig = await config();
  if (!pushConfig.enabled || !pushConfig.public_key) {
    throw new Error("Web Push has not been configured on the server.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const registration = await navigator.serviceWorker.register("/sw.js");
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(pushConfig.public_key),
  });
  await saveSubscription(subscription);
  return subscription;
}

export async function registerExistingPushSubscription() {
  if (!webPushSupported() || Notification.permission !== "granted") return false;
  const registration = await navigator.serviceWorker.register("/sw.js");
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;
  await saveSubscription(subscription);
  return true;
}

export async function disableWebPush() {
  if (!webPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await api.post("/push-subscriptions/remove-endpoint/", { endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}

export async function detachWebPushFromCurrentUser() {
  if (!webPushSupported() || Notification.permission !== "granted") return;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await api.post("/push-subscriptions/remove-endpoint/", { endpoint: subscription.endpoint });
  }
}

export async function getWebPushStatus() {
  if (!webPushSupported()) return "unsupported" as const;
  const pushConfig = await config();
  if (!pushConfig.enabled) return "server-disabled" as const;
  if (Notification.permission === "denied") return "blocked" as const;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "enabled" as const : "available" as const;
}
