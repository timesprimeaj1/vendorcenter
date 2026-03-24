import type { AssistantDecision, AssistantResponse, VendorResult } from "./ai-assistant.types.js";
import {
  searchVendorsByCategory,
  searchVendorsByKeyword,
  getTopRatedVendors,
  getVendorServicePriceRange,
  getCustomerProfileForAI,
  getCustomerBookingsForAI,
  getServiceCategories,
  getPlatformStats,
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
  // Plumbing
  plumber: "Plumbing",
  plumbing: "Plumbing",
  pipe: "Plumbing",
  leak: "Plumbing",
  tap: "Plumbing",
  faucet: "Plumbing",
  drain: "Plumbing",
  toilet: "Plumbing",
  bathroom: "Plumbing",
  water: "Plumbing",
  // Electrical
  electrician: "Electrical",
  electrical: "Electrical",
  wiring: "Electrical",
  switch: "Electrical",
  fan: "Electrical",
  light: "Electrical",
  inverter: "Electrical",
  mcb: "Electrical",
  // AC Repair
  ac: "AC Repair",
  "ac repair": "AC Repair",
  "air conditioner": "AC Repair",
  "air conditioning": "AC Repair",
  cooling: "AC Repair",
  hvac: "AC Repair",
  "ac service": "AC Repair",
  "ac installation": "AC Repair",
  // Cleaning
  clean: "Cleaning",
  cleaning: "Cleaning",
  cleaner: "Cleaning",
  maid: "Cleaning",
  housekeeping: "Cleaning",
  "deep cleaning": "Cleaning",
  "home cleaning": "Cleaning",
  sanitization: "Cleaning",
  // Painting
  paint: "Painting",
  painting: "Painting",
  painter: "Painting",
  wall: "Painting",
  whitewash: "Painting",
  // Carpentry
  carpenter: "Carpentry",
  carpentry: "Carpentry",
  furniture: "Carpentry",
  wood: "Carpentry",
  cupboard: "Carpentry",
  wardrobe: "Carpentry",
  door: "Carpentry",
  // Pest Control
  pest: "Pest Control",
  termite: "Pest Control",
  cockroach: "Pest Control",
  "pest control": "Pest Control",
  rats: "Pest Control",
  mosquito: "Pest Control",
  bedbugs: "Pest Control",
  // Salon
  salon: "Salon",
  haircut: "Salon",
  beauty: "Salon",
  spa: "Salon",
  grooming: "Salon",
  facial: "Salon",
  makeup: "Salon",
  bridal: "Salon",
  mehndi: "Salon",
  // Appliance Repair
  appliance: "Appliance Repair",
  fridge: "Appliance Repair",
  washing: "Appliance Repair",
  microwave: "Appliance Repair",
  "washing machine": "Appliance Repair",
  refrigerator: "Appliance Repair",
  geyser: "Appliance Repair",
  // Moving
  moving: "Moving",
  packers: "Moving",
  movers: "Moving",
  relocation: "Moving",
  shifting: "Moving",
  "packers and movers": "Moving",
  transport: "Moving",
  // Photography
  photography: "Photography",
  photographer: "Photography",
  photo: "Photography",
  "photo shoot": "Photography",
  videography: "Photography",
  // Catering
  catering: "Catering",
  caterer: "Catering",
  food: "Catering",
  cook: "Catering",
  chef: "Catering",
  tiffin: "Catering",
  // Mobile / Electronics
  mobile: "Mobile Repair",
  "mobile repair": "Mobile Repair",
  phone: "Mobile Repair",
  "phone repair": "Mobile Repair",
  "screen repair": "Mobile Repair",
  laptop: "Computer Repair",
  computer: "Computer Repair",
  "laptop repair": "Computer Repair",
  printer: "Computer Repair",
  // Tutoring / Education
  tutor: "Tutoring",
  tutoring: "Tutoring",
  tuition: "Tutoring",
  teacher: "Tutoring",
  coaching: "Tutoring",
  // Fitness
  fitness: "Fitness",
  "personal trainer": "Fitness",
  yoga: "Fitness",
  gym: "Fitness",
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
      getCustomerBookingsForAI(userId, 5),
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
        paymentStatus: b.paymentStatus,
        scheduledDate: b.scheduledDate,
        scheduledTime: b.scheduledTime,
        amount: b.finalAmount ? `₹${b.finalAmount}` : null,
        createdAt: b.createdAt,
      }));
      contextParts.push(`[Recent Bookings: ${JSON.stringify(bookingSummary)}]`);
    } else {
      contextParts.push(`[Recent Bookings: none]`);
    }
  } catch (error) {
    console.warn("[ai-assistant] Failed to fetch user context:", error);
  }

  return contextParts;
}

// Platform-level context: available services + stats (cached 5 min)
let platformContextCache: { data: string[]; expires: number } | null = null;

async function buildPlatformContext(lat?: number, lng?: number): Promise<string[]> {
  const now = Date.now();
  if (platformContextCache && platformContextCache.expires > now) {
    return platformContextCache.data;
  }

  const parts: string[] = [];
  try {
    const [categories, stats] = await Promise.all([
      getServiceCategories(lat, lng, 50),
      getPlatformStats(),
    ]);

    if (Array.isArray(categories) && categories.length > 0) {
      const catSummary = categories.map((c: any) => `${c.cat} (${c.vendor_count} vendors)`).join(", ");
      parts.push(`[Available Services: ${catSummary}]`);
    }

    if (stats) {
      parts.push(`[Platform Stats: ${stats.activeVendors} active vendors, ${stats.completedBookings} completed bookings, ${stats.serviceCategories} service categories]`);
    }

    platformContextCache = { data: parts, expires: now + 5 * 60 * 1000 };
  } catch (error) {
    console.warn("[ai-assistant] Failed to fetch platform context:", error);
  }

  return parts;
}

async function searchForVendors(
  decision: AssistantDecision,
  originalMessage: string,
  history: Array<{ role: "user" | "model"; parts: { text: string }[] }>,
  lat?: number,
  lng?: number,
): Promise<VendorResult[]> {
  // Only use history inference for explicit follow-ups — never contaminate new queries
  const normalizedCategory = normalizeCategory(decision.service || originalMessage)
    || (isFollowUpRequest(originalMessage) ? inferServiceFromHistory(history) : "");

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
  // Only infer from history for explicit follow-up requests, not new queries
  const isFollowUp = isFollowUpRequest(originalMessage);
  const currentService = normalizeCategory(decision.service || originalMessage);
  const effectiveService = decision.service || currentService || (isFollowUp ? inferServiceFromHistory(history) : "");
  const effectiveAction =
    decision.action === "ASK_DETAILS" && !decision.service && isFollowUp && effectiveService
      ? "SHOW_RESULTS"
      : decision.action;

  // CHAT MODE — direct response
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
      navigateTo: decision.navigateTo || "",
    };
  }

  // MY_BOOKINGS — return AI-generated booking summary directly
  if (decision.intent === "MY_BOOKINGS" || decision.action === "SHOW_MY_BOOKINGS") {
    return {
      intent: "MY_BOOKINGS",
      message: decision.message,
      vendors: [],
      action: "SHOW_MY_BOOKINGS",
      service: effectiveService,
      location: decision.location,
      confidence: decision.confidence,
      mode: decision.mode,
      provider: decision.provider,
      navigateTo: decision.navigateTo || "",
    };
  }

  // AVAILABLE_SERVICES — return AI-generated service list
  if (decision.intent === "AVAILABLE_SERVICES" || decision.action === "SHOW_CATEGORIES") {
    return {
      intent: "AVAILABLE_SERVICES",
      message: decision.message,
      vendors: [],
      action: "SHOW_CATEGORIES",
      service: "",
      location: decision.location,
      confidence: decision.confidence,
      mode: decision.mode,
      provider: decision.provider,
      navigateTo: decision.navigateTo || "",
    };
  }

  // FAQ — return AI answer directly
  if (decision.intent === "FAQ") {
    return {
      intent: "FAQ",
      message: decision.message,
      vendors: [],
      action: decision.action === "NAVIGATE" ? "NAVIGATE" : "NONE",
      service: effectiveService,
      location: decision.location,
      confidence: decision.confidence,
      mode: decision.mode,
      provider: decision.provider,
      navigateTo: decision.navigateTo || "",
    };
  }

  // UNKNOWN / redirects
  if (decision.intent === "UNKNOWN") {
    return {
      intent: "UNKNOWN",
      message: decision.message,
      vendors: [],
      action: decision.action === "NAVIGATE" ? "NAVIGATE" : "NONE",
      service: "",
      location: decision.location,
      confidence: decision.confidence,
      mode: decision.mode,
      provider: decision.provider,
      navigateTo: decision.navigateTo || "",
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
      navigateTo: "",
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
      navigateTo: decision.navigateTo || "",
    };
  }

  const effectiveDecision: AssistantDecision = {
    ...decision,
    action: effectiveAction,
    service: effectiveService,
  };

  const vendors = await searchForVendors(effectiveDecision, originalMessage, history, lat, lng);

  if (vendors.length === 0) {
    // Use the current query's service, NOT stale history
    const serviceName = currentService || decision.service || "";
    const fallbackMessage = serviceName
      ? `I couldn't find ${serviceName.toLowerCase()} vendors near you right now. Try a different area or a related service — I'm happy to help!`
      : "I couldn't find matching vendors right now. Could you tell me exactly what service you're looking for?";

    return {
      intent: decision.intent,
      message: fallbackMessage,
      vendors: [],
      action: "NONE",
      service: effectiveService || serviceName,
      location: decision.location,
      confidence: decision.confidence,
      mode: decision.mode,
      provider: decision.provider,
      navigateTo: "",
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
    navigateTo: "",
  };
}

// ─── LLM-Powered Query Processing ───────────────────────────

export async function processAssistantQuery(
  message: string,
  lat?: number,
  lng?: number,
  conversationId?: string,
  userId?: string,
  currentPage?: string,
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

    // Build context: auth + platform data
    const [userContext, platformContext] = await Promise.all([
      userId ? buildAuthenticatedUserContext(userId) : Promise.resolve(["[Auth: guest]"]),
      buildPlatformContext(lat, lng),
    ]);

    const contextParts = [...userContext, ...platformContext];

    if (lat != null && lng != null) {
      contextParts.push(`[User location: ${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
    }

    if (currentPage) {
      contextParts.push(`[Current Page: ${currentPage}]`);
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
