/**
 * India Post PIN code lookup service.
 * Primary: https://api.postalpincode.in/pincode/{pincode}
 * Fallback: https://api.zippopotam.us/in/{pincode}
 * No API key required. In-memory LRU cache with 24h TTL.
 *
 * NOTE: The primary API (api.postalpincode.in) has an expired SSL certificate
 * as of May 2026. We use a custom HTTPS agent that skips cert validation
 * ONLY for this specific free public API (no sensitive data exchanged).
 */
import https from "node:https";

// Custom agent that skips SSL cert validation — ONLY for India Post API
// Their SSL cert expired and they haven't renewed it.
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

interface PostOffice {
  Name: string;
  BranchType: string;
  DeliveryStatus: string;
  Circle: string;
  District: string;
  Division: string;
  Region: string;
  Block: string;
  State: string;
  Country: string;
  Pincode: string;
}

interface IndiaPostResponse {
  Message: string;
  Status: "Success" | "Error" | "404";
  PostOffice: PostOffice[] | null;
}

interface ZippopotamPlace {
  "place name": string;
  longitude: string;
  state: string;
  "state abbreviation": string;
  latitude: string;
}

interface ZippopotamResponse {
  "post code": string;
  country: string;
  "country abbreviation": string;
  places: ZippopotamPlace[];
}

export interface PincodeLookupResult {
  valid: boolean;
  pincode: string;
  state: string;
  district: string;
  region: string;
  block: string;
  country: string;
  postOffices: { name: string; branchType: string; deliveryStatus: string }[];
}

// Simple LRU cache (Map preserves insertion order)
const cache = new Map<string, { data: PincodeLookupResult; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 2000;

// Rate limit: max 2 requests/sec
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 500;

const USER_AGENT = "VendorCenter/1.1.3 (https://vendorcenter.in)";

function cleanCache() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt < now) {
      cache.delete(key);
    }
  }
  // Evict oldest if over size
  while (cache.size > MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

/**
 * Check if an error is a network-level error (worth retrying).
 */
function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

/**
 * Attempt primary API fetch with User-Agent header.
 * Uses node:https directly to support custom agent (SSL cert skip for expired cert).
 * Returns the PincodeLookupResult on success, or throws on failure.
 */
async function fetchFromPrimary(pincode: string): Promise<PincodeLookupResult> {
  const data = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Primary API timeout (8s)"));
    }, 8000);

    const req = https.get(
      `https://api.postalpincode.in/pincode/${pincode}`,
      { agent: insecureAgent, headers: { "User-Agent": USER_AGENT } },
      (res) => {
        if (res.statusCode && res.statusCode !== 200) {
          clearTimeout(timeout);
          reject(new Error(`Primary API returned HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => { clearTimeout(timeout); resolve(body); });
        res.on("error", (err) => { clearTimeout(timeout); reject(err); });
      }
    );
    req.on("error", (err) => { clearTimeout(timeout); reject(err); });
  });

  const parsed: IndiaPostResponse[] = JSON.parse(data);
  const result = parsed[0];

  if (!result || result.Status !== "Success" || !result.PostOffice?.length) {
    // Valid response but pincode not found — return not-found result (cacheable)
    return { valid: false, pincode, state: "", district: "", region: "", block: "", country: "", postOffices: [] };
  }

  const firstPO = result.PostOffice[0];
  return {
    valid: true,
    pincode,
    state: firstPO.State,
    district: firstPO.District,
    region: firstPO.Region,
    block: firstPO.Block,
    country: firstPO.Country,
    postOffices: result.PostOffice.map((po) => ({
      name: po.Name,
      branchType: po.BranchType,
      deliveryStatus: po.DeliveryStatus,
    })),
  };
}

/**
 * Fallback API: Zippopotam.us
 * Maps response to PincodeLookupResult with reduced data.
 */
async function fetchFromFallback(pincode: string): Promise<PincodeLookupResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  const response = await fetch(`https://api.zippopotam.us/in/${pincode}`, {
    signal: controller.signal,
    headers: { "User-Agent": USER_AGENT },
  });
  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`Fallback API returned HTTP ${response.status}`);
  }

  const data: ZippopotamResponse = await response.json();

  if (!data.places || data.places.length === 0) {
    return { valid: false, pincode, state: "", district: "", region: "", block: "", country: "", postOffices: [] };
  }

  const firstPlace = data.places[0];
  return {
    valid: true,
    pincode,
    state: firstPlace.state,
    district: firstPlace["place name"],
    region: "",
    block: "",
    country: data.country,
    postOffices: data.places.map((place) => ({
      name: place["place name"],
      branchType: "Unknown",
      deliveryStatus: "Unknown",
    })),
  };
}

export async function lookupPincode(pincode: string): Promise<PincodeLookupResult> {
  // Validate format
  if (!/^\d{6}$/.test(pincode)) {
    return { valid: false, pincode, state: "", district: "", region: "", block: "", country: "", postOffices: [] };
  }

  // Check cache
  const cached = cache.get(pincode);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Rate limit
  const now = Date.now();
  const waitMs = MIN_REQUEST_INTERVAL_MS - (now - lastRequestTime);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastRequestTime = Date.now();

  // Try primary API (with 1 retry on network errors)
  let primaryErr: Error | null = null;
  try {
    const result = await fetchFromPrimary(pincode);
    // Cache result (shorter TTL for not-found)
    const ttl = result.valid ? CACHE_TTL_MS : 60 * 60 * 1000;
    cache.set(pincode, { data: result, expiresAt: Date.now() + ttl });
    cleanCache();
    return result;
  } catch (err) {
    primaryErr = err as Error;
    // Retry once on network errors only (TypeError/AbortError)
    if (isNetworkError(err)) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        const result = await fetchFromPrimary(pincode);
        const ttl = result.valid ? CACHE_TTL_MS : 60 * 60 * 1000;
        cache.set(pincode, { data: result, expiresAt: Date.now() + ttl });
        cleanCache();
        return result;
      } catch (retryErr) {
        primaryErr = retryErr as Error;
      }
    }
  }

  // Primary failed — try Zippopotam fallback
  try {
    const result = await fetchFromFallback(pincode);
    // Cache fallback results with same TTL strategy
    const ttl = result.valid ? CACHE_TTL_MS : 60 * 60 * 1000;
    cache.set(pincode, { data: result, expiresAt: Date.now() + ttl });
    cleanCache();
    return result;
  } catch (fallbackErr) {
    // Both APIs failed — log and return invalid without caching
    console.warn(`[india-post] Both APIs failed for ${pincode}: primary=${primaryErr?.message}, fallback=${(fallbackErr as Error).message}`);
    return { valid: false, pincode, state: "", district: "", region: "", block: "", country: "", postOffices: [] };
  }
}

/**
 * Bulk lookup multiple pincodes. Respects rate limiting.
 */
export async function bulkLookupPincodes(pincodes: string[]): Promise<PincodeLookupResult[]> {
  const results: PincodeLookupResult[] = [];
  for (const pin of pincodes) {
    results.push(await lookupPincode(pin));
  }
  return results;
}
