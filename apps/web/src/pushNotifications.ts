import { apiGet, apiPostJson } from "./api/client";

function decodeVapidKey(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0))).buffer as ArrayBuffer;
}

export function pushSupported(): boolean { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }

export async function enablePushNotifications(): Promise<"enabled" | "unavailable" | "denied"> {
  if (!pushSupported()) return "unavailable";
  const config = await apiGet<{ enabled: boolean; publicKey: string | null }>("/api/push/config");
  if (!config.enabled || !config.publicKey) return "unavailable";
  if (await Notification.requestPermission() !== "granted") return "denied";
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidKey(config.publicKey) });
  await apiPostJson("/api/push/subscriptions", subscription.toJSON());
  return "enabled";
}

export async function pushIsEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  return Boolean(await (await navigator.serviceWorker.ready).pushManager.getSubscription());
}
