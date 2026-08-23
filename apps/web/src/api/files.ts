import { useCallback, useEffect, useState } from "react";
import { apiFetchBlob } from "./client";
import { useAuthStore } from "../auth/store";
import { cacheProtectedFile, getCachedFile } from "../offline/cache";

type FileKind = "plans" | "photos" | "reports";

const blobUrlCache = new Map<string, Promise<string>>();

export function getFileObjectUrl(kind: FileKind, id: string): Promise<string> {
  const key = `${kind}/${id}`;
  let cached = blobUrlCache.get(key);
  if (!cached) {
    cached = (async () => {
      const userId = useAuthStore.getState().user?.id;
      if (userId && (kind === "plans" || kind === "photos")) {
        const local = await getCachedFile(userId, kind, id);
        if (local) return URL.createObjectURL(local);
        if (!navigator.onLine) throw new Error("Fichier non disponible hors ligne");
        return URL.createObjectURL(await cacheProtectedFile(userId, kind, id));
      }
      return URL.createObjectURL(await apiFetchBlob(`/api/files/${key}`));
    })();
    cached.catch(() => blobUrlCache.delete(key));
    blobUrlCache.set(key, cached);
  }
  return cached;
}

export interface FileObjectUrlState {
  url: string | null;
  error: boolean;
  retry: () => void;
}

export function useFileObjectUrl(kind: FileKind, id: string | null | undefined): FileObjectUrlState {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) {
      setUrl(null);
      setError(false);
      return;
    }
    let cancelled = false;
    setError(false);
    getFileObjectUrl(kind, id).then(
      (resolved) => {
        if (!cancelled) setUrl(resolved);
      },
      () => {
        if (!cancelled) setError(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [kind, id, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { url, error, retry };
}
