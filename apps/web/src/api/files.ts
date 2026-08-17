import { useEffect, useState } from "react";
import { apiFetchBlob } from "./client";

type FileKind = "plans" | "photos" | "reports";

const blobUrlCache = new Map<string, Promise<string>>();

export function getFileObjectUrl(kind: FileKind, id: string): Promise<string> {
  const key = `${kind}/${id}`;
  let cached = blobUrlCache.get(key);
  if (!cached) {
    cached = apiFetchBlob(`/api/files/${key}`).then((blob) => URL.createObjectURL(blob));
    blobUrlCache.set(key, cached);
  }
  return cached;
}

export function useFileObjectUrl(kind: FileKind, id: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    getFileObjectUrl(kind, id).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  return url;
}
