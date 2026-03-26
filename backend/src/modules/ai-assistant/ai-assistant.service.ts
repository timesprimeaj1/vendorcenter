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
import { trySemanticResolution, semanticVendorSearch } from "./ai-assistant.semantic.js";
import { pool } from "../../db/pool.js";
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
  // Plumbing - Marathi
  "प्लंबर": "Plumbing",
  "नळ": "Plumbing",
  "पाइप": "Plumbing",
  "गळती": "Plumbing",
  "नळकाम": "Plumbing",
  "शौचालय": "Plumbing",
  "बाथरूम": "Plumbing",
  "पाणी": "Plumbing",
  // Electrical
  electrician: "Electrical",
  electrical: "Electrical",
  wiring: "Electrical",
  switch: "Electrical",
  fan: "Electrical",
  light: "Electrical",
  inverter: "Electrical",
  mcb: "Electrical",
  // Electrical - Marathi
  "इलेक्ट्रिशियन": "Electrical",
  "वीज": "Electrical",
  "वायरिंग": "Electrical",
  "पंखा": "Electrical",
  "दिवा": "Electrical",
  "लाइट": "Electrical",
  "विजेचे काम": "Electrical",
  // AC Repair
  ac: "AC Repair",
  "ac repair": "AC Repair",
  "air conditioner": "AC Repair",
  "air conditioning": "AC Repair",
  cooling: "AC Repair",
  hvac: "AC Repair",
  "ac service": "AC Repair",
  "ac installation": "AC Repair",
  // AC Repair - Marathi
  "एसी": "AC Repair",
  "एसी दुरुस्ती": "AC Repair",
  "एसी सर्व्हिस": "AC Repair",
  "वातानुकूलन": "AC Repair",
  "कूलिंग": "AC Repair",
  // Cleaning
  clean: "Cleaning",
  cleaning: "Cleaning",
  cleaner: "Cleaning",
  maid: "Cleaning",
  housekeeping: "Cleaning",
  "deep cleaning": "Cleaning",
  "home cleaning": "Cleaning",
  sanitization: "Cleaning",
  // Cleaning - Marathi
  "स्वच्छता": "Cleaning",
  "सफाई": "Cleaning",
  "स्वच्छता सेवा": "Cleaning",
  "घर स्वच्छता": "Cleaning",
  "मोलकरीण": "Cleaning",
  "झाडू": "Cleaning",
  // Painting
  paint: "Painting",
  painting: "Painting",
  painter: "Painting",
  wall: "Painting",
  whitewash: "Painting",
  // Painting - Marathi
  "रंगकाम": "Painting",
  "पेंटिंग": "Painting",
  "रंगारी": "Painting",
  "भिंत": "Painting",
  "रंग": "Painting",
  // Carpentry
  carpenter: "Carpentry",
  carpentry: "Carpentry",
  furniture: "Carpentry",
  wood: "Carpentry",
  cupboard: "Carpentry",
  wardrobe: "Carpentry",
  door: "Carpentry",
  // Carpentry - Marathi
  "सुतार": "Carpentry",
  "सुतारकाम": "Carpentry",
  "फर्निचर": "Carpentry",
  "लाकूड": "Carpentry",
  "कपाट": "Carpentry",
  "दरवाजा": "Carpentry",
  // Pest Control
  pest: "Pest Control",
  termite: "Pest Control",
  cockroach: "Pest Control",
  "pest control": "Pest Control",
  rats: "Pest Control",
  mosquito: "Pest Control",
  bedbugs: "Pest Control",
  // Pest Control - Marathi
  "कीटक नियंत्रण": "Pest Control",
  "कीटक": "Pest Control",
  "झुरळ": "Pest Control",
  "उंदीर": "Pest Control",
  "डास": "Pest Control",
  "ढेकूण": "Pest Control",
  "वाळवी": "Pest Control",
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
  // Salon - Marathi
  "सलून": "Salon",
  "केशकर्तन": "Salon",
  "ब्युटी": "Salon",
  "सौंदर्य": "Salon",
  "मेकअप": "Salon",
  "फेशियल": "Salon",
  "मेहंदी": "Salon",
  // Appliance Repair
  appliance: "Appliance Repair",
  fridge: "Appliance Repair",
  washing: "Appliance Repair",
  microwave: "Appliance Repair",
  "washing machine": "Appliance Repair",
  refrigerator: "Appliance Repair",
  geyser: "Appliance Repair",
  // Appliance Repair - Marathi
  "उपकरण दुरुस्ती": "Appliance Repair",
  "फ्रिज": "Appliance Repair",
  "वॉशिंग मशीन": "Appliance Repair",
  "मायक्रोवेव्ह": "Appliance Repair",
  "गिझर": "Appliance Repair",
  // Moving
  moving: "Moving",
  packers: "Moving",
  movers: "Moving",
  relocation: "Moving",
  shifting: "Moving",
  "packers and movers": "Moving",
  transport: "Moving",
  // Moving - Marathi
  "स्थलांतर": "Moving",
  "पॅकर्स": "Moving",
  "मूव्हर्स": "Moving",
  "घर बदलणे": "Moving",
  "वाहतूक": "Moving",
  // Photography
  photography: "Photography",
  photographer: "Photography",
  photo: "Photography",
  "photo shoot": "Photography",
  videography: "Photography",
  // Photography - Marathi
  "फोटोग्राफी": "Photography",
  "फोटोग्राफर": "Photography",
  "छायाचित्रण": "Photography",
  "व्हिडिओग्राफी": "Photography",
  // Catering
  catering: "Catering",
  caterer: "Catering",
  food: "Catering",
  cook: "Catering",
  chef: "Catering",
  tiffin: "Catering",
  // Catering - Marathi
  "केटरिंग": "Catering",
  "स्वयंपाकी": "Catering",
  "जेवण": "Catering",
  "डबा": "Catering",
  "शेफ": "Catering",
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
  // Mobile / Electronics - Marathi
  "मोबाइल": "Mobile Repair",
  "मोबाइल दुरुस्ती": "Mobile Repair",
  "फोन दुरुस्ती": "Mobile Repair",
  "स्क्रीन दुरुस्ती": "Mobile Repair",
  "लॅपटॉप": "Computer Repair",
  "कम्प्युटर": "Computer Repair",
  // Tutoring / Education
  tutor: "Tutoring",
  tutoring: "Tutoring",
  tuition: "Tutoring",
  teacher: "Tutoring",
  coaching: "Tutoring",
  // Tutoring - Marathi
  "शिकवणी": "Tutoring",
  "ट्यूशन": "Tutoring",
  "शिक्षक": "Tutoring",
  "कोचिंग": "Tutoring",
  // Fitness
  fitness: "Fitness",
  "personal trainer": "Fitness",
  yoga: "Fitness",
  gym: "Fitness",
  // Fitness - Marathi
  "फिटनेस": "Fitness",
  "योगा": "Fitness",
  "व्यायाम": "Fitness",
  "जिम": "Fitness",
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
  lang?: string,
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
    const locationMsg = lang === "mr"
      ? (effectiveService
          ? `कृपया तुमचे स्थान शेअर करा जेणेकरून मी जवळचे ${effectiveService.toLowerCase()} विक्रेते दाखवू शकेन.`
          : decision.message)
      : (effectiveService
          ? `Please share your location so I can show nearby ${effectiveService.toLowerCase()} vendors.`
          : decision.message);
    return {
      intent: decision.intent,
      message: locationMsg,
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
    const fallbackMessage = lang === "mr"
      ? (serviceName
          ? `सध्या तुमच्या जवळ ${serviceName.toLowerCase()} विक्रेते सापडले नाहीत. वेगळ्या भागात किंवा संबंधित सेवेसाठी प्रयत्न करा — मी मदत करायला तयार आहे!`
          : "सध्या जुळणारे विक्रेते सापडले नाहीत. तुम्हाला नक्की कोणती सेवा हवी आहे ते सांगाल का?")
      : (serviceName
          ? `I couldn't find ${serviceName.toLowerCase()} vendors near you right now. Try a different area or a related service — I'm happy to help!`
          : "I couldn't find matching vendors right now. Could you tell me exactly what service you're looking for?");

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
  lang?: string,
): Promise<AssistantResponse & { conversationId: string }> {
  const sessionId = conversationId || randomUUID();

  console.log(`[ai-assistant] Query: "${message.substring(0, 100)}" | ai=${isAssistantAvailable()}`);

  if (!isAssistantAvailable()) {
    return {
      intent: "UNKNOWN",
      message: lang === "mr"
        ? "AI सहाय्यक सध्या तात्पुरते अनुपलब्ध आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा."
        : "AI assistant is temporarily unavailable. Please try again later.",
      vendors: [],
      action: "NONE",
      conversationId: sessionId,
      mode: "CHAT",
    };
  }

  try {
    const history = getConversationHistory(sessionId);
    const queryStartTime = Date.now();

    // ─── PHASE 1: Try semantic resolution first (no LLM needed) ───
    const semantic = await trySemanticResolution(message, lang);
    if (semantic) {
      const latencyMs = Date.now() - queryStartTime;
      console.log(`[ai-assistant] Semantic hit: intent=${semantic.intent} service=${semantic.service} conf=${semantic.confidence.toFixed(2)} ${latencyMs}ms`);

      // If SERVICE_SEARCH, enrich with vendor results
      let vendors: VendorResult[] = [];
      if (semantic.intent === "SERVICE_SEARCH" && (lat != null || lng != null)) {
        vendors = await semanticVendorSearch(message, lat, lng, 50, 5);
      }

      const response: AssistantResponse & { conversationId: string } = {
        intent: semantic.intent,
        message: semantic.message,
        vendors,
        action: semantic.intent === "SERVICE_SEARCH" ? "SHOW_RESULTS" : "NONE",
        service: semantic.service,
        confidence: semantic.confidence,
        mode: "SYSTEM",
        provider: "embedding",
        conversationId: sessionId,
      };

      addToConversation(sessionId, { role: "user", parts: [{ text: message }] });
      addToConversation(sessionId, { role: "model", parts: [{ text: response.message }] });

      // Log query asynchronously — never block the response
      logQuery(sessionId, userId, message, semantic.intent, semantic.service, "SHOW_RESULTS", "embedding", semantic.message, null, semantic.confidence, latencyMs, lang, lat, lng);

      return response;
    }

    // ─── PHASE 2+: LLM provider chain ───
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
    const decision = await callAssistantModel(enrichedMessage, history, lang);
    const latencyMs = Date.now() - queryStartTime;
    const resolved = await resolveDecision(decision, message, history, lat, lng, lang);

    addToConversation(sessionId, { role: "user", parts: [{ text: message }] });
    addToConversation(sessionId, { role: "model", parts: [{ text: resolved.message }] });

    // Log query asynchronously
    logQuery(sessionId, userId, message, decision.intent, decision.service, decision.action, decision.provider, resolved.message, decision, decision.confidence, latencyMs, lang, lat, lng);

    return {
      ...resolved,
      conversationId: sessionId,
    };
  } catch (error) {
    console.error("[ai-assistant] Provider chain failed:", error);
    return {
      intent: "UNKNOWN",
      message: lang === "mr"
        ? "माफ करा, काहीतरी चूक झाली. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा."
        : "Sorry, something went wrong. Please try again in a moment.",
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

// ─── Query Logging (Phase 0) ─────────────────────────────────
// Fire-and-forget INSERT — logging failure must never break chatbot flow

function logQuery(
  sessionId: string,
  userId: string | undefined,
  userMessage: string,
  intent: string,
  service: string,
  action: string,
  provider: string,
  responseMessage: string,
  responseJson: unknown,
  confidence: number,
  latencyMs: number,
  lang: string | undefined,
  lat: number | undefined,
  lng: number | undefined,
): void {
  pool
    .query(
      `INSERT INTO ai_query_logs
        (session_id, user_id, user_message, detected_intent, detected_service, detected_action, provider, response_message, response_json, confidence, latency_ms, lang, user_lat, user_lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        sessionId,
        userId ?? null,
        userMessage.substring(0, 2000),
        intent,
        service,
        action,
        provider,
        responseMessage.substring(0, 2000),
        responseJson ? JSON.stringify(responseJson) : null,
        confidence,
        latencyMs,
        lang ?? null,
        lat ?? null,
        lng ?? null,
      ],
    )
    .catch((err) => {
      console.warn("[ai-assistant] Query logging failed (non-fatal):", (err as Error).message);
    });
}
