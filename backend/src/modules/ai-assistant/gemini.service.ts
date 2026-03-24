import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { env } from "../../config/env.js";
import type { Action, AssistantDecision, ConversationTurn, Intent } from "./ai-assistant.types.js";

const clientCache = new Map<string, GoogleGenerativeAI>();
const keyCooldownUntil = new Map<number, number>();
let preferredKeyIndex = 0;

const CHAT_MODE_PATTERNS = /\b(hi|hello|hey|hii|yo|hola|namaste|good\s+(morning|afternoon|evening)|how are you|what'?s up|sup)\b/i;
const MAX_HISTORY = 20;
const conversations = new Map<string, ConversationTurn[]>();

const systemDecisionSchema = z.object({
  intent: z.enum(["GREETING", "SERVICE_SEARCH", "RECOMMENDATION", "BOOKING", "FAQ", "UNKNOWN"]),
  service: z.string().catch(""),
  location: z.string().catch(""),
  action: z.enum(["SHOW_RESULTS", "GET_RECOMMENDATIONS", "BOOK_SERVICE", "ASK_LOCATION", "ASK_DETAILS", "NONE"]),
  navigateTo: z.string().catch(""),
  message: z.string().min(1),
  confidence: z.coerce.number().min(0).max(1),
});

const SYSTEM_PROMPT = `You are a senior AI backend + system integration controller for VendorCenter.

SYSTEM GOAL:
- Handle normal chat like hi and hello.
- Detect user intent.
- Trigger backend actions.
- Use Gemini as primary AI.
- Use Groq as fallback if Gemini fails.

RESPONSE MODES:
1. CHAT MODE:
- Use for greetings and casual talk.
- Return short, friendly plain text only.
- Never return JSON in chat mode.

2. SYSTEM MODE:
- Use for real service queries, recommendations, booking, FAQ, abusive input, or unknown requests.
- Return STRICT JSON only in this exact format:
{
  "intent": "",
  "service": "",
  "location": "",
  "action": "",
  "message": "",
  "confidence": 0.0
}

VALID INTENTS:
- GREETING
- SERVICE_SEARCH
- RECOMMENDATION
- BOOKING
- FAQ
- UNKNOWN

VALID ACTIONS:
- SHOW_RESULTS
- GET_RECOMMENDATIONS
- BOOK_SERVICE
- ASK_LOCATION
- ASK_DETAILS
- NONE

RULES:
- Every input must be analyzed freshly.
- Never return the same generic reply for different user inputs.
- Do not invent vendor names or vendor data.
- Backend handles vendor lookup and ranking.
- For abusive input, use intent UNKNOWN, action NONE, and calmly redirect to services.
- Greeting responses must be plain text, short, and human.
- System mode responses must be JSON only, no markdown, no code fences.
- Confidence must be a number from 0 to 1.`;

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
  return /429|quota exceeded|too many requests|rate.limit|rate-limit|403|401|api key not valid|permission denied/i.test(message);
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

function buildUserInstruction(userMessage: string, chatMode: boolean): string {
  if (chatMode) {
    return `MODE: CHAT\nUSER_INPUT: ${userMessage}\nReturn only short friendly plain text. Do not return JSON.`;
  }

  return `MODE: SYSTEM\nUSER_INPUT: ${userMessage}\nReturn only strict JSON. No markdown. No code fences.`;
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

async function callGeminiProvider(userMessage: string, history: ConversationTurn[], chatMode: boolean): Promise<string> {
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

      const result = await chat.sendMessage(buildUserInstruction(userMessage, chatMode));
      const text = result.response.text();
      preferredKeyIndex = keyIndex;
      keyCooldownUntil.delete(keyIndex);
      return text;
    } catch (error) {
      lastError = error;
      console.warn(`[gemini] Key ${keyIndex + 1} failed`);

      if (isRetryableGeminiError(error)) {
        markKeyCooldown(keyIndex, error);
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new Error("All Gemini API keys failed");
}

async function callGroqProvider(userMessage: string, history: ConversationTurn[], chatMode: boolean): Promise<string> {
  if (!env.groqApiKey) {
    throw new Error("Groq API key not configured");
  }

  console.log(`[groq] Calling model=${env.groqModel} history=${history.length}`);
  const response = await fetch(`${env.groqBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.groqApiKey}`,
    },
    body: JSON.stringify({
      model: env.groqModel,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...mapHistoryForGroq(history),
        { role: "user", content: buildUserInstruction(userMessage, chatMode) },
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
}

export async function callAssistantModel(userMessage: string, history: ConversationTurn[]): Promise<AssistantDecision> {
  const chatMode = shouldUseChatMode(userMessage);
  let lastError: unknown;

  if (getGeminiApiKeys().length > 0) {
    try {
      const rawText = await callGeminiProvider(userMessage, history, chatMode);
      return normalizeResponse(rawText, "gemini", chatMode);
    } catch (error) {
      lastError = error;
      console.warn("[assistant-ai] Gemini failed, trying Groq fallback");
    }
  }

  if (env.groqApiKey) {
    const rawText = await callGroqProvider(userMessage, history, chatMode);
    return normalizeResponse(rawText, "groq", chatMode);
  }

  throw lastError ?? new Error("No AI provider configured");
}
