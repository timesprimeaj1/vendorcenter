import { useState, useRef, useEffect, useCallback, useId, useMemo } from "react";
import {
  X,
  Send,
  MapPin,
  Star,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Trophy,
  Zap,
  Search,
  CalendarCheck,
  Clock,
  Package,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocation as useGeoLocation } from "@/hooks/useLocation";
import { useNavigate, useLocation as useRouteLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

// ─── Types ───────────────────────────────────────────────────

interface VendorResult {
  name: string;
  vendorId: string;
  rating: string;
  distance: string;
  price_range: string;
  availability: string;
  categories: string[];
  completedBookings?: number;
  rankScore?: number;
}

interface AssistantResponse {
  intent: string;
  message: string;
  vendors: VendorResult[];
  action: string;
  followUp?: string;
  conversationId: string;
  navigateTo?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  vendors?: VendorResult[];
  action?: string;
  followUp?: string;
  timestamp: Date;
  navigateTo?: string;
}

type AssistantLanguage = "en" | "mr";

// ─── API ─────────────────────────────────────────────────────

function resolveApiBase() {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocalHost = host === "localhost" || host === "127.0.0.1";
    if (!isLocalHost) return "/api";
  }
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (!raw) return "/api";
  const base = raw.startsWith("http") ? raw : `https://${raw}`;
  return `${base.replace(/\/+$/, "")}/api`;
}

function normalizeAssistantLanguage(language?: string): AssistantLanguage {
  const normalized = language?.toLowerCase().trim();
  return normalized?.startsWith("mr") ? "mr" : "en";
}

function getAssistantFallbackMessage(lang: AssistantLanguage): string {
  return lang === "mr"
    ? "सध्या कनेक्ट होण्यात थोडी अडचण येत आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा किंवा थेट सेवा ब्राउझ करा."
    : "I'm having a bit of trouble connecting right now. Please try again in a moment, or browse our services directly!";
}

function safeLocalGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage errors.
  }
}

function safeSessionRemove(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
}

async function queryAssistant(
  message: string,
  lat?: number,
  lng?: number,
  conversationId?: string,
  currentPage?: string,
  lang?: AssistantLanguage,
): Promise<AssistantResponse> {
  const API_BASE = resolveApiBase();
  const body: Record<string, unknown> = { message };
  if (lat != null) body.lat = lat;
  if (lng != null) body.lng = lng;
  if (conversationId) body.conversationId = conversationId;
  if (currentPage) body.currentPage = currentPage;
  if (lang) body.lang = lang;

  const fallbackResponse: AssistantResponse = {
    intent: "UNKNOWN",
    message: getAssistantFallbackMessage(lang ?? "en"),
    vendors: [],
    action: "NONE",
    conversationId: conversationId || "",
  };

  const doFetch = async (): Promise<AssistantResponse> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 130_000);
    const token = safeLocalGet("customer_accessToken");

    try {
      const res = await fetch(`${API_BASE}/ai-assistant/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      let json: Record<string, unknown>;
      try {
        json = await res.json();
      } catch {
        return fallbackResponse;
      }

      if (!res.ok) {
        // Backend returned an error — return fallback instead of throwing
        return {
          ...fallbackResponse,
          message: typeof json.error === "string" && json.error.length < 200
            ? json.error
            : fallbackResponse.message,
        };
      }

      return json.data as AssistantResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  try {
    return await doFetch();
  } catch {
    // First attempt failed (network, timeout, etc.) — retry once after brief pause
    try {
      await new Promise((r) => setTimeout(r, 1500));
      return await doFetch();
    } catch {
      // Both attempts failed — return graceful fallback, never throw
      return fallbackResponse;
    }
  }
}

async function clearConversation(conversationId: string): Promise<void> {
  const API_BASE = resolveApiBase();
  await fetch(`${API_BASE}/ai-assistant/clear`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId }),
  }).catch(() => {});
}

async function getSuggestions(lang?: string): Promise<string[]> {
  const API_BASE = resolveApiBase();
  const headers: Record<string, string> = {};
  const token = safeLocalGet("customer_accessToken");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const normalizedLang = normalizeAssistantLanguage(lang);
  const url = `${API_BASE}/ai-assistant/suggestions?lang=${normalizedLang}`;
  const res = await fetch(url, { headers });
  const json = await res.json();
  return json.data ?? [];
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function VendorCenterAiLogo({ size = 40 }: { size?: number }) {
  const id = useId();
  const gMain = `${id}-main`;
  const gHighlight = `${id}-hl`;
  const gShadow = `${id}-sh`;
  const gInner = `${id}-in`;
  const gGlow = `${id}-glow`;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Outer glow ring */}
      <div
        className="absolute inset-0 rounded-full opacity-40 blur-[3px]"
        style={{
          background: "linear-gradient(135deg, hsl(34,100%,55%), hsl(337,86%,55%))",
        }}
      />
      <svg
        viewBox="0 0 40 40"
        className="h-full w-full relative z-10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* 3D gradient - main body */}
          <linearGradient id={gMain} x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="hsl(34,100%,58%)" />
            <stop offset="0.4" stopColor="hsl(15,95%,55%)" />
            <stop offset="1" stopColor="hsl(337,86%,48%)" />
          </linearGradient>
          {/* Top highlight for 3D depth */}
          <radialGradient id={gHighlight} cx="0.35" cy="0.25" r="0.6" gradientUnits="objectBoundingBox">
            <stop stopColor="white" stopOpacity="0.45" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
          {/* Bottom shadow for 3D depth */}
          <radialGradient id={gShadow} cx="0.55" cy="0.75" r="0.5" gradientUnits="objectBoundingBox">
            <stop stopColor="hsl(337,86%,30%)" stopOpacity="0.5" />
            <stop offset="1" stopColor="hsl(337,86%,30%)" stopOpacity="0" />
          </radialGradient>
          {/* Inner chat bubble gradient */}
          <linearGradient id={gInner} x1="13" y1="12" x2="27" y2="27" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" />
            <stop offset="1" stopColor="hsl(0,0%,93%)" />
          </linearGradient>
          {/* AI sparkle glow */}
          <radialGradient id={gGlow} cx="0.5" cy="0.5" r="0.5" gradientUnits="objectBoundingBox">
            <stop stopColor="hsl(34,100%,65%)" stopOpacity="0.6" />
            <stop offset="1" stopColor="hsl(34,100%,65%)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Shadow under the sphere */}
        <ellipse cx="20" cy="37" rx="12" ry="2" fill="black" opacity="0.12" />

        {/* Main 3D sphere */}
        <circle cx="20" cy="20" r="18" fill={`url(#${gMain})`} />
        {/* 3D highlight overlay */}
        <circle cx="20" cy="20" r="18" fill={`url(#${gHighlight})`} />
        {/* 3D shadow overlay */}
        <circle cx="20" cy="20" r="18" fill={`url(#${gShadow})`} />
        {/* Rim light */}
        <circle cx="20" cy="20" r="17.2" stroke="white" strokeOpacity="0.18" strokeWidth="0.8" fill="none" />
        <circle cx="20" cy="20" r="18" stroke="hsl(337,86%,35%)" strokeOpacity="0.25" strokeWidth="0.5" fill="none" />

        {/* Chat bubble with 3D drop shadow */}
        <g filter="drop-shadow(0.8px 1.5px 2px rgba(0,0,0,0.18))">
          <path
            d="M12.7 15.2C12.7 13 14.5 11.2 16.7 11.2H23.3C25.5 11.2 27.3 13 27.3 15.2V19.8C27.3 22 25.5 23.8 23.3 23.8H19.1L15.4 26.6C14.9 27 14.2 26.6 14.2 26V23.8H16.7C14.5 23.8 12.7 22 12.7 19.8V15.2Z"
            fill={`url(#${gInner})`}
          />
          <path
            d="M12.7 15.2C12.7 13 14.5 11.2 16.7 11.2H23.3C25.5 11.2 27.3 13 27.3 15.2V19.8C27.3 22 25.5 23.8 23.3 23.8H19.1L15.4 26.6C14.9 27 14.2 26.6 14.2 26V23.8H16.7C14.5 23.8 12.7 22 12.7 19.8V15.2Z"
            stroke="white"
            strokeOpacity="0.3"
            strokeWidth="0.4"
            fill="none"
          />
        </g>

        {/* AI sparkle dots (replaces checkmark for AI feel) */}
        <circle cx="17" cy="17.5" r="1.3" fill={`url(#${gMain})`} opacity="0.9" />
        <circle cx="20" cy="17.5" r="1.3" fill={`url(#${gMain})`} opacity="0.7" />
        <circle cx="23" cy="17.5" r="1.3" fill={`url(#${gMain})`} opacity="0.9" />
        {/* Animated thinking line */}
        <rect x="16" y="20.5" width="8" height="1.2" rx="0.6" fill={`url(#${gMain})`} opacity="0.35" />

        {/* Top-left specular highlight */}
        <circle cx="13" cy="13" r="3.5" fill="white" opacity="0.18" />
        <circle cx="14" cy="12" r="1.5" fill="white" opacity="0.3" />
      </svg>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="mr-auto flex items-center gap-3 rounded-2xl rounded-bl-sm bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-gradient-to-br from-primary to-[hsl(340,82%,52%)] animate-bounce [animation-delay:0ms] shadow-sm shadow-primary/30" />
        <span className="h-2 w-2 rounded-full bg-gradient-to-br from-primary to-[hsl(340,82%,52%)] animate-bounce [animation-delay:150ms] shadow-sm shadow-primary/30" />
        <span className="h-2 w-2 rounded-full bg-gradient-to-br from-primary to-[hsl(340,82%,52%)] animate-bounce [animation-delay:300ms] shadow-sm shadow-primary/30" />
      </div>
      <span className="text-xs text-muted-foreground/70 font-medium">{label}</span>
    </div>
  );
}

function WelcomeCard({ onSuggestionClick, suggestions }: { onSuggestionClick: (s: string) => void; suggestions: string[] }) {
  const { t } = useTranslation("chat");
  return (
    <div className="space-y-4">
      {/* Welcome hero */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/[0.08] via-transparent to-[hsl(340,82%,52%)]/[0.06] p-5 border border-white/[0.08] backdrop-blur-sm relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-[hsl(340,82%,52%)]/10 blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <VendorCenterAiLogo size={44} />
            <div>
              <p className="text-sm font-bold text-foreground tracking-tight">{t("title")}</p>
              <p className="text-[11px] text-muted-foreground/70">{t("tagline")}</p>
            </div>
          </div>
          <p className="text-[13px] text-foreground/75 leading-relaxed">
            {t("welcomeMessage")}
          </p>
          {/* Feature pills */}
          <div className="mt-3.5 flex flex-wrap gap-2">
            {[
              { icon: Search, label: t("features.findServices") },
              { icon: Star, label: t("features.topRated") },
              { icon: CalendarCheck, label: t("features.bookInstantly") },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] backdrop-blur-sm px-3 py-1.5 text-[11px] font-medium text-muted-foreground/80 border border-white/[0.08] shadow-sm">
                <Icon className="h-3 w-3 text-primary" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-1">{t("tryAsking")}</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onSuggestionClick(s)}
                className="group rounded-full border border-white/[0.1] bg-white/[0.04] backdrop-blur-sm px-3.5 py-2 text-xs text-foreground/80 transition-all duration-200 hover:border-primary/30 hover:bg-primary/[0.08] hover:shadow-md hover:shadow-primary/5 active:scale-95"
              >
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-primary/40 group-hover:text-primary transition-colors" />
                  {s}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VendorCard({ vendor, rank, onClick }: { vendor: VendorResult; rank: number; onClick: () => void }) {
  const { t } = useTranslation("chat");
  const ratingNum = parseFloat(vendor.rating) || 0;
  const ratingPct = Math.min((ratingNum / 5) * 100, 100);

  return (
    <button
      onClick={onClick}
      className="group w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-3.5 text-left transition-all duration-300 hover:border-primary/25 hover:bg-white/[0.08] hover:shadow-lg hover:shadow-primary/5 active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Rank badge */}
          {rank < 3 ? (
            <span className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white shadow-md",
              rank === 0 && "bg-gradient-to-br from-yellow-400 to-amber-600 shadow-yellow-500/25",
              rank === 1 && "bg-gradient-to-br from-slate-300 to-slate-500 shadow-slate-400/25",
              rank === 2 && "bg-gradient-to-br from-amber-600 to-amber-800 shadow-amber-600/25",
            )}>
              {rank + 1}
            </span>
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08] text-[10px] font-semibold text-muted-foreground/70">
              {rank + 1}
            </span>
          )}
          <p className="text-sm font-medium text-foreground truncate">{vendor.name}</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>

      {/* Rating bar */}
      <div className="mt-2.5 flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 drop-shadow-[0_0_3px_rgba(234,179,8,0.4)]" />
          <span className="text-xs font-bold text-foreground">{vendor.rating}</span>
        </div>
        <div className="h-1.5 flex-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 transition-all duration-700 shadow-sm shadow-yellow-500/20"
            style={{ width: `${ratingPct}%` }}
          />
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground/70">
        {vendor.distance !== "Distance unavailable" && vendor.distance !== "N/A" && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {vendor.distance}
          </span>
        )}
        <span>{vendor.price_range}</span>
        {vendor.completedBookings != null && vendor.completedBookings > 0 && (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            {vendor.completedBookings} {t("completed")}
          </span>
        )}
        {vendor.rankScore != null && vendor.rankScore > 0 && (
          <span className="flex items-center gap-1">
            <Trophy className="h-3 w-3 text-primary" />
            {vendor.rankScore.toFixed(1)}
          </span>
        )}
      </div>

      {/* Category tags */}
      {vendor.categories.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {vendor.categories.slice(0, 3).map((cat) => (
            <span
              key={cat}
              className="rounded-full bg-primary/[0.08] px-2.5 py-0.5 text-[10px] font-semibold text-primary/70 border border-primary/[0.12]"
            >
              {cat}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// ─── Rich Message Renderer ───────────────────────────────────

/** Formats AI message text with basic styling: bold, line breaks, bullet points */
function FormattedMessage({ text }: { text: string }) {
  const parts = useMemo(() => {
    // Split by newlines, process each line
    return text.split("\n").map((line, lineIdx) => {
      // Bullet point lines
      const bulletMatch = line.match(/^[•\-\*]\s+(.+)/);
      if (bulletMatch) {
        return (
          <div key={lineIdx} className="flex gap-2 pl-1 py-0.5">
            <span className="text-primary mt-0.5 shrink-0">•</span>
            <span>{processInlineFormatting(bulletMatch[1])}</span>
          </div>
        );
      }

      // Numbered list lines
      const numberedMatch = line.match(/^(\d+)[.)]\s+(.+)/);
      if (numberedMatch) {
        return (
          <div key={lineIdx} className="flex gap-2 pl-1 py-0.5">
            <span className="text-primary/70 font-medium shrink-0">{numberedMatch[1]}.</span>
            <span>{processInlineFormatting(numberedMatch[2])}</span>
          </div>
        );
      }

      // Empty line = paragraph break
      if (!line.trim()) {
        return <div key={lineIdx} className="h-1.5" />;
      }

      return <p key={lineIdx}>{processInlineFormatting(line)}</p>;
    });
  }, [text]);

  return <div className="space-y-0.5">{parts}</div>;
}

function processInlineFormatting(text: string): React.ReactNode {
  // Process **bold** text
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  if (segments.length <= 1) return text;

  return segments.map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return <strong key={i} className="font-semibold">{seg.slice(2, -2)}</strong>;
    }
    return seg;
  });
}

/** Booking status badge */
function BookingStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    confirmed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    in_progress: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    completed: "bg-green-500/10 text-green-600 border-green-500/20",
    cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
  };
  const label = status.replace(/_/g, " ");
  return (
    <span className={cn(
      "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium border capitalize",
      styles[status] || "bg-muted text-muted-foreground border-border",
    )}>
      {label}
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "",
  timestamp: new Date(),
};

const CHAT_STORAGE_KEY = "vc_ai_chat_messages";
const CHAT_CONV_KEY = "vc_ai_chat_conv_id";

function getChatScope(scope: string, lang: AssistantLanguage): string {
  return `${scope}:lang:${lang}`;
}

function getAuthScope(): string {
  const token = safeLocalGet("customer_accessToken");
  if (!token) return "guest";

  try {
    const payload = JSON.parse(atob(token.split(".")[1] || "")) as Record<string, unknown>;
    const uid = String(payload.id || payload.sub || payload.userId || "").trim();
    return uid ? `user:${uid}` : "guest";
  } catch {
    return "guest";
  }
}

function scopedStorageKey(baseKey: string, scope: string): string {
  return `${baseKey}:${scope}`;
}

function loadSavedMessages(scope: string): ChatMessage[] {
  try {
    const raw = safeSessionGet(scopedStorageKey(CHAT_STORAGE_KEY, scope));
    if (raw) {
      const parsed = JSON.parse(raw) as ChatMessage[];
      // Restore Date objects
      return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
    }
  } catch { /* ignore corrupt data */ }
  return [WELCOME_MESSAGE];
}

export default function AiAssistantChat() {
  const { t, i18n } = useTranslation("chat");
  const assistantLanguage = normalizeAssistantLanguage(i18n.resolvedLanguage || i18n.language);
  const initialAuthScope = getAuthScope();
  const [authScope, setAuthScope] = useState<string>(initialAuthScope);
  const chatScope = getChatScope(authScope, assistantLanguage);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadSavedMessages(getChatScope(initialAuthScope, assistantLanguage)));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(
    () => safeSessionGet(scopedStorageKey(CHAT_CONV_KEY, getChatScope(initialAuthScope, assistantLanguage))) || undefined,
  );
  const [isClosing, setIsClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeChatScopeRef = useRef(chatScope);
  const { location } = useGeoLocation();
  const navigate = useNavigate();
  const routeLocation = useRouteLocation();

  useEffect(() => {
    activeChatScopeRef.current = chatScope;
    setLoading(false);
    setInput("");
  }, [chatScope]);

  useEffect(() => {
    const syncScope = () => {
      const nextScope = getAuthScope();
      setAuthScope((prev) => (prev === nextScope ? prev : nextScope));
    };

    syncScope();
    const intervalId = window.setInterval(syncScope, 1500);
    window.addEventListener("focus", syncScope);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncScope);
    };
  }, []);

  useEffect(() => {
    const nextMessages = loadSavedMessages(chatScope);
    const nextConversationId = safeSessionGet(scopedStorageKey(CHAT_CONV_KEY, chatScope)) || undefined;
    setMessages(nextMessages);
    setConversationId(nextConversationId);
  }, [chatScope]);

  useEffect(() => {
    if (open && suggestions.length === 0) {
      getSuggestions(assistantLanguage).then(setSuggestions).catch(() => {});
    }
  }, [open, suggestions.length, assistantLanguage]);

  // Reload suggestions when language changes
  useEffect(() => {
    if (open) {
      getSuggestions(assistantLanguage).then(setSuggestions).catch(() => {});
    }
  }, [open, assistantLanguage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading]);

  // Persist chat to sessionStorage
  useEffect(() => {
    safeSessionSet(scopedStorageKey(CHAT_STORAGE_KEY, chatScope), JSON.stringify(messages));
  }, [messages, chatScope]);

  useEffect(() => {
    const key = scopedStorageKey(CHAT_CONV_KEY, chatScope);
    if (conversationId) safeSessionSet(key, conversationId);
    else safeSessionRemove(key);
  }, [conversationId, chatScope]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 350);
  }, [open]);

  // Always start minimized after a page refresh/mount.
  useEffect(() => {
    setOpen(false);
    setIsClosing(false);
  }, []);

  // Minimize chat when user navigates to other pages/activities.
  useEffect(() => {
    setOpen(false);
    setIsClosing(false);
  }, [routeLocation.pathname]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
    }, 200);
  }, []);

  // Escape key to close the chat panel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        handleClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  const startNewChat = useCallback(() => {
    if (conversationId) clearConversation(conversationId);
    setConversationId(undefined);
    setMessages([{ ...WELCOME_MESSAGE, id: `welcome-${Date.now()}`, timestamp: new Date() }]);
    safeSessionRemove(scopedStorageKey(CHAT_STORAGE_KEY, chatScope));
    safeSessionRemove(scopedStorageKey(CHAT_CONV_KEY, chatScope));
  }, [conversationId, chatScope]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      const requestScope = chatScope;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const result = await queryAssistant(
          trimmed,
          location?.latitude,
          location?.longitude,
          conversationId,
          routeLocation.pathname,
          assistantLanguage,
        );

        if (activeChatScopeRef.current !== requestScope) return;

        if (result.conversationId) setConversationId(result.conversationId);

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: result.message || t("errorMessage"),
          vendors: result.vendors,
          action: result.action,
          followUp: result.followUp,
          navigateTo: result.navigateTo,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        if (activeChatScopeRef.current !== requestScope) return;
        // Defensive: queryAssistant should never throw, but just in case
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant" as const,
            text: getAssistantFallbackMessage(assistantLanguage),
            timestamp: new Date(),
          },
        ]);
      } finally {
        if (activeChatScopeRef.current === requestScope) {
          setLoading(false);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      }
    },
    [loading, location, conversationId, routeLocation.pathname, assistantLanguage, t, chatScope],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const isWelcomeOnly = messages.length === 1 && messages[0].id.startsWith("welcome");

  return (
    <>
      {/* ── Floating trigger ── */}
      <button
        onClick={() => (open ? handleClose() : setOpen(true))}
        className={cn(
          "fixed z-50 flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300",
          "bg-gradient-to-br from-primary via-[hsl(15,95%,55%)] to-[hsl(340,82%,52%)] text-white",
          "shadow-[0_8px_32px_-4px_rgba(239,108,0,0.45),0_0_0_1px_rgba(255,255,255,0.12)_inset]",
          "hover:shadow-[0_12px_40px_-4px_rgba(239,108,0,0.55),0_0_0_1px_rgba(255,255,255,0.18)_inset] hover:scale-105",
          "active:scale-95",
        )}
        style={{ right: "1.5rem", bottom: "1.5rem", left: "auto" }}
        aria-label={open ? t("closeAssistant") : t("openAssistant")}
      >
        {!open && (
          <span className="absolute inset-0 rounded-full animate-ping bg-primary/25" style={{ animationDuration: "2.5s" }} />
        )}
          <VendorCenterAiLogo size={32} />
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div
          className={cn(
            "fixed z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-3xl overflow-hidden sm:w-[420px]",
            "border border-white/[0.08]",
            "bg-background/[0.92] backdrop-blur-2xl",
            "shadow-[0_32px_80px_-16px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)_inset]",
            isClosing ? "animate-out fade-out-0 slide-out-to-bottom-4 duration-200" : "animate-in fade-in-0 slide-in-from-bottom-4 duration-300",
          )}
          style={{ height: "min(640px, calc(100vh - 8rem))", right: "1.5rem", bottom: "6rem", left: "auto" }}
        >
          {/* ── Header ── */}
          <div
            className="flex items-center gap-3 px-4 py-3.5 text-white relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, hsl(25,95%,53%) 0%, hsl(15,95%,52%) 40%, hsl(340,82%,52%) 100%)" }}
          >
            {/* Header shimmer overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-black/20" />
            <VendorCenterAiLogo size={32} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">{t("title")}</p>
              <p className="text-[11px] opacity-75 leading-tight">
                {loading ? t("thinking") : location ? t("connected") : t("readyToHelp")}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {location && (
                <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px]">
                  <MapPin className="h-2.5 w-2.5" />
                  {t("live")}
                </span>
              )}
              <button
                onClick={startNewChat}
                className="rounded-lg p-1.5 transition-colors hover:bg-white/20 active:bg-white/30"
                title={t("newConversation")}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleClose}
                className="rounded-lg p-1.5 transition-colors hover:bg-white/20 active:bg-white/30"
                title={t("closeAssistant")}
                aria-label={t("closeAssistant")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ── Messages area ── */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth" style={{ background: "radial-gradient(ellipse at 20% 0%, hsl(25,95%,53%,0.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, hsl(340,82%,52%,0.04) 0%, transparent 60%)" }}>
            {isWelcomeOnly ? (
              <WelcomeCard onSuggestionClick={send} suggestions={suggestions} />
            ) : (
              <>
                {messages.filter((m) => m.id !== "welcome" && !m.id.startsWith("welcome-")).map((msg) => (
                  <div key={msg.id} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                    {/* Message bubble */}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                        msg.role === "user"
                          ? "ml-auto bg-gradient-to-br from-primary via-[hsl(15,95%,55%)] to-[hsl(340,82%,52%)] text-white rounded-br-sm shadow-[0_4px_16px_-4px_rgba(239,108,0,0.35)]"
                          : "mr-auto bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] text-foreground rounded-bl-sm shadow-sm",
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <FormattedMessage text={msg.text} />
                      ) : (
                        <span className="whitespace-pre-wrap">{msg.text}</span>
                      )}
                    </div>

                    {/* Timestamp */}
                    <p className={cn(
                      "mt-0.5 text-[10px] text-muted-foreground/50",
                      msg.role === "user" ? "text-right mr-1" : "ml-1",
                    )}>
                      {formatTime(msg.timestamp)}
                    </p>

                    {/* Vendor cards */}
                    {msg.vendors && msg.vendors.length > 0 && (
                      <div className="mt-2 space-y-2 mr-auto max-w-[95%]">
                        {msg.vendors.map((v, idx) => (
                          <VendorCard
                            key={v.vendorId}
                            vendor={v}
                            rank={idx}
                            onClick={() => {
                              navigate(`/vendor/${v.vendorId}`);
                              setOpen(false);
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Quick service browse for SHOW_CATEGORIES actions */}
                    {msg.action === "SHOW_CATEGORIES" && msg.role === "assistant" && (
                      <div className="mt-2.5 mr-auto max-w-[95%] flex flex-wrap gap-1.5">
                        {(["cleaning", "plumbing", "electrical", "acRepair", "salon", "painting"] as const).map((catKey) => (
                          <button
                            key={catKey}
                            onClick={() => send(t("findNearMe", { category: t(`quickCategories.${catKey}`).toLowerCase() }))}
                            className="group rounded-full border border-white/[0.1] bg-white/[0.05] backdrop-blur-sm px-3 py-1.5 text-[11px] font-semibold text-foreground/80 transition-all hover:border-primary/30 hover:bg-primary/[0.08] hover:text-foreground hover:shadow-md hover:shadow-primary/5 active:scale-95"
                          >
                            <span className="flex items-center gap-1.5">
                              <ChevronRight className="h-3 w-3 text-primary/40 group-hover:text-primary transition-colors" />
                              {t(`quickCategories.${catKey}`)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Booking action buttons for MY_BOOKINGS */}
                    {msg.action === "SHOW_MY_BOOKINGS" && msg.role === "assistant" && (
                      <div className="mt-2.5 mr-auto max-w-[95%]">
                        <button
                          onClick={() => {
                            navigate("/account");
                            setOpen(false);
                          }}
                          className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.05] backdrop-blur-sm px-3.5 py-2 text-xs font-semibold text-primary/90 transition-all hover:bg-primary/[0.08] hover:border-primary/25 hover:shadow-md hover:shadow-primary/8 active:scale-95"
                        >
                          <Package className="h-3.5 w-3.5" />
                          {t("viewAllBookings")}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Navigation action button */}
                    {msg.action === "NAVIGATE" && msg.navigateTo && msg.role === "assistant" && (
                      <div className="mt-2 mr-auto max-w-[95%]">
                        <button
                          onClick={() => {
                            navigate(msg.navigateTo!);
                            setOpen(false);
                          }}
                          className="flex items-center gap-2 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-2.5 text-xs font-semibold text-primary transition-all hover:from-primary/15 hover:to-primary/10 hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 active:scale-95"
                        >
                          <ArrowRight className="h-4 w-4" />
                          {t("navigation.goTo", { page: msg.navigateTo === "/" ? t("navigation.home") : msg.navigateTo === "/services" ? t("navigation.services") : msg.navigateTo === "/account" ? t("navigation.myAccount") : msg.navigateTo === "/about" ? t("navigation.about") : msg.navigateTo === "/login" ? t("navigation.login") : msg.navigateTo === "/register" ? t("navigation.register") : t("navigation.page") })}
                          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                        </button>
                      </div>
                    )}

                    {/* Follow-up question */}
                    {msg.followUp && (
                      <button
                        onClick={() => send(msg.followUp!)}
                        className="mt-2 mr-auto flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] backdrop-blur-sm px-3.5 py-1.5 text-xs text-primary/80 font-medium transition-all hover:bg-primary/[0.08] hover:border-primary/25 hover:shadow-md hover:shadow-primary/5 active:scale-95"
                      >
                        <Zap className="h-3 w-3" />
                        {msg.followUp}
                      </button>
                    )}
                  </div>
                ))}

                {/* Suggestions for early conversation */}
                {messages.length <= 3 && !loading && suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="group rounded-full border border-white/[0.1] bg-white/[0.04] backdrop-blur-sm px-3.5 py-2 text-xs text-foreground/80 transition-all duration-200 hover:border-primary/30 hover:bg-primary/[0.08] hover:shadow-md hover:shadow-primary/5 active:scale-95"
                      >
                        <span className="flex items-center gap-1.5">
                          <Zap className="h-3 w-3 text-primary/40 group-hover:text-primary transition-colors" />
                          {s}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Typing indicator */}
            {loading && <TypingIndicator label={t("thinking")} />}
          </div>

          {/* ── Input bar ── */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2.5 border-t border-white/[0.07] bg-white/[0.03] backdrop-blur-sm px-3.5 py-3"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("inputPlaceholder")}
                disabled={loading}
                className="w-full rounded-2xl border border-white/[0.1] bg-white/[0.05] px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground/50 disabled:opacity-50 transition-all focus:border-primary/30 focus:bg-white/[0.08] focus:shadow-[0_0_0_3px_rgba(239,108,0,0.08)]"
                maxLength={500}
              />
            </div>
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || loading}
              className={cn(
                "h-9 w-9 shrink-0 rounded-xl transition-all duration-200",
                input.trim()
                  ? "bg-gradient-to-br from-primary to-[hsl(340,82%,52%)] text-white shadow-[0_4px_12px_-2px_rgba(239,108,0,0.4)] hover:shadow-[0_6px_16px_-2px_rgba(239,108,0,0.5)] hover:scale-105"
                  : "bg-white/[0.05] border border-white/[0.08] text-muted-foreground/40",
              )}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
