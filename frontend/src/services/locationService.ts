export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export type LocationError =
  | "PERMISSION_DENIED"
  | "POSITION_UNAVAILABLE"
  | "TIMEOUT"
  | "NOT_SUPPORTED";

const LOCATION_CACHE_KEY = "vc_last_location";
const CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

/** Try to return cached location if fresh enough */
function getCachedLocation(maxAgeMs = CACHE_MAX_AGE_MS): UserLocation | null {
  try {
    const raw = localStorage.getItem(LOCATION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserLocation & { ts: number };
    if (Date.now() - parsed.ts > maxAgeMs) return null;
    return { latitude: parsed.latitude, longitude: parsed.longitude, accuracy: parsed.accuracy };
  } catch {
    return null;
  }
}

function cacheLocation(loc: UserLocation) {
  localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ ...loc, ts: Date.now() }));
}

/**
 * Get the user's current location via the browser Geolocation API.
 * Returns cached location if available and fresh.
 * Falls back cleanly with typed error codes.
 */
export function getUserLocation(options?: { timeout?: number; maximumAge?: number }): Promise<UserLocation> {
  const cached = getCachedLocation();
  if (cached) return Promise.resolve(cached);

  const toLocationError = (error: GeolocationPositionError): { code: LocationError; message: string } => {
    const codeMap: Record<number, LocationError> = {
      1: "PERMISSION_DENIED",
      2: "POSITION_UNAVAILABLE",
      3: "TIMEOUT",
    };
    return {
      code: codeMap[error.code] ?? "POSITION_UNAVAILABLE",
      message: error.message,
    };
  };

  const requestPosition = (enableHighAccuracy: boolean, timeoutMs: number, maximumAgeMs: number): Promise<UserLocation> =>
    new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc: UserLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          cacheLocation(loc);
          resolve(loc);
        },
        (error) => {
          reject(toLocationError(error));
        },
        {
          enableHighAccuracy,
          timeout: timeoutMs,
          maximumAge: maximumAgeMs,
        }
      );
    });

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({ code: "NOT_SUPPORTED", message: "Geolocation is not supported by this browser" });
      return;
    }

    const primaryTimeout = options?.timeout ?? 10000;
    const primaryMaxAge = options?.maximumAge ?? 60000;

    requestPosition(true, primaryTimeout, primaryMaxAge)
      .then(resolve)
      .catch((primaryErr: { code: LocationError; message: string }) => {
        if (primaryErr.code === "PERMISSION_DENIED") {
          reject(primaryErr);
          return;
        }

        // Mobile fallback: relaxed settings often work better indoors/low signal.
        requestPosition(false, Math.max(15000, primaryTimeout), Math.max(300000, primaryMaxAge))
          .then(resolve)
          .catch((fallbackErr: { code: LocationError; message: string }) => {
            // Last known location fallback so UI still has a usable location.
            const stale = getCachedLocation(7 * 24 * 60 * 60 * 1000);
            if (stale) {
              resolve(stale);
              return;
            }
            reject(fallbackErr);
          });
      });
  });
}

/**
 * Reverse geocode lat/lng to a human-readable address using Nominatim (free, no key).
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en", "User-Agent": "VendorCenter/1.0" },
  });
  if (!res.ok) throw new Error("Geocoding failed");
  const data = await res.json();
  return data.display_name ?? "Unknown location";
}

/**
 * Forward geocode an address string to lat/lng using Nominatim (free, no key).
 */
export async function forwardGeocode(query: string): Promise<{ lat: number; lng: number; display: string }[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en", "User-Agent": "VendorCenter/1.0" },
  });
  if (!res.ok) throw new Error("Geocoding failed");
  const data = await res.json();
  return data.map((item: any) => ({
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    display: item.display_name,
  }));
}

/**
 * Check whether a point is inside a polygon (ray-casting algorithm).
 * Used for zone containment checks.
 */
export function isPointInPolygon(
  point: [number, number],
  polygon: [number, number][]
): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
