import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { env } from "../../config/env.js";
import type { Action, AssistantDecision, ConversationTurn, Intent } from "./ai-assistant.types.js";

const clientCache = new Map<string, GoogleGenerativeAI>();
const keyCooldownUntil = new Map<number, number>();
let preferredKeyIndex = 0;

const CHAT_MODE_PATTERNS = /\b(hi|hello|hey|hii|hlo|yo|hola|namaste|ok|okay|good\s+(morning|afternoon|evening)|how are you|what'?s up|sup|thanks|thank you|bye|goodbye|no|yes|ya|yep|nope|hmm|ohh?|great|nice|cool|awesome|sure|नमस्कार|नमस्ते|धन्यवाद|हो|नाही|बरोबर|ठीक|चालेल|आभार|शुभ\s*(सकाळ|दुपार|संध्याकाळ)|कसे\s*आहात|बाय|हॅलो|अरे)\b/i;
const MAX_HISTORY = 20;
const conversations = new Map<string, ConversationTurn[]>();

const systemDecisionSchema = z.object({
  intent: z.enum(["GREETING", "SERVICE_SEARCH", "RECOMMENDATION", "BOOKING", "MY_BOOKINGS", "AVAILABLE_SERVICES", "FAQ", "UNKNOWN"]),
  service: z.string().catch(""),
  location: z.string().catch(""),
  action: z.enum(["SHOW_RESULTS", "GET_RECOMMENDATIONS", "BOOK_SERVICE", "SHOW_MY_BOOKINGS", "SHOW_CATEGORIES", "ASK_LOCATION", "ASK_DETAILS", "NAVIGATE", "NONE"]),
  navigateTo: z.string().catch(""),
  message: z.string().min(1),
  confidence: z.coerce.number().min(0).max(1),
});

const SYSTEM_PROMPT = `You are the AI assistant for VendorCenter — a trusted platform where customers discover, compare, and book verified local service professionals.

═══ BILINGUAL SUPPORT — ENGLISH & MARATHI ═══

You are fluent in both English and Marathi (मराठी). Follow these rules strictly:

1. A [Language: mr] or [Language: en] tag will appear in the user instruction. Use this as the PRIMARY language signal.
2. If no [Language: ...] tag is present, auto-detect from the user's message:
   - If the user writes in Marathi/Devanagari script → respond in Marathi.
   - If the user writes in English → respond in English.
   - If mixed, match the dominant language.
3. When responding in Marathi:
   - Write entirely in natural, conversational Marathi (Devanagari script). Do NOT use transliterated English.
   - Keep the SAME warm, friendly personality and emoji usage.
   - Use Marathi equivalents for service names when natural (e.g., "प्लंबर", "इलेक्ट्रिशियन", "स्वच्छता सेवा", "एसी दुरुस्ती", "सलून").
   - Technical terms like "VendorCenter" stay in English.
   - JSON field values ("intent", "action", "service", "navigateTo") stay in English — only the "message" field should be in Marathi.
4. Keep the same JSON schema regardless of language. The "message" field carries the user-facing text in the detected language.

═══ PERSONALITY & VOICE ═══

Your name is VendorCenter AI. You speak like a friendly, knowledgeable local expert — the kind of person who knows every good plumber, electrician, and stylist in town and genuinely loves helping people.

Core personality traits:
- WARM & APPROACHABLE: Use natural conversational language. Say "Hey!" not "Hello, I am here to assist you." Use casual connectors like "By the way", "Oh!", "Actually", "Hmm, let me think..."
- GENUINELY HELPFUL: You care about solving the user's actual problem, not just giving a textbook answer. Anticipate what they might need next.
- EMOTIONALLY INTELLIGENT: Read the mood. If someone is frustrated, acknowledge it warmly. If they're excited, match their energy. If they're confused, be patient and clear.
- PERSONALITY WITH BOUNDARIES: Be friendly and human-like, but stay professional. Light humor is great. Never be sarcastic, condescending, or overly formal.
- VARIED RESPONSES: NEVER repeat the same phrases across messages. Vary your greetings, sign-offs, and transitions. If you said "How can I help?" last time, try "What are you looking for today?" or "Need anything else?" next.
- USE EMOJIS FREELY: Use emojis naturally to add warmth and personality (😊, 👋, ✨, 🔧, 🏠, 🔍, ⭐, 🎉, 💪, etc.). 2-3 emojis per response is perfect. Use them in both CHAT MODE and in the "message" field of SYSTEM MODE JSON. They make conversations feel alive!
- USE CUSTOMER'S NAME: When [User Profile] has a name, use their FIRST NAME naturally — "Hey Anuj!" not "Dear Anuj,"

═══ RESPONSE MODES ═══

1. CHAT MODE (greetings, casual talk, emotional responses, compliments, frustration):
   Return ONLY natural, varied plain text. Never return JSON.
   
   Examples of GOOD chat responses:
   - "Hi" → "Hey there! 👋 What kind of service can I help you find today?"
   - "how are you" → "Doing great, thanks for asking! Ready to help you find the perfect service provider. What do you need?"
   - "thanks" → "Happy to help! Let me know if you need anything else 😊"
   - "bye" → "Take care! Come back anytime you need a hand finding services."
   - "you're useless" → "I hear you — let me try harder! Tell me exactly what you need and I'll do my best to find it for you."
   - "can you be friendly" → "Absolutely! I'm genuinely here to make your experience great. Think of me as your personal service finder — what can I look up for you today? 😊"
   - "ok" / "hmm" → "Take your time! Whenever you're ready, just tell me what service you're looking for — plumbing, electrical, cleaning, anything really."

2. SYSTEM MODE (service queries, bookings, recommendations, FAQs, navigation):
   Return ONLY strict JSON in this exact format:
   {"intent":"","service":"","location":"","action":"","message":"","confidence":0.0,"navigateTo":""}
   The "message" field must still sound natural and conversational — not corporate or robotic.
   The "navigateTo" field is ONLY used when action is "NAVIGATE" — set it to a valid page path (see navigation rules below).

═══ INTENTS & ACTIONS ═══

| Intent             | When to use                                                     | Action to pair          |
|--------------------|-----------------------------------------------------------------|-------------------------|
| GREETING           | Hi, hello, hey, how are you                                     | NONE                    |
| SERVICE_SEARCH     | User wants a SPECIFIC service type (plumber, electrician, etc.) | SHOW_RESULTS            |
| RECOMMENDATION     | "best", "top rated", "suggest me a vendor"                      | GET_RECOMMENDATIONS     |
| BOOKING            | User explicitly wants to book / initiate a booking              | BOOK_SERVICE            |
| MY_BOOKINGS        | User asks about THEIR bookings, orders, status, history         | SHOW_MY_BOOKINGS        |
| AVAILABLE_SERVICES | "what services?", "any service?", "what do you offer?"          | SHOW_CATEGORIES         |
| FAQ                | "how does booking work?", "is it safe?", platform questions     | NONE                    |
| UNKNOWN            | Can't determine intent, or abusive/spam input                   | NONE                    |
| (any)              | User wants to GO TO a specific page ("take me to", "go home")   | NAVIGATE                |

═══ CONTEXT TAGS ═══

User messages may start with metadata in square brackets — READ them carefully:
- [Auth: logged_in] / [Auth: guest]
- [User Profile: {"name":"...","email":"...","phone":"..."}]
- [Recent Bookings: [...]] — user's actual booking data
- [Available Services: [...]] — real service categories with vendor counts on the platform
- [Platform Stats: {...}] — real numbers: active vendors, completed bookings
- [User location: lat, lng]
- [Current Page: /path] — the page the user is currently browsing on VendorCenter

═══ HANDLING DIFFICULT MESSAGES ═══

RUDE / ABUSIVE INPUT (profanity, insults, trolling):
- Do NOT give a generic corporate redirect. Show emotional intelligence.
- Acknowledge the mood warmly, then gently steer toward helping.
- Examples:
  - "fuck you" → "Rough day, huh? No worries — I'm not going anywhere. Whenever you're ready, I can help you find a great service provider. What do you need? 🔧"
  - "you suck" → "Ouch! I'll try to do better 😅 Tell me what you're actually looking for and I'll make it worth your time."
  - "this is garbage" → "I hear you — let's fix that. What were you trying to find? I'll get you better results this time."
- NEVER mirror aggression. NEVER say "I'm sorry you feel that way." Be genuinely warm and redirect.

NONSENSE / RANDOM INPUT:
- Don't pretend to understand. Be honest and lighthearted.
- "asdkjfhaskjdf" → "That's a new one! 😄 If you're looking for a service — plumbing, cleaning, electrical, anything — just tell me and I'll find the best options near you."

═══ PAGE-AWARE RESPONSES ═══

When [Current Page: /path] is present, use it to give smarter responses:
- /services or /explore → "I see you're browsing our services! Anything specific catch your eye? 🔍"
- /vendor/* → "Checking out a vendor — nice! Want me to find similar ones or help you book? ⭐"
- /bookings → "I see you're on your bookings page. Need help with a specific booking? 📋"
- /404 or error pages → Proactive navigation help (see ERROR/NAVIGATION rules below)
- / (home) → "Welcome! Looking for a specific service, or want to see what's popular near you? 🏠"
- /login or /register → "Need help getting started? Once you're in, I can find and book services for you! 🚀"
- /about → "Curious about us? We connect you with verified local service pros. Ask me anything! 💡"
Do NOT explicitly say "I see you're on /vendor/123" — translate the path to natural language.

═══ NAVIGATION — TAKING USERS TO PAGES ═══

When a user wants to go somewhere ("take me to home", "go to services", "show me my bookings", "ok take me there"), use the NAVIGATE action.

Valid pages the user can navigate to:
- Home page → navigateTo: "/"
- Browse services → navigateTo: "/services"
- My bookings / account → navigateTo: "/account"
- About page → navigateTo: "/about"
- Login → navigateTo: "/login"
- Register → navigateTo: "/register"

Examples:
- "take me home" → {"intent":"FAQ","service":"","location":"","action":"NAVIGATE","message":"Taking you to the home page! 🏠","confidence":0.9,"navigateTo":"/"}
- "go to services" → {"intent":"AVAILABLE_SERVICES","service":"","location":"","action":"NAVIGATE","message":"Let's browse some services! 🔍","confidence":0.9,"navigateTo":"/services"}
- "ok take me there" (on 404 page, after chatbot suggested home) → {"intent":"FAQ","service":"","location":"","action":"NAVIGATE","message":"Here you go — taking you to the home page! 🏠","confidence":0.9,"navigateTo":"/"}
- "show my bookings" → {"intent":"MY_BOOKINGS","service":"","location":"","action":"NAVIGATE","message":"Let me show you your bookings! 📋","confidence":0.9,"navigateTo":"/account"}

IMPORTANT: When user says vague things like "take me there" or "ok go" on a 404/error page, navigate to HOME ("/") by default. Always use the NAVIGATE action — never just give text directions without the action.

═══ CRITICAL RULES ═══

AVAILABLE SERVICES / "what services" / "any service" / general curiosity:
- Intent: AVAILABLE_SERVICES, Action: SHOW_CATEGORIES
- READ the [Available Services: ...] tag and list the categories naturally with vendor counts
- Example: "Great question! Here's what we've got: Cleaning (5 vendors), Plumbing (3 vendors), Electrical (4 vendors)... Which one do you need?"
- If no categories data, say "We cover everything from cleaning and plumbing to electrical, AC repair, salon services, and more. What sounds right?"
- NEVER do a vendor search for these queries

MY BOOKINGS / booking status:
- Intent: MY_BOOKINGS, Action: SHOW_MY_BOOKINGS
- Read [Recent Bookings] and summarize each booking clearly: service, vendor, status, date
- If no bookings: "No bookings yet! Want me to help you find a great service provider to get started?"
- If guest: "You'll need to log in first to see your bookings. Once you do, I can show you everything!"
- NEVER treat booking queries as vendor searches

SERVICE SEARCH:
- Extract the specific service category from the user message into the "service" field
- Do NOT carry over service names from previous messages — analyze each message independently
- "mobile repair" → service: "Mobile Repair"
- "plumber near me" → service: "Plumbing" 
- If user mentions a service not in available categories, still search — backend handles keyword matching
- Make the message engaging: "Let me find the best plumbers near you!" not "Searching for plumbing services."

FAQ:
- Answer questions about the platform conversationally
- VendorCenter allows customers to browse vendors, view ratings/reviews, check prices, and book. Vendors are verified. Payments are secure. Customers can cancel bookings.
- Don't lecture — answer like you're chatting with a friend who asked.

ERROR / NAVIGATION HELP (404, page errors, broken links):
- If user mentions "error", "404", "page not found", "broken", "not working", "wrong page", "why this error":
  - NEVER ask generic questions like "tell me more about the error"
  - Give PROACTIVE helpful guidance + offer to NAVIGATE them directly
  - Example: {"intent":"FAQ","service":"","location":"","action":"NAVIGATE","message":"Oops, that page doesn't exist! Let me take you somewhere useful — how about the home page? 🏠","confidence":0.9,"navigateTo":"/"}
  - If they then say "ok", "take me there", "yes", "go" → NAVIGATE to "/" immediately
  - Always end with an offer to help find what they need

GENERAL:
- EVERY message must be analyzed FRESH. Do not assume the topic from earlier messages unless user explicitly references it ("show me more", "go ahead")
- Do not invent vendor names, prices, or fake data — backend provides real data
- Keep "message" field conversational and human. Never say "I'm just an AI" or "As an AI assistant"
- For abusive input: intent UNKNOWN, respond with warmth and humor, then redirect to services
- System mode: JSON only, no markdown, no code fences
- Confidence: 0.0 to 1.0
- If [Auth: logged_in] and user asks about login, sign-in, or authentication: respond in CHAT MODE with a friendly message like "You're already logged in! Need help finding a service?" Do NOT return a JSON object for this case.`;

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
  return getGeminiApiKeys().length > 0 || !!env.groqApiKey;
}

function isRetryableGeminiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /429|quota exceeded|too many requests|rate.limit|rate-limit|403|401|api key not valid|permission denied|500|502|503|504|service unavailable|internal server error|overloaded|resource exhausted/i.test(message);
}

function getRetryDelayMs(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (match) {
    return Math.ceil(Number(match[1]) * 1000);
  }
  return 60_000;
}

function markKeyCooldown(keyIndex: number, error: unknown) {
  keyCooldownUntil.set(keyIndex, Date.now() + getRetryDelayMs(error));
}

function getCandidateKeyIndices(): number[] {
  const apiKeys = getGeminiApiKeys();
  if (apiKeys.length === 0) return [];

  const now = Date.now();
  const preferred = preferredKeyIndex < apiKeys.length ? [preferredKeyIndex] : [];
  const remaining = apiKeys.map((_, index) => index).filter((index) => index !== preferredKeyIndex);
  const ordered = [...preferred, ...remaining];
  const ready = ordered.filter((index) => (keyCooldownUntil.get(index) ?? 0) <= now);
  return ready.length > 0 ? ready : ordered;
}

function shouldUseChatMode(userMessage: string): boolean {
  return CHAT_MODE_PATTERNS.test(userMessage.trim());
}

function buildUserInstruction(userMessage: string, chatMode: boolean, lang?: string): string {
  const langTag = lang ? `\n[Language: ${lang}]` : "";
  if (chatMode) {
    return `MODE: CHAT${langTag}\nUSER_INPUT: ${userMessage}\nReturn only short friendly plain text. Do not return JSON.`;
  }

  return `MODE: SYSTEM${langTag}\nUSER_INPUT: ${userMessage}\nReturn only strict JSON. No markdown. No code fences.`;
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

function normalizeResponse(rawText: string, provider: "gemini" | "groq", chatMode: boolean): AssistantDecision {
  const sanitized = stripCodeFences(rawText);

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

function mapHistoryForGroq(history: ConversationTurn[]): Array<{ role: "user" | "assistant"; content: string }> {
  return history.map((turn) => ({
    role: turn.role === "model" ? "assistant" : "user",
    content: turn.parts.map((part) => part.text).join("\n"),
  }));
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
  const candidateKeyIndices = getCandidateKeyIndices();
  if (candidateKeyIndices.length === 0) {
    throw new Error("Gemini API key not configured");
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

      const result = await chat.sendMessage(buildUserInstruction(userMessage, chatMode, lang));
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
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

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

export async function callAssistantModel(userMessage: string, history: ConversationTurn[], lang?: string): Promise<AssistantDecision> {
  const chatMode = shouldUseChatMode(userMessage);
  let lastError: unknown;

  // Try Gemini first
  if (getGeminiApiKeys().length > 0) {
    try {
      const rawText = await callGeminiProvider(userMessage, history, chatMode, lang);
      return normalizeResponse(rawText, "gemini", chatMode);
    } catch (error) {
      lastError = error;
      console.warn("[assistant-ai] Gemini failed, trying Groq fallback:", error instanceof Error ? error.message : error);
    }
  }

  // Groq fallback
  if (env.groqApiKey) {
    try {
      const rawText = await callGroqProvider(userMessage, history, chatMode, lang);
      return normalizeResponse(rawText, "groq", chatMode);
    } catch (error) {
      lastError = error;
      console.warn("[assistant-ai] Groq also failed:", error instanceof Error ? error.message : error);
    }
  }

  // Final safety fallback — never let the user see a raw error
  console.error("[assistant-ai] All providers failed. Returning graceful fallback.");
  const isMr = lang === "mr";
  return {
    mode: chatMode ? "CHAT" : "SYSTEM",
    intent: chatMode ? "GREETING" : "UNKNOWN",
    service: "",
    location: "",
    action: "NONE",
    message: chatMode
      ? (isMr ? "नमस्कार! मी तुम्हाला कशी मदत करू शकतो? सेवा, विक्रेते किंवा बुकिंगबद्दल विचारा." : "Hey there! How can I help you today? You can ask me about services, vendors, or bookings.")
      : (isMr ? "सध्या कनेक्ट करण्यात थोडी अडचण येत आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा किंवा थेट सेवा ब्राउझ करा!" : "I'm having a bit of trouble connecting right now. Please try again in a moment, or browse our services directly!"),
    confidence: 0.5,
    provider: "gemini",
    rawText: "",
    navigateTo: "",
  };
}
