import { ReverseGeocodeResult } from "@proactif-field/shared";

// Abstraction boundary for turning GPS coordinates into a human-readable
// place label (RapportTerrain.lieu). No provider is wired up: doing so
// needs a deliberate choice (not made silently by this change) between,
// e.g.:
//   - a keyed API (Google Geocoding, Mapbox, HERE, ...) — needs an account,
//     a billing setup and an API key read from config/env.ts;
//   - Nominatim/OpenStreetMap — free but rate-limited and bound by its
//     usage policy (https://operations.osmfoundation.org/policies/nominatim/),
//     not meant for unthrottled server-side use without self-hosting it.
// Implement the call here and read its key from env when a provider is
// chosen. Until then this always resolves to null, by design: nothing in
// the field-report flow depends on it succeeding — GPS coordinates are
// captured and stored regardless, and `lieu` simply stays empty (the
// technician can still type it by hand).
export async function reverseGeocode(_lat: number, _lng: number): Promise<ReverseGeocodeResult | null> {
  return null;
}
