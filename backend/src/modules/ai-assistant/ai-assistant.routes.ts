import { Router, Request, Response } from "express";
import { z } from "zod";
import { processAssistantQuery } from "./ai-assistant.service.js";
import { clearConversation } from "./provider-chain.service.js";
import { getActorFromBearerToken } from "../../middleware/auth.js";

export const aiAssistantRouter = Router();

function normalizeAssistantLanguage(value?: string): "en" | "mr" {
  const normalized = value?.toLowerCase().trim();
  return normalized?.startsWith("mr") ? "mr" : "en";
}

const querySchema = z.object({
  message: z.string().min(1).max(500),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  conversationId: z.string().uuid().optional(),
  currentPage: z.string().max(200).optional(),
  lang: z.string().max(20).optional(),
});

// POST /api/ai-assistant/query — public endpoint, optional auth for user-aware features
aiAssistantRouter.post("/query", async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const { message, lat, lng, conversationId, currentPage } = parsed.data;
  const lang = normalizeAssistantLanguage(parsed.data.lang);

  // Extract optional user identity from Bearer token (no 401 if missing)
  const actor = getActorFromBearerToken(req.header("authorization"));
  const userId = actor?.id;

  try {
    const result = await processAssistantQuery(message, lat, lng, conversationId, userId, currentPage, lang);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("[ai-assistant] query error:", err);
    res.status(500).json({
      success: false,
      error: "Something went wrong processing your request. Please try again.",
    });
  }
});

// POST /api/ai-assistant/clear — clear conversation history
aiAssistantRouter.post("/clear", (req: Request, res: Response) => {
  const { conversationId } = req.body ?? {};
  if (conversationId && typeof conversationId === "string") {
    clearConversation(conversationId);
  }
  res.json({ success: true });
});

// GET /api/ai-assistant/suggestions — returns quick-action suggestions
aiAssistantRouter.get("/suggestions", (req: Request, res: Response) => {
  const actor = getActorFromBearerToken(req.header("authorization"));
  const lang = normalizeAssistantLanguage(typeof req.query.lang === "string" ? req.query.lang : undefined);

  const suggestions: Record<string, string[]> = {
    en: [
      "Find a plumber near me",
      "Best electrician",
      "Book AC repair",
      "How does booking work?",
      "Top-rated cleaning services",
      "What services are available?",
    ],
    mr: [
      "जवळचा प्लंबर शोधा",
      "सर्वोत्तम इलेक्ट्रिशियन",
      "एसी दुरुस्ती बुक करा",
      "बुकिंग कसे काम करते?",
      "सर्वोत्तम स्वच्छता सेवा",
      "कोणत्या सेवा उपलब्ध आहेत?",
    ],
  };

  const baseSuggestions = [...suggestions[lang]];

  // Add booking-related suggestions for logged-in users
  if (actor?.id) {
    baseSuggestions.unshift(lang === "mr" ? "माझ्या बुकिंग दाखवा" : "Show my bookings");
  }

  res.json({ success: true, data: baseSuggestions });
});
