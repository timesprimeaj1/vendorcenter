import type { AssistantDecision, AssistantResponse, VendorResult } from "./ai-assistant.types.js";
import {
  searchVendorsByCategory,
  searchVendorsByKeyword,
  getTopRatedVendors,
  getVendorServicePriceRange,
  getCustomerProfileForAI,
  getCustomerBookingsForAI,
} from "./ai-assistant.repository.js";
import {
  isAssistantAvailable,
  callAssistantModel,
  getConversationHistory,
  addToConversation,
} from "./provider-chain.service.js";
import { randomUUID } from "crypto";

// ═══════════════════════════════════════════════════════════════
// LLM-Powered AI Assistant Service
// Architecture: Gemini function-calling → tool dispatch → response
// Every message hits Gemini API — no static/rule-based responses
// ═══════════════════════════════════════════════════════════════

const CATEGORY_MAP: Record<string, string> = {
  plumber: "Plumbing",
  plumbing: "Plumbing",
  pipe: "Plumbing",
  leak: "Plumbing",
  tap: "Plumbing",
  faucet: "Plumbing",
  drain: "Plumbing",
  electrician: "Electrical",
  electrical: "Electrical",
  wiring: "Electrical",
  switch: "Electrical",
  fan: "Electrical",
  light: "Electrical",
  ac: "AC Repair",
  "ac repair": "AC Repair",
  "air conditioner": "AC Repair",
  "air conditioning": "AC Repair",
  cooling: "AC Repair",
  hvac: "AC Repair",
  clean: "Cleaning",
  cleaning: "Cleaning",
  cleaner: "Cleaning",
  maid: "Cleaning",
  housekeeping: "Cleaning",
  paint: "Painting",
  painting: "Painting",
  painter: "Painting",
  wall: "Painting",
  carpenter: "Carpentry",
  carpentry: "Carpentry",
  furniture: "Carpentry",
  wood: "Carpentry",
  pest: "Pest Control",
  termite: "Pest Control",
  cockroach: "Pest Control",
  salon: "Salon",
  haircut: "Salon",
  beauty: "Salon",
  spa: "Salon",
  grooming: "Salon",
  appliance: "Appliance Repair",
  fridge: "Appliance Repair",
  washing: "Appliance Repair",
  microwave: "Appliance Repair",
  moving: "Moving",
  packers: "Moving",
  movers: "Moving",
  relocation: "Moving",
  shifting: "Moving",
  photography: "Photography",
  photographer: "Photography",
  photo: "Photography",
  catering: "Catering",
  caterer: "Catering",
  food: "Catering",
  cook: "Catering",
};

function normalizeCategory(value: string): string | null {
  const lower = value.toLowerCase().trim();
  if (!lower) return null;

  const directMatch = Object.values(CATEGORY_MAP).find((category) => category.toLowerCase() === lower);
  if (directMatch) return directMatch;

  const sortedKeys = Object.keys(CATEGORY_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lower.includes(key)) {
      return CATEGORY_MAP[key];
    }
  }

  return null;
}

function needsLocation(decision: AssistantDecision, originalMessage: string): boolean {
  return decision.action === "ASK_LOCATION"
    || /near me|nearby|closest|around me|my area/i.test(originalMessage)
    || /near|location/i.test(decision.location)
    || /near|location/i.test(decision.message);
}

function inferServiceFromHistory(history: Array<{ role: "user" | "model"; parts: { text: string }[] }>): string {
  const recentUserMessages = history
    .filter((turn) => turn.role === "user")
    .slice(-6)
    .map((turn) => turn.parts.map((part) => part.text).join(" "));

  for (let index = recentUserMessages.length - 1; index >= 0; index--) {
    const inferred = normalizeCategory(recentUserMessages[index]);
    if (inferred) {
      return inferred;
    }
  }

  return "";
}

function isFollowUpRequest(message: string): boolean {
  return /\b(show|again|more|continue|go ahead|proceed|next)\b/i.test(message.trim());
}

function maskEmail(email?: string | null): string {
  if (!email || !email.includes("@")) return "";
  const [name, domain] = email.split("@");
  if (!name || !domain) return "";
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

function maskPhone(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "";
  return `***${digits.slice(-4)}`;
}

async function buildAuthenticatedUserContext(userId: string): Promise<string[]> {
  const contextParts: string[] = [`[Auth: logged_in]`, `[User ID: ${userId}]`];

  try {
    const [profile, bookings] = await Promise.all([
      getCustomerProfileForAI(userId),
      getCustomerBookingsForAI(userId, 3),
    ]);

    if (profile) {
      const safeProfile = {
        name: profile.name || "",
        email: maskEmail(profile.email),
        phone: maskPhone(profile.phone),
      };
      contextParts.push(`[User Profile: ${JSON.stringify(safeProfile)}]`);
    }

    if (Array.isArray(bookings) && bookings.length > 0) {
      const bookingSummary = bookings.map((b) => ({
        service: b.serviceName,
        vendor: b.vendorName,
        status: b.status,
        scheduledDate: b.scheduledDate,
        scheduledTime: b.scheduledTime,
      }));
      contextParts.push(`[Recent Bookings: ${JSON.stringify(bookingSummary)}]`);
    }
  } catch (error) {
    console.warn("[ai-assistant] Failed to fetch user context:", error);
  }

  return contextParts;
}

async function searchForVendors(
  decision: AssistantDecision,
  originalMessage: string,
  history: Array<{ role: "user" | "model"; parts: { text: string }[] }>,
  lat?: number,
  lng?: number,
): Promise<VendorResult[]> {
  const normalizedCategory = normalizeCategory(decision.service || originalMessage) || inferServiceFromHistory(history);

  if (decision.action === "GET_RECOMMENDATIONS") {
    if (normalizedCategory) {
      const rows = await searchVendorsByCategory(normalizedCategory, lat, lng, 50, 5);
      return Promise.all(rows.map(formatVendor));
    }

    const topRated = await getTopRatedVendors(lat, lng, 50, 5);
    return Promise.all(topRated.map(formatVendor));
  }

  if (normalizedCategory) {
    const rows = await searchVendorsByCategory(normalizedCategory, lat, lng, 50, 5);
    return Promise.all(rows.map(formatVendor));
  }

  const keyword = (decision.service || originalMessage).trim();
  if (!keyword) return [];

  const rows = await searchVendorsByKeyword(keyword, lat, lng, 50, 5);
  return Promise.all(rows.map(formatVendor));
}

async function resolveDecision(
  decision: AssistantDecision,
  originalMessage: string,
  history: Array<{ role: "user" | "model"; parts: { text: string }[] }>,
  lat?: number,
  lng?: number,
): Promise<AssistantResponse> {
  const inferredService = normalizeCategory(decision.service || originalMessage) || inferServiceFromHistory(history);
  const effectiveService = decision.service || inferredService;
  const effectiveAction =
    decision.action === "ASK_DETAILS" && !decision.service && isFollowUpRequest(originalMessage) && inferredService
      ? "SHOW_RESULTS"
      : decision.action;

  if (decision.mode === "CHAT") {
    return {
      intent: decision.intent,
      message: decision.message,
      vendors: [],
      action: "NONE",
      service: effectiveService,
      location: decision.location,
      confidence: decision.confidence,
      mode: decision.mode,
      provider: decision.provider,
    };
  }

  if ((needsLocation(decision, originalMessage) || (effectiveAction === "SHOW_RESULTS" && lat == null && lng == null)) && (lat == null || lng == null)) {
    return {
      intent: decision.intent,
      message: effectiveService
        ? `Please share your location so I can show nearby ${effectiveService.toLowerCase()} vendors.`
        : decision.message,
      vendors: [],
      action: "ASK_LOCATION",
      service: effectiveService,
      location: decision.location,
      confidence: decision.confidence,
      mode: decision.mode,
      provider: decision.provider,
    };
  }

  if (!["SHOW_RESULTS", "GET_RECOMMENDATIONS", "BOOK_SERVICE"].includes(effectiveAction)) {
    return {
      intent: decision.intent,
      message: decision.message,
      vendors: [],
      action: effectiveAction,
      service: effectiveService,
      location: decision.location,
      confidence: decision.confidence,
      mode: decision.mode,
      provider: decision.provider,
    };
  }

  const effectiveDecision: AssistantDecision = {
    ...decision,
    action: effectiveAction,
    service: effectiveService,
  };

  const vendors = await searchForVendors(effectiveDecision, originalMessage, history, lat, lng);

  if (vendors.length === 0) {
    const inferred = normalizeCategory(decision.service || originalMessage) || inferServiceFromHistory(history);
    const fallbackMessage = inferred
      ? `I couldn't find available ${inferred.toLowerCase()} vendors right now. Try another nearby area or a related service.`
      : "I couldn't find matching vendors yet. Tell me the exact service you need and I'll search again.";

    return {
      intent: decision.intent,
      message: fallbackMessage,
      vendors: [],
      action: "NONE",
      service: effectiveService || inferred,
      location: decision.location,
      confidence: decision.confidence,
      mode: decision.mode,
      provider: decision.provider,
    };
  }

  return {
    intent: decision.intent,
    message: decision.message,
    vendors,
    action: effectiveAction,
    service: effectiveService,
    location: decision.location,
    confidence: decision.confidence,
    mode: decision.mode,
    provider: decision.provider,
  };
}

// ─── LLM-Powered Query Processing ───────────────────────────

export async function processAssistantQuery(
  message: string,
  lat?: number,
  lng?: number,
  conversationId?: string,
  userId?: string,
): Promise<AssistantResponse & { conversationId: string }> {
  const sessionId = conversationId || randomUUID();

  console.log(`[ai-assistant] Query: "${message.substring(0, 100)}" | ai=${isAssistantAvailable()}`);

  if (!isAssistantAvailable()) {
    return {
      intent: "UNKNOWN",
      message: "AI assistant is temporarily unavailable. Please try again later.",
      vendors: [],
      action: "NONE",
      conversationId: sessionId,
      mode: "CHAT",
    };
  }

  try {
    const history = getConversationHistory(sessionId);
    const contextParts: string[] = userId
      ? await buildAuthenticatedUserContext(userId)
      : ["[Auth: guest]"];

    if (lat != null && lng != null) {
      contextParts.push(`[User location: ${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
    }

    const enrichedMessage = contextParts.length > 0 ? `${contextParts.join(" ")} ${message}` : message;
    const decision = await callAssistantModel(enrichedMessage, history);
    const resolved = await resolveDecision(decision, message, history, lat, lng);

    addToConversation(sessionId, { role: "user", parts: [{ text: message }] });
    addToConversation(sessionId, { role: "model", parts: [{ text: resolved.message }] });

    return {
      ...resolved,
      conversationId: sessionId,
    };
  } catch (error) {
    console.error("[ai-assistant] Provider chain failed:", error);
    return {
      intent: "UNKNOWN",
      message: "Sorry, something went wrong. Please try again in a moment.",
      vendors: [],
      action: "NONE",
      conversationId: sessionId,
      mode: "CHAT",
    };
  }
}

async function formatVendor(row: any): Promise<VendorResult> {
  const priceRange = await getVendorServicePriceRange(row.vendorId);
  return {
    name: row.businessName,
    vendorId: row.vendorId,
    rating: row.rating > 0 ? `${Number(row.rating).toFixed(1)} / 5 (${row.reviews} reviews)` : "New vendor",
    distance: row.distance_km != null ? `${row.distance_km} km away` : "Distance unavailable",
    price_range: priceRange,
    availability: row.workingHours || "Contact vendor",
    categories: Array.isArray(row.serviceCategories) ? row.serviceCategories : [],
    completedBookings: row.completedBookings ?? 0,
    rankScore: row.rankScore ?? 0,
  };
}
