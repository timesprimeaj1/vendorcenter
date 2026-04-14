import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { env } from "../../config/env.js";
import type { Action, AssistantDecision, ConversationTurn, Intent } from "./ai-assistant.types.js";

const clientCache = new Map<string, GoogleGenerativeAI>();
const keyCooldownUntil = new Map<number, number>();
let preferredKeyIndex = 0;

const CHAT_MODE_PATTERNS = /\b(hi|hello|hey|hii|hlo|yo|hola|namaste|ok|okay|good\s+(morning|afternoon|evening)|how are you|what'?s up|sup|thanks|thank you|bye|goodbye|who\s+are\s+you|tu\s+kon\s+hai|no|yes|ya|yep|nope|hmm|ohh?|great|nice|cool|awesome|sure|speak\s+in\s+(marathi|english)|marathi\s*bol|english\s*bol|नमस्कार|नमस्ते|धन्यवाद|हो|नाही|बरोबर|ठीक|चालेल|आभार|शुभ\s*(सकाळ|दुपार|संध्याकाळ)|कसे\s*आहात|बाय|हॅलो|अरे|तू\s*कोण|तुम्ही\s*कोण|मराठी(?:त)?\s*बोला|इंग्रजी(?:त)?\s*बोला|मराठी\s*बोल)\b/i;
const MAX_HISTORY = 20;
const SELF_HOSTED_MAX_HISTORY = 4;
const SELF_HOSTED_HISTORY_TEXT_MAX_CHARS = 280;
const SELF_HOSTED_USER_INPUT_MAX_CHARS = 900;
const conversations = new Map<string, ConversationTurn[]>();
const DEVANAGARI_PATTERN = /[\u0900-\u097F]/;
const MARATHI_OUTPUT_PATTERNS = /\bmarathi\b|मराठी|मराठीत|मराठीत/i;
const ENGLISH_OUTPUT_PATTERNS = /\benglish\b|इंग्रजी|english\s*bol|speak\s+in\s+english/i;
const IDENTITY_CHAT_PATTERNS = /\b(who\s+are\s+you|tu\s+kon\s+a+h?es|kon\s+a+h?es|tu\s+kon\s+a+he|kon\s+a+he|tumhi\s+kon(?:\s+a+h?a+t)?|तू\s*कोण|तुम्ही\s*कोण)\b/i;
const CONTROL_TAG_PATTERNS = /\[(?:INTENT|SERVICE|ACTION|CONFIDENCE|NAVIGATE):/i;

const systemDecisionSchema = z.object({
  intent: z.enum(["GREETING", "SERVICE_SEARCH", "RECOMMENDATION", "BOOKING", "MY_BOOKINGS", "AVAILABLE_SERVICES", "FAQ", "COMPLAINT", "RESCHEDULE", "CANCEL_BOOKING", "REFUND", "VENDOR_INFO", "LOCATION", "UNKNOWN"]),
  service: z.string().catch(""),
  location: z.string().catch(""),
  action: z.enum(["SHOW_RESULTS", "GET_RECOMMENDATIONS", "BOOK_SERVICE", "SHOW_MY_BOOKINGS", "SHOW_CATEGORIES", "ASK_LOCATION", "ASK_DETAILS", "NAVIGATE", "NONE"]),
  navigateTo: z.string().catch(""),
  message: z.string().min(1),
  confidence: z.coerce.number().min(0).max(1),
});

const SYSTEM_PROMPT = `You are VendorCenter AI — a friendly, warm local expert helping customers find and book verified service professionals. Use emojis (2-3/response), be conversational, use first names from [User Profile].

BILINGUAL: Respond in Marathi (Devanagari) if [Language: mr] or user writes Devanagari. JSON field keys stay English; only "message" in Marathi.

MODES:
1. CHAT MODE (greetings, casual talk, "hi/hello/thanks/bye/ok"): Return ONLY plain text. No JSON. Be warm and varied.
2. SYSTEM MODE (service queries, bookings, FAQs): Return ONLY strict JSON:
{"intent":"","service":"","location":"","action":"","message":"","confidence":0.0,"navigateTo":""}

INTENTS & ACTIONS:
- GREETING → NONE (chat mode)
- SERVICE_SEARCH → SHOW_RESULTS (extract service: "plumber near me" → service:"Plumbing")
- RECOMMENDATION ("best","top rated") → GET_RECOMMENDATIONS
- BOOKING (explicit book request) → BOOK_SERVICE
- MY_BOOKINGS → SHOW_MY_BOOKINGS (summarize [Recent Bookings]; guest → "Log in first")
- AVAILABLE_SERVICES ("what services?") → SHOW_CATEGORIES (list [Available Services] with counts; never vendor search)
- FAQ → NONE (answer conversationally; VendorCenter: browse vendors, ratings, book, secure payments, cancel)
- UNKNOWN → NONE
- Navigation ("take me to","go to") → NAVIGATE with navigateTo: "/", "/services", "/account", "/about", "/login", "/register"

CONTEXT TAGS in user messages: [Auth: logged_in/guest], [User Profile:{...}], [Recent Bookings:[...]], [Available Services:[...]], [Platform Stats:{...}], [User location: lat,lng], [Current Page: /path]. Read them carefully.

PAGE-AWARE: Translate paths naturally (don't say "/vendor/123"). On error/404 pages → offer NAVIGATE to "/".

RULES:
- Analyze each message FRESH. Don't carry service names from history unless user says "show more"/"go ahead".
- Never invent vendor data. JSON only in system mode, no markdown/code fences.
- Rude input: acknowledge warmly, redirect to services. Never mirror aggression.
- Nonsense: be lighthearted, suggest services.
- Already logged-in user asks about login → CHAT MODE: "You're already logged in!"
- Confidence: 0.0-1.0. Never say "I'm just an AI".`;

const SELF_HOSTED_SYSTEM_PROMPT = `You are VendorCenter AI, a helpful assistant for a local services marketplace in India.
Given the user's message, respond with bracketed tags on the first line followed by a friendly message.

Format: [INTENT:X] [SERVICE:Y] [ACTION:Z] [CONFIDENCE:N.N]
Your helpful message here.

Intents: GREETING, SERVICE_SEARCH, RECOMMENDATION, BOOKING, MY_BOOKINGS, AVAILABLE_SERVICES, FAQ, COMPLAINT, RESCHEDULE, CANCEL_BOOKING, REFUND, VENDOR_INFO, LOCATION, UNKNOWN
Services: AC Repair, Appliance Repair, Catering, Cleaning, Carpentry, Computer Repair, Electrical, Fitness, Mobile Repair, Moving, Painting, Pest Control, Photography, Plumbing, Salon, Tutoring
Actions: SHOW_RESULTS, GET_RECOMMENDATIONS, BOOK_SERVICE, SHOW_MY_BOOKINGS, SHOW_CATEGORIES, ASK_LOCATION, ASK_DETAILS, NAVIGATE, NONE

Rules:
- Tags MUST be on the first line, always in order: INTENT, SERVICE (optional), ACTION, CONFIDENCE
- NAVIGATE includes: [NAVIGATE:/services] or [NAVIGATE:/account]
- Message starts on the next line, plain text, warm and conversational
- No JSON, no code fences, no markdown
- For greetings/casual (hi, hello, thanks, bye): [INTENT:GREETING] [ACTION:NONE] [CONFIDENCE:0.95]
- If [Language: mr] is present, the user writes Devanagari, or the user asks to speak in Marathi, the message line MUST be fully in Marathi (Devanagari). Do not answer in English.
- If the user asks to switch language, comply immediately and continue in that language.
- Language-switch requests like "marathi bol" or "मराठीत बोला" should be treated as GREETING with ACTION:NONE.
- Support English, Hinglish, and Marathi. Be warm, use emojis sparingly. Never invent vendor data.`;

const SELF_HOSTED_MINI_SYSTEM_PROMPT = `You are VendorCenter AI.
Return exactly:
[INTENT:X] [SERVICE:Y] [ACTION:Z] [CONFIDENCE:N.N]
<friendly plain-text message>
No JSON. No markdown.`;

const VALID_INTENTS = new Set(["GREETING", "SERVICE_SEARCH", "RECOMMENDATION", "BOOKING", "MY_BOOKINGS", "AVAILABLE_SERVICES", "FAQ", "COMPLAINT", "RESCHEDULE", "CANCEL_BOOKING", "REFUND", "VENDOR_INFO", "LOCATION", "UNKNOWN"]);
const VALID_ACTIONS = new Set(["SHOW_RESULTS", "GET_RECOMMENDATIONS", "BOOK_SERVICE", "SHOW_MY_BOOKINGS", "SHOW_CATEGORIES", "ASK_LOCATION", "ASK_DETAILS", "NAVIGATE", "NONE"]);

function parseBracketedFormat(rawText: string): AssistantDecision | null {
  const trimmed = rawText.trim();
  const lines = trimmed.split("\n");
  const tagLine = lines[0] || "";

  const intentMatch = tagLine.match(/\[INTENT:(\w+)\]/);
  if (!intentMatch) return null;

  const intent = intentMatch[1];
  if (!VALID_INTENTS.has(intent)) return null;

  const serviceMatch = tagLine.match(/\[SERVICE:([^\]]*)\]/);
  const actionMatch = tagLine.match(/\[ACTION:(\w+)\]/);
  const confidenceMatch = tagLine.match(/\[CONFIDENCE:([\d.]+)\]/);
  const navigateMatch = tagLine.match(/\[NAVIGATE:([^\]]*)\]/);

  const action = actionMatch?.[1] ?? "NONE";
  if (!VALID_ACTIONS.has(action)) return null;

  const message = lines.slice(1).join("\n").trim();
  if (!message) return null;

  return {
    mode: intent === "GREETING" ? "CHAT" : "SYSTEM",
    intent: intent as Intent,
    service: serviceMatch?.[1]?.trim() ?? "",
    location: "",
    action: action as Action,
    message,
    confidence: confidenceMatch ? Math.min(1, Math.max(0, Number(confidenceMatch[1]))) : 0.8,
    provider: "self-hosted",
    rawText,
    navigateTo: navigateMatch?.[1]?.trim() ?? "",
  };
}

function getGeminiApiKeys(): string[] {
  const keys = env.geminiApiKeys.length > 0
    ? env.geminiApiKeys
    : env.geminiApiKey
      ? [env.geminiApiKey]
      : [];

  return Array.from(new Set(keys));
}

function getClient(keyIndex: number): GoogleGenerativeAI | null {
  const apiKeys = getGeminiApiKeys();
  const apiKey = apiKeys[keyIndex];
  if (!apiKey) return null;

  let client = clientCache.get(apiKey);
  if (!client) {
    client = new GoogleGenerativeAI(apiKey);
    clientCache.set(apiKey, client);
  }

  return client;
}

export function isAssistantAvailable(): boolean {
  return getGeminiApiKeys().length > 0 || !!env.groqApiKey || !!env.selfHostedLlmUrl;
}

// Startup diagnostic — log once when module loads
(() => {
  const geminiCount = getGeminiApiKeys().length;
  const hasGroq = !!env.groqApiKey;
  const hasSelfHosted = !!env.selfHostedLlmUrl;
  console.log(`[assistant-ai] Provider config: SelfHosted=${hasSelfHosted ? "yes (primary)" : "no"}, Groq=${hasGroq ? "yes (secondary)" : "no"}, ${geminiCount} Gemini key(s) (fallback), model=${env.geminiModel}`);
  if (geminiCount === 0 && !hasGroq && !hasSelfHosted) {
    console.warn("[assistant-ai] WARNING: No AI provider keys configured — chatbot will return static fallbacks");
  }
})();

function isRetryableGeminiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /429|quota exceeded|too many requests|rate.limit|rate-limit|403|401|api key not valid|permission denied|500|502|503|504|service unavailable|internal server error|overloaded|resource exhausted/i.test(message);
}

function getRetryDelayMs(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (match) {
    return Math.min(Math.ceil(Number(match[1]) * 1000), 30_000);
  }
  // Default cooldown: 15s (not 60s) — keys rotate faster
  return 15_000;
}

function markKeyCooldown(keyIndex: number, error: unknown) {
  keyCooldownUntil.set(keyIndex, Date.now() + getRetryDelayMs(error));
}

function getCandidateKeyIndices(): { ready: number[]; allOnCooldown: boolean } {
  const apiKeys = getGeminiApiKeys();
  if (apiKeys.length === 0) return { ready: [], allOnCooldown: false };

  const now = Date.now();
  const preferred = preferredKeyIndex < apiKeys.length ? [preferredKeyIndex] : [];
  const remaining = apiKeys.map((_, index) => index).filter((index) => index !== preferredKeyIndex);
  const ordered = [...preferred, ...remaining];
  const readyKeys = ordered.filter((index) => (keyCooldownUntil.get(index) ?? 0) <= now);
  return readyKeys.length > 0
    ? { ready: readyKeys, allOnCooldown: false }
    : { ready: [], allOnCooldown: true };
}

function shouldUseChatMode(userMessage: string): boolean {
  const trimmed = userMessage.trim();
  return CHAT_MODE_PATTERNS.test(trimmed) || IDENTITY_CHAT_PATTERNS.test(trimmed);
}

function shouldRespondInMarathi(userMessage: string, lang?: string): boolean {
  return lang === "mr" || DEVANAGARI_PATTERN.test(userMessage) || MARATHI_OUTPUT_PATTERNS.test(userMessage);
}

function buildLanguageInstruction(userMessage: string, lang?: string): string {
  if (shouldRespondInMarathi(userMessage, lang)) {
    return "RESPOND_LANGUAGE: Marathi (Devanagari) only for the user-facing message.";
  }

  if (lang === "en" || ENGLISH_OUTPUT_PATTERNS.test(userMessage)) {
    return "RESPOND_LANGUAGE: English only for the user-facing message.";
  }

  return "";
}

function buildUserInstruction(userMessage: string, chatMode: boolean, lang?: string): string {
  const langTag = lang ? `\n[Language: ${lang}]` : "";
  const languageInstruction = buildLanguageInstruction(userMessage, lang);
  if (chatMode) {
    return `MODE: CHAT${langTag}${languageInstruction ? `\n${languageInstruction}` : ""}\nUSER_INPUT: ${userMessage}\nReturn only short friendly plain text. Do not return JSON.`;
  }

  return `MODE: SYSTEM${langTag}${languageInstruction ? `\n${languageInstruction}` : ""}\nUSER_INPUT: ${userMessage}\nReturn only strict JSON. No markdown. No code fences.`;
}

function buildSelfHostedUserInstruction(userMessage: string, chatMode: boolean, lang?: string): string {
  const langTag = lang ? `[Language: ${lang}]` : "";
  const languageInstruction = buildLanguageInstruction(userMessage, lang);
  const modeLine = chatMode ? "MODE: CHAT" : "MODE: SYSTEM";
  const responseRule = chatMode
    ? "Return bracket tags on the first line and a short friendly reply on the next line."
    : "Return bracket tags on the first line and the helpful reply on the next line.";

  return [modeLine, langTag, languageInstruction, `USER_INPUT: ${userMessage}`, responseRule]
    .filter(Boolean)
    .join("\n");
}

function responseMatchesRequestedLanguage(message: string, userMessage: string, lang?: string): boolean {
  if (!shouldRespondInMarathi(userMessage, lang)) {
    return true;
  }

  return DEVANAGARI_PATTERN.test(message);
}

function buildDeterministicChatResponse(userMessage: string, lang?: string): AssistantDecision | null {
  const cleaned = userMessage.toLowerCase().replace(/\[.*?\]\s*/g, "").trim();
  const isMr = shouldRespondInMarathi(userMessage, lang);

  if (/marathi\s*bol|speak\s+in\s+marathi|मराठी(?:त)?\s*बोला|मराठी\s*बोल/i.test(cleaned)) {
    return {
      mode: "CHAT",
      intent: "GREETING",
      service: "",
      location: "",
      action: "NONE",
      message: "नक्की, मी आता मराठीत बोलेन. तुम्हाला कोणती सेवा हवी आहे? 😊",
      confidence: 0.98,
      provider: "static",
      rawText: "",
      navigateTo: "",
    };
  }

  if (/english\s*bol|speak\s+in\s+english|इंग्रजी(?:त)?\s*बोला/i.test(cleaned)) {
    return {
      mode: "CHAT",
      intent: "GREETING",
      service: "",
      location: "",
      action: "NONE",
      message: "Sure, I will continue in English. What service do you need? 😊",
      confidence: 0.98,
      provider: "static",
      rawText: "",
      navigateTo: "",
    };
  }

  if (IDENTITY_CHAT_PATTERNS.test(cleaned)) {
    return {
      mode: "CHAT",
      intent: "GREETING",
      service: "",
      location: "",
      action: "NONE",
      message: isMr
        ? "मी VendorCenter चा AI सहाय्यक आहे. तुमच्या जवळच्या सेवा शोधण्यात आणि बुकिंग करण्यात मदत करण्यासाठी इथे आहे. 😊"
        : "I'm VendorCenter's AI assistant. I'm here to help you find nearby services and bookings. 😊",
      confidence: 0.98,
      provider: "static",
      rawText: "",
      navigateTo: "",
    };
  }

  return null;
}

function stripCodeFences(text: string): string {
  return text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function parseSystemDecision(rawText: string) {
  const sanitized = stripCodeFences(rawText);
  const firstBrace = sanitized.indexOf("{");
  const lastBrace = sanitized.lastIndexOf("}");
  const candidate = firstBrace >= 0 && lastBrace > firstBrace
    ? sanitized.slice(firstBrace, lastBrace + 1)
    : sanitized;

  return systemDecisionSchema.parse(JSON.parse(candidate));
}

function normalizeResponse(rawText: string, provider: "gemini" | "groq" | "self-hosted", chatMode: boolean): AssistantDecision {
  const sanitized = stripCodeFences(rawText);

  // Self-hosted model uses bracketed format — try parsing that first
  if (provider === "self-hosted") {
    const bracketed = parseBracketedFormat(sanitized);
    if (bracketed) return bracketed;
    if (CONTROL_TAG_PATTERNS.test(sanitized)) {
      throw new Error("Malformed self-hosted tagged response");
    }
    // Fall through to JSON parsing if bracketed failed without control tags
    console.warn("[self-hosted] Bracketed parse failed, falling back to JSON");
  }

  if (chatMode) {
    return {
      mode: "CHAT",
      intent: "GREETING",
      service: "",
      location: "",
      action: "NONE",
      message: sanitized || "Hi! What service are you looking for?",
      confidence: 0.95,
      provider,
      rawText,
      navigateTo: "",
    };
  }

  try {
    const parsed = parseSystemDecision(sanitized);
    return {
      mode: "SYSTEM",
      intent: parsed.intent as Intent,
      service: parsed.service,
      location: parsed.location,
      action: parsed.action as Action,
      message: parsed.message,
      confidence: parsed.confidence,
      provider,
      rawText,
      navigateTo: parsed.navigateTo || "",
    };
  } catch {
    // LLM returned non-JSON or malformed JSON — try to salvage the message field
    console.warn(`[${provider}] Failed to parse JSON response, attempting message extraction`);

    let fallbackMessage = "How can I help you today?";
    try {
      // Try extracting "message" field from partial/malformed JSON
      const msgMatch = sanitized.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (msgMatch?.[1]) {
        fallbackMessage = msgMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
      } else if (!sanitized.includes("{") && sanitized.length > 0 && sanitized.length < 500) {
        // Plain text response (no JSON at all) — use it directly
        fallbackMessage = sanitized;
      }
    } catch {
      // extraction failed, use default fallback
    }

    return {
      mode: "CHAT",
      intent: "GREETING",
      service: "",
      location: "",
      action: "NONE",
      message: fallbackMessage,
      confidence: 0.6,
      provider,
      rawText,
      navigateTo: "",
    };
  }
}

function shouldEscalateToFallback(decision: AssistantDecision, chatMode: boolean): boolean {
  // In system mode we expect structured intent/action output. If a provider falls back
  // to generic chat text, keep cascading to the next provider.
  if (chatMode) return false;
  if (decision.mode !== "CHAT") return false;
  if (decision.provider === "static") return false;

  const normalizedMsg = decision.message.toLowerCase();
  const looksGeneric =
    normalizedMsg.includes("how can i help")
    || normalizedMsg.includes("what service")
    || normalizedMsg.includes("please try again")
    || normalizedMsg.includes("मदत")
    || normalizedMsg.includes("कशी मदत");

  return decision.intent === "GREETING" || looksGeneric;
}

function mapHistoryForGroq(history: ConversationTurn[]): Array<{ role: "user" | "assistant"; content: string }> {
  return history.map((turn) => ({
    role: turn.role === "model" ? "assistant" : "user",
    content: turn.parts.map((part) => part.text).join("\n"),
  }));
}

function truncateText(value: string, maxChars: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}...`;
}

function compactSelfHostedHistory(history: ConversationTurn[]): Array<{ role: "user" | "assistant"; content: string }> {
  return mapHistoryForGroq(history.slice(-SELF_HOSTED_MAX_HISTORY)).map((turn) => ({
    ...turn,
    content: truncateText(turn.content, SELF_HOSTED_HISTORY_TEXT_MAX_CHARS),
  }));
}

function stripContextTags(input: string): string {
  // Remove bracketed context blocks injected by backend (profile/bookings/platform stats)
  return input.replace(/\[[^\]]*\]\s*/g, " ").replace(/\s+/g, " ").trim();
}

function isContextOverflowError(message: string): boolean {
  return /context size has been exceeded|context length|maximum context|too many tokens|prompt too long/i.test(message);
}

export function getConversationHistory(sessionId: string): ConversationTurn[] {
  return conversations.get(sessionId) ?? [];
}

export function addToConversation(sessionId: string, turn: ConversationTurn) {
  let history = conversations.get(sessionId) ?? [];
  history.push(turn);
  if (history.length > MAX_HISTORY) {
    history = history.slice(-MAX_HISTORY);
  }
  conversations.set(sessionId, history);
}

export function clearConversation(sessionId: string) {
  conversations.delete(sessionId);
}

setInterval(() => {
  if (conversations.size > 1000) {
    const keys = Array.from(conversations.keys());
    for (let index = 0; index < keys.length - 500; index++) {
      conversations.delete(keys[index]);
    }
  }
}, 5 * 60 * 1000);

async function callGeminiProvider(userMessage: string, history: ConversationTurn[], chatMode: boolean, lang?: string): Promise<string> {
  const { ready: candidateKeyIndices, allOnCooldown } = getCandidateKeyIndices();
  if (candidateKeyIndices.length === 0) {
    throw new Error(allOnCooldown ? "All Gemini keys on cooldown" : "Gemini API key not configured");
  }

  let lastError: unknown;

  for (const keyIndex of candidateKeyIndices) {
    const client = getClient(keyIndex);
    if (!client) continue;

    try {
      console.log(`[gemini] Calling model=${env.geminiModel} key=${keyIndex + 1}/${getGeminiApiKeys().length} history=${history.length}`);
      const model = client.getGenerativeModel({
        model: env.geminiModel,
        systemInstruction: SYSTEM_PROMPT,
      });

      const chat = model.startChat({
        history: history.map((turn) => ({ role: turn.role, parts: turn.parts })),
      });

      const geminiTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini request timed out after 25s")), 25_000),
      );
      const result = await Promise.race([
        chat.sendMessage(buildUserInstruction(userMessage, chatMode, lang)),
        geminiTimeout,
      ]);
      const text = result.response.text();
      preferredKeyIndex = keyIndex;
      keyCooldownUntil.delete(keyIndex);
      return text;
    } catch (error) {
      lastError = error;
      console.warn(`[gemini] Key ${keyIndex + 1} failed:`, error instanceof Error ? error.message : error);

      if (isRetryableGeminiError(error)) {
        markKeyCooldown(keyIndex, error);
      } else {
        // Non-retryable: short cooldown so we don't hammer a broken key
        keyCooldownUntil.set(keyIndex, Date.now() + 10_000);
      }
      // Always continue to next key instead of throwing
      continue;
    }
  }

  throw lastError ?? new Error("All Gemini API keys failed");
}

async function callGroqProvider(userMessage: string, history: ConversationTurn[], chatMode: boolean, lang?: string): Promise<string> {
  if (!env.groqApiKey) {
    throw new Error("Groq API key not configured");
  }

  console.log(`[groq] Calling model=${env.groqModel} history=${history.length}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(`${env.groqBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.groqApiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: env.groqModel,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...mapHistoryForGroq(history),
          { role: "user", content: buildUserInstruction(userMessage, chatMode, lang) },
        ],
      }),
    });

    const payload = await response.json().catch(() => null) as any;
    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || `Groq request failed with status ${response.status}`;
      throw new Error(message);
    }

    return typeof payload?.choices?.[0]?.message?.content === "string"
      ? payload.choices[0].message.content
      : "";
  } finally {
    clearTimeout(timeoutId);
  }
}

// Track whether the HF Space has responded successfully at least once
let selfHostedWarm = false;

async function callSelfHostedProvider(userMessage: string, history: ConversationTurn[], chatMode: boolean, lang?: string): Promise<string> {
  if (!env.selfHostedLlmUrl) {
    throw new Error("Self-hosted LLM URL not configured");
  }

  // If the space has been warm recently, use a shorter timeout.
  // Otherwise allow up to 90s for HuggingFace Spaces cold-start wake-up.
  const timeoutMs = selfHostedWarm ? 15_000 : 90_000;
  console.log(`[self-hosted] Calling model=${env.selfHostedLlmModel} history=${history.length} timeout=${timeoutMs}ms warm=${selfHostedWarm}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const post = async (
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    signal: AbortSignal,
  ) => {
    const response = await fetch(`${env.selfHostedLlmUrl.replace(/\/+$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        model: env.selfHostedLlmModel,
        temperature: 0.2,
        messages,
      }),
    });

    const payload = await response.json().catch(() => null) as any;
    if (!response.ok) {
      const message = payload?.error?.message || `Self-hosted LLM request failed with status ${response.status}`;
      throw new Error(message);
    }

    return typeof payload?.choices?.[0]?.message?.content === "string"
      ? payload.choices[0].message.content
      : "";
  };

  try {
    const primaryMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: SELF_HOSTED_SYSTEM_PROMPT },
      ...compactSelfHostedHistory(history),
      {
        role: "user",
        content: buildSelfHostedUserInstruction(
          truncateText(userMessage, SELF_HOSTED_USER_INPUT_MAX_CHARS),
          chatMode,
          lang,
        ),
      },
    ];

    let text: string;
    try {
      text = await post(primaryMessages, controller.signal);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isContextOverflowError(message)) {
        throw error;
      }

      // Retry once with ultra-compact payload (no history, stripped context tags)
      const retryController = new AbortController();
      const retryTimeout = setTimeout(() => retryController.abort(), Math.min(timeoutMs, 15_000));
      try {
        const compactInput = truncateText(stripContextTags(userMessage) || userMessage, 380);
        text = await post(
          [
            { role: "system", content: SELF_HOSTED_MINI_SYSTEM_PROMPT },
            { role: "user", content: buildSelfHostedUserInstruction(compactInput, chatMode, lang) },
          ],
          retryController.signal,
        );
      } finally {
        clearTimeout(retryTimeout);
      }
    }

    selfHostedWarm = true;
    return text;
  } catch (error) {
    // On timeout, mark as cold so next attempt uses the longer timeout
    if (error instanceof DOMException || (error instanceof Error && error.name === "AbortError")) {
      selfHostedWarm = false;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Periodically ping HF Space health endpoint to keep it warm and detect sleep
function startSelfHostedKeepAlive() {
  if (!env.selfHostedLlmUrl) return;
  const healthUrl = `${env.selfHostedLlmUrl.replace(/\/+$/, "")}/health`;

  const ping = async () => {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(healthUrl, { signal: controller.signal });
      clearTimeout(t);
      selfHostedWarm = res.ok;
      if (!res.ok) console.warn(`[self-hosted] Health check returned ${res.status}`);
    } catch {
      selfHostedWarm = false;
    }
  };

  // Ping every 10 minutes to prevent HF Space from sleeping (free tier sleeps after ~48h inactivity)
  ping();
  setInterval(ping, 10 * 60 * 1000);
}

startSelfHostedKeepAlive();

export async function callAssistantModel(userMessage: string, history: ConversationTurn[], lang?: string): Promise<AssistantDecision> {
  const chatMode = shouldUseChatMode(userMessage);
  const deterministicChat = chatMode ? buildDeterministicChatResponse(userMessage, lang) : null;
  if (deterministicChat) {
    return deterministicChat;
  }
  let lastError: unknown;
  const hasGroq = !!env.groqApiKey;
  const hasGeminiKeys = getGeminiApiKeys().length > 0;
  const hasSelfHosted = !!env.selfHostedLlmUrl;

  // SELF-HOSTED LLM (Qwen): always try first — our own model
  if (hasSelfHosted) {
    try {
      const rawText = await callSelfHostedProvider(userMessage, history, chatMode, lang);
      const decision = normalizeResponse(rawText, "self-hosted" as any, chatMode);
      if (shouldEscalateToFallback(decision, chatMode)) {
        lastError = new Error("Self-hosted returned non-structured response for system mode");
        console.warn("[assistant-ai] Self-hosted returned weak/system-invalid output; trying fallback provider.");
      } else if (responseMatchesRequestedLanguage(decision.message, userMessage, lang)) {
        return decision;
      } else {
        lastError = new Error("Self-hosted response ignored Marathi language request");
        console.warn("[assistant-ai] Self-hosted response ignored Marathi request; trying fallback provider.");
      }
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const isTimeout = msg.includes("abort") || msg.includes("AbortError") || (error instanceof DOMException);
      console.warn(`[assistant-ai] Self-hosted LLM failed (${isTimeout ? "timeout — HF Space may be cold-starting" : "error"}):`, msg);
    }
  }

  // PRIMARY: Try Groq — reliable rate limits, fast inference
  if (hasGroq) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const rawText = await callGroqProvider(userMessage, history, chatMode, lang);
        const decision = normalizeResponse(rawText, "groq", chatMode);
        if (shouldEscalateToFallback(decision, chatMode)) {
          lastError = new Error("Groq returned non-structured response for system mode");
          console.warn(`[assistant-ai] Groq attempt ${attempt + 1}/2 returned weak/system-invalid output; trying next provider.`);
          continue;
        }
        if (responseMatchesRequestedLanguage(decision.message, userMessage, lang)) {
          return decision;
        }
        lastError = new Error("Groq response ignored Marathi language request");
        console.warn(`[assistant-ai] Groq attempt ${attempt + 1}/2 ignored Marathi request; trying next provider.`);
      } catch (error) {
        lastError = error;
        const msg = error instanceof Error ? error.message : String(error);
        const isRetryable = /429|500|502|503|504|rate.limit|overloaded|timeout|abort/i.test(msg);
        console.warn(`[assistant-ai] Groq attempt ${attempt + 1}/2 failed:`, msg);
        if (!isRetryable || attempt === 1) break;
        // Brief pause before retry on transient errors
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  // FALLBACK: Try Gemini keys (rotate through all available)
  if (hasGeminiKeys) {
    try {
      const rawText = await callGeminiProvider(userMessage, history, chatMode, lang);
      const decision = normalizeResponse(rawText, "gemini", chatMode);
      if (shouldEscalateToFallback(decision, chatMode)) {
        lastError = new Error("Gemini returned non-structured response for system mode");
        console.warn("[assistant-ai] Gemini returned weak/system-invalid output; using static fallback.");
      } else if (responseMatchesRequestedLanguage(decision.message, userMessage, lang)) {
        return decision;
      } else {
        lastError = new Error("Gemini response ignored Marathi language request");
        console.warn("[assistant-ai] Gemini response ignored Marathi request; using static fallback.");
      }
    } catch (error) {
      lastError = error;
      console.warn("[assistant-ai] Gemini (fallback) also failed:", error instanceof Error ? error.message : error);
    }
  }

  // Final safety fallback — smart static response engine (no LLM needed)
  console.warn("[assistant-ai] All providers rate-limited. Using smart static fallback.");
  return buildStaticFallback(userMessage, chatMode, lang);
}

/**
 * Smart static response engine — handles common queries without any LLM call.
 * Activated when all providers are rate-limited/unavailable.
 */
function buildStaticFallback(userMessage: string, chatMode: boolean, lang?: string): AssistantDecision {
  const isMr = shouldRespondInMarathi(userMessage, lang);
  const lower = userMessage.toLowerCase();
  // Strip context tags to analyze pure user message
  const cleaned = lower.replace(/\[.*?\]\s*/g, "").trim();

  // CHAT MODE — greetings and casual messages
  if (chatMode) {
    if (/marathi\s*bol|speak\s+in\s+marathi|मराठी(?:त)?\s*बोला|मराठी\s*बोल/i.test(cleaned)) {
      return {
        mode: "CHAT",
        intent: "GREETING",
        service: "",
        location: "",
        action: "NONE",
        message: "नक्की, मी आता मराठीत बोलेन. तुम्हाला कोणती सेवा हवी आहे? 😊",
        confidence: 0.9,
        provider: "static",
        rawText: "",
        navigateTo: "",
      };
    }

    if (IDENTITY_CHAT_PATTERNS.test(cleaned)) {
      return {
        mode: "CHAT",
        intent: "GREETING",
        service: "",
        location: "",
        action: "NONE",
        message: isMr
          ? "मी VendorCenter चा AI सहाय्यक आहे. तुमच्या जवळच्या सेवांसाठी मदत करू शकतो. काय हवे? 😊"
          : "I'm VendorCenter's AI assistant. I can help you find nearby services and bookings. What do you need? 😊",
        confidence: 0.9,
        provider: "static",
        rawText: "",
        navigateTo: "",
      };
    }

    const greetings = [
      isMr ? "नमस्कार! 👋 तुम्हाला कोणती सेवा शोधायची आहे? प्लंबिंग, इलेक्ट्रिकल, स्वच्छता — सांगा!" : "Hey there! 👋 What service can I help you find? Plumbing, electrical, cleaning — just ask!",
      isMr ? "हाय! 😊 मी तुम्हाला जवळचे सर्वोत्तम सेवा प्रदाता शोधून देतो. काय हवे?" : "Hi! 😊 I can help you find the best local service pros. What do you need?",
      isMr ? "नमस्ते! ✨ सेवा, बुकिंग किंवा विक्रेत्यांबद्दल विचारा — मी मदत करतो!" : "Hello! ✨ Ask me about services, bookings, or vendors — I'm here to help!",
    ];
    return {
      mode: "CHAT",
      intent: "GREETING",
      service: "",
      location: "",
      action: "NONE",
      message: greetings[Math.floor(Math.random() * greetings.length)],
      confidence: 0.8,
      provider: "static",
      rawText: "",
      navigateTo: "",
    };
  }

  // AVAILABLE_SERVICES — "what services", "what do you offer"
  if (/what\s+service|available|what.*offer|कोणत्या\s*सेवा|उपलब्ध/i.test(cleaned)) {
    return {
      mode: "SYSTEM",
      intent: "AVAILABLE_SERVICES",
      service: "",
      location: "",
      action: "SHOW_CATEGORIES",
      message: isMr
        ? "आमच्याकडे प्लंबिंग, इलेक्ट्रिकल, स्वच्छता, एसी दुरुस्ती, सलून, पेंटिंग, सुतारकाम, कीटक नियंत्रण, आणि बरेच काही उपलब्ध आहे! कोणती सेवा हवी? 🔍"
        : "We offer Plumbing, Electrical, Cleaning, AC Repair, Salon, Painting, Carpentry, Pest Control, and more! Which service do you need? 🔍",
      confidence: 0.85,
      provider: "static",
      rawText: "",
      navigateTo: "",
    };
  }

  // MY_BOOKINGS
  if (/my\s*booking|show.*booking|order|status|माझ.*बुकिंग/i.test(cleaned)) {
    return {
      mode: "SYSTEM",
      intent: "MY_BOOKINGS",
      service: "",
      location: "",
      action: "SHOW_MY_BOOKINGS",
      message: isMr ? "तुमच्या बुकिंग पाहूया! 📋" : "Let me pull up your bookings! 📋",
      confidence: 0.85,
      provider: "static",
      rawText: "",
      navigateTo: "",
    };
  }

  // SERVICE SEARCH — detect category from common keywords
  const SERVICE_KEYWORDS: Record<string, string> = {
    plumb: "Plumbing", pipe: "Plumbing", leak: "Plumbing", tap: "Plumbing", drain: "Plumbing", toilet: "Plumbing",
    "प्लंबर": "Plumbing", "नळ": "Plumbing", "पाइप": "Plumbing",
    electric: "Electrical", wiring: "Electrical", switch: "Electrical", fan: "Electrical", light: "Electrical",
    "इलेक्ट्रिशियन": "Electrical", "वीज": "Electrical",
    "ac ": "AC Repair", "ac repair": "AC Repair", "air condition": "AC Repair", hvac: "AC Repair",
    "एसी": "AC Repair",
    clean: "Cleaning", maid: "Cleaning", housekeep: "Cleaning", sanitiz: "Cleaning",
    "स्वच्छता": "Cleaning", "सफाई": "Cleaning",
    paint: "Painting", whitewash: "Painting", "रंगकाम": "Painting",
    carpenter: "Carpentry", furniture: "Carpentry", wood: "Carpentry", cupboard: "Carpentry",
    "सुतार": "Carpentry",
    pest: "Pest Control", termite: "Pest Control", cockroach: "Pest Control",
    "कीटक": "Pest Control",
    salon: "Salon", haircut: "Salon", beauty: "Salon", spa: "Salon", facial: "Salon", makeup: "Salon",
    "सलून": "Salon", "ब्युटी": "Salon",
    appliance: "Appliance Repair", fridge: "Appliance Repair", "washing machine": "Appliance Repair",
    moving: "Moving", packers: "Moving", movers: "Moving", shifting: "Moving",
    photo: "Photography", videograph: "Photography",
    cater: "Catering", cook: "Catering", chef: "Catering", tiffin: "Catering",
    mobile: "Mobile Repair", "phone repair": "Mobile Repair", laptop: "Computer Repair",
    tutor: "Tutoring", tuition: "Tutoring", teacher: "Tutoring",
    fitness: "Fitness", yoga: "Fitness", gym: "Fitness",
  };
  const kwKeys = Object.keys(SERVICE_KEYWORDS).sort((a, b) => b.length - a.length);
  for (const key of kwKeys) {
    if (cleaned.includes(key)) {
      const service = SERVICE_KEYWORDS[key];
      return {
        mode: "SYSTEM",
        intent: "SERVICE_SEARCH",
        service,
        location: "",
        action: "SHOW_RESULTS",
        message: isMr
          ? `तुमच्या जवळचे सर्वोत्तम ${service.toLowerCase()} विक्रेते शोधतो! 🔍`
          : `Let me find the best ${service.toLowerCase()} pros near you! 🔍`,
        confidence: 0.8,
        provider: "static",
        rawText: "",
        navigateTo: "",
      };
    }
  }

  // FAQ — booking questions
  if (/how.*book|booking.*work|बुकिंग.*कस/i.test(cleaned)) {
    return {
      mode: "SYSTEM",
      intent: "FAQ",
      service: "",
      location: "",
      action: "NONE",
      message: isMr
        ? "बुकिंग सोपे आहे! सेवा शोधा, विक्रेता निवडा, वेळ ठरवा आणि बुक करा. पेमेंट सुरक्षित आहे आणि तुम्ही कधीही रद्द करू शकता. 😊"
        : "Booking is easy! Search for a service, pick a vendor, choose a time, and book. Payments are secure and you can cancel anytime. 😊",
      confidence: 0.85,
      provider: "static",
      rawText: "",
      navigateTo: "",
    };
  }

  // NAVIGATION
  if (/take me|go to|navigate|home\s*page/i.test(cleaned)) {
    const nav = /service/i.test(cleaned) ? "/services"
      : /booking|account/i.test(cleaned) ? "/account"
      : /about/i.test(cleaned) ? "/about"
      : "/";
    return {
      mode: "SYSTEM",
      intent: "FAQ",
      service: "",
      location: "",
      action: "NAVIGATE",
      message: isMr ? "चला, घेऊन जातो! 🏠" : "Let's go! 🏠",
      confidence: 0.9,
      provider: "static",
      rawText: "",
      navigateTo: nav,
    };
  }

  // DEFAULT — helpful generic response
  return {
    mode: "SYSTEM",
    intent: "UNKNOWN",
    service: "",
    location: "",
    action: "NONE",
    message: isMr
      ? "मी तुम्हाला सेवा शोधण्यात, बुकिंग करण्यात किंवा विक्रेत्यांबद्दल माहिती देण्यात मदत करू शकतो. काय शोधत आहात? 😊"
      : "I can help you find services, make bookings, or get info about vendors. What are you looking for? 😊",
    confidence: 0.6,
    provider: "static",
    rawText: "",
    navigateTo: "",
  };
}
