import { apiFetchBlob } from "../api/client";

const cacheName = (userId: string) => `proactif-field-private-${userId}`;
const cacheKey = (userId: string, kind: "plans" | "photos", id: string) => new Request(`${location.origin}/__offline/${encodeURIComponent(userId)}/${kind}/${id}`);

export async function cacheProtectedFile(userId: string, kind: "plans" | "photos", id: string): Promise<Blob> {
  const cache = await caches.open(cacheName(userId));
  const key = cacheKey(userId, kind, id);
  const existing = await cache.match(key);
  if (existing) return existing.blob();
  const blob = await apiFetchBlob(`/api/files/${kind}/${id}`);
  await cache.put(key, new Response(blob, { headers: { "Content-Type": blob.type || "application/octet-stream" } }));
  return blob;
}

export async function getCachedFile(userId: string, kind: "plans" | "photos", id: string): Promise<Blob | null> {
  const response = await (await caches.open(cacheName(userId))).match(cacheKey(userId, kind, id));
  return response ? response.blob() : null;
}

export async function cacheLocalFile(userId: string, kind: "plans" | "photos", id: string, blob: Blob): Promise<void> {
  await (await caches.open(cacheName(userId))).put(cacheKey(userId, kind, id), new Response(blob, { headers: { "Content-Type": blob.type || "application/octet-stream" } }));
}

export async function deleteCachedChantierFiles(userId: string, planIds: string[], photoIds: string[]): Promise<void> {
  const cache = await caches.open(cacheName(userId));
  await Promise.all([...planIds.map((id) => cache.delete(cacheKey(userId, "plans", id))), ...photoIds.map((id) => cache.delete(cacheKey(userId, "photos", id)))]);
}

export async function clearPrivateCache(userId: string): Promise<void> { await caches.delete(cacheName(userId)); }
