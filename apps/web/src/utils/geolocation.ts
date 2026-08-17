export interface GpsPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

export function getCurrentPositionSafe(timeoutMs = 8000): Promise<GpsPosition | null> {
  const geoPromise = new Promise<GpsPosition | null>((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });

  // Belt-and-suspenders: some mobile browsers don't reliably honor the
  // PositionOptions timeout (e.g. when the tab is backgrounded), which left
  // photo capture stuck forever waiting on GPS. This guarantees we always
  // move on.
  const safetyTimeout = new Promise<GpsPosition | null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs + 1500);
  });

  return Promise.race([geoPromise, safetyTimeout]);
}
