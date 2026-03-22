import { useState, useRef, useEffect, useCallback, useId } from "react";
import {
  X,
  Send,
  MapPin,
  Star,
  ArrowRight,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Trophy,
  Zap,
  Search,
  CalendarCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocation as useGeoLocation } from "@/hooks/useLocation";
import { useNavigate, useLocation as useRouteLocation } from "react-router-dom";

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
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  vendors?: VendorResult[];
  action?: string;
  followUp?: string;
  timestamp: Date;
}

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

async function queryAssistant(
  message: string,
  lat?: number,
  lng?: number,
  conversationId?: string,
): Promise<AssistantResponse> {
  const API_BASE = resolveApiBase();
  const body: Record<string, unknown> = { message };
  if (lat != null) body.lat = lat;
  if (lng != null) body.lng = lng;
  if (conversationId) body.conversationId = conversationId;

  const res = await fetch(`${API_BASE}/ai-assistant/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(localStorage.getItem("customer_accessToken")
        ? { Authorization: `Bearer ${localStorage.getItem("customer_accessToken")}` }
        : {}),
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json.data;
}

async function clearConversation(conversationId: string): Promise<void> {
  const API_BASE = resolveApiBase();
  await fetch(`${API_BASE}/ai-assistant/clear`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId }),
  }).catch(() => {});
}

async function getSuggestions(): Promise<string[]> {
  const API_BASE = resolveApiBase();
  const res = await fetch(`${API_BASE}/ai-assistant/suggestions`);
  const json = await res.json();
  return json.data ?? [];
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function VendorCenterAiLogo({ size = 40 }: { size?: number }) {
  const badgeGradientId = useId();

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 40 40"
        className="h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={badgeGradientId} x1="6" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="hsl(34,100%,53%)" />
            <stop offset="0.5" stopColor="hsl(12,93%,55%)" />
            <stop offset="1" stopColor="hsl(337,86%,51%)" />
          </linearGradient>
        </defs>
        <circle cx="20" cy="20" r="18" fill={`url(#${badgeGradientId})`} />
        <circle cx="20" cy="20" r="18" stroke="white" strokeOpacity="0.22" strokeWidth="1.2" />
        <path d="M30.8 29.8L26.9 25.9" stroke="white" strokeOpacity="0.35" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M12.7 15.5C12.7 13.3 14.5 11.5 16.7 11.5H23.3C25.5 11.5 27.3 13.3 27.3 15.5V20.3C27.3 22.5 25.5 24.3 23.3 24.3H19.1L15.4 27.1C14.9 27.5 14.2 27.1 14.2 26.5V24.3H16.7C14.5 24.3 12.7 22.5 12.7 20.3V15.5Z" fill="white" fillOpacity="0.97" />
        <path d="M17.3 18.3L19.2 20.2L22.8 16.6" stroke={`url(#${badgeGradientId})`} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="mr-auto flex items-center gap-2.5 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-xs text-muted-foreground">Thinking...</span>
    </div>
  );
}

function WelcomeCard({ onSuggestionClick, suggestions }: { onSuggestionClick: (s: string) => void; suggestions: string[] }) {
  return (
    <div className="space-y-4">
      {/* Welcome hero */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 p-4 border border-primary/10">
        <div className="flex items-center gap-3 mb-3">
          <VendorCenterAiLogo size={40} />
          <div>
            <p className="text-sm font-semibold text-foreground">VendorCenter AI</p>
            <p className="text-xs text-muted-foreground">Your personal service finder</p>
          </div>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">
          I can help you discover and book trusted local service providers. Try asking me anything!
        </p>
        {/* Feature pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { icon: Search, label: "Find services" },
            { icon: Star, label: "Top rated" },
            { icon: CalendarCheck, label: "Book instantly" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground border border-border/50">
              <Icon className="h-3 w-3 text-primary" />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 px-1">Try asking</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onSuggestionClick(s)}
                className="group rounded-full border border-primary/20 bg-background px-3 py-1.5 text-xs text-foreground transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm active:scale-95"
              >
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-primary/50 group-hover:text-primary transition-colors" />
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
  const ratingNum = parseFloat(vendor.rating) || 0;
  const ratingPct = Math.min((ratingNum / 5) * 100, 100);

  return (
    <button
      onClick={onClick}
      className="group w-full rounded-xl border bg-card p-3 text-left transition-all duration-200 hover:border-primary/40 hover:shadow-md active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Rank badge */}
          {rank < 3 ? (
            <span className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white shadow-sm",
              rank === 0 && "bg-gradient-to-br from-yellow-400 to-yellow-600",
              rank === 1 && "bg-gradient-to-br from-gray-300 to-gray-500",
              rank === 2 && "bg-gradient-to-br from-amber-600 to-amber-800",
            )}>
              {rank + 1}
            </span>
          ) : (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] font-semibold text-muted-foreground">
              {rank + 1}
            </span>
          )}
          <p className="text-sm font-medium text-foreground truncate">{vendor.name}</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>

      {/* Rating bar */}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
          <span className="text-xs font-semibold text-foreground">{vendor.rating}</span>
        </div>
        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-all duration-500"
            style={{ width: `${ratingPct}%` }}
          />
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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
            {vendor.completedBookings} completed
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
        <div className="mt-2 flex flex-wrap gap-1">
          {vendor.categories.slice(0, 3).map((cat) => (
            <span
              key={cat}
              className="rounded-md bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary/80 border border-primary/10"
            >
              {cat}
            </span>
          ))}
        </div>
      )}
    </button>
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

function getAuthScope(): string {
  const token = localStorage.getItem("customer_accessToken");
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
    const raw = sessionStorage.getItem(scopedStorageKey(CHAT_STORAGE_KEY, scope));
    if (raw) {
      const parsed = JSON.parse(raw) as ChatMessage[];
      // Restore Date objects
      return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
    }
  } catch { /* ignore corrupt data */ }
  return [WELCOME_MESSAGE];
}

export default function AiAssistantChat() {
  const [authScope, setAuthScope] = useState<string>(() => getAuthScope());
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadSavedMessages(getAuthScope()));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(
    () => sessionStorage.getItem(scopedStorageKey(CHAT_CONV_KEY, getAuthScope())) || undefined,
  );
  const [isClosing, setIsClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { location } = useGeoLocation();
  const navigate = useNavigate();
  const routeLocation = useRouteLocation();

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
    const nextMessages = loadSavedMessages(authScope);
    const nextConversationId = sessionStorage.getItem(scopedStorageKey(CHAT_CONV_KEY, authScope)) || undefined;
    setMessages(nextMessages);
    setConversationId(nextConversationId);
  }, [authScope]);

  useEffect(() => {
    if (open && suggestions.length === 0) {
      getSuggestions().then(setSuggestions).catch(() => {});
    }
  }, [open, suggestions.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading]);

  // Persist chat to sessionStorage
  useEffect(() => {
    try { sessionStorage.setItem(scopedStorageKey(CHAT_STORAGE_KEY, authScope), JSON.stringify(messages)); } catch { /* quota */ }
  }, [messages, authScope]);

  useEffect(() => {
    const key = scopedStorageKey(CHAT_CONV_KEY, authScope);
    if (conversationId) sessionStorage.setItem(key, conversationId);
    else sessionStorage.removeItem(key);
  }, [conversationId, authScope]);

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
    sessionStorage.removeItem(scopedStorageKey(CHAT_STORAGE_KEY, authScope));
    sessionStorage.removeItem(scopedStorageKey(CHAT_CONV_KEY, authScope));
  }, [conversationId, authScope]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

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
        );

        if (result.conversationId) setConversationId(result.conversationId);

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: result.message,
          vendors: result.vendors,
          action: result.action,
          followUp: result.followUp,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            text: "Sorry, something went wrong. Please try again in a moment.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [loading, location, conversationId],
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
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full transition-all duration-300",
          "shadow-lg hover:shadow-xl hover:scale-105 active:scale-95",
          "bg-gradient-to-br from-primary to-[hsl(340,82%,52%)] text-white",
          !open && "animate-pulse-glow",
        )}
        aria-label={open ? "Close assistant" : "Open assistant"}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <Sparkles className="h-5 w-5" />
        )}
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div
          className={cn(
            "fixed bottom-24 right-6 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-border/60 bg-background overflow-hidden sm:w-[420px]",
            "shadow-2xl",
            isClosing ? "animate-out fade-out-0 slide-out-to-bottom-4 duration-200" : "animate-in fade-in-0 slide-in-from-bottom-4 duration-300",
          )}
          style={{ height: "min(640px, calc(100vh - 8rem))" }}
        >
          {/* ── Header ── */}
          <div
            className="flex items-center gap-3 px-4 py-3 text-white"
            style={{ background: "linear-gradient(135deg, hsl(25,95%,53%), hsl(340,82%,52%))" }}
          >
            <VendorCenterAiLogo size={32} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">VendorCenter AI</p>
              <p className="text-[11px] opacity-75 leading-tight">
                {loading ? "Thinking..." : location ? "Connected" : "Ready to help"}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {location && (
                <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px]">
                  <MapPin className="h-2.5 w-2.5" />
                  Live
                </span>
              )}
              <button
                onClick={startNewChat}
                className="rounded-lg p-1.5 transition-colors hover:bg-white/20 active:bg-white/30"
                title="New conversation"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ── Messages area ── */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scroll-smooth">
            {isWelcomeOnly ? (
              <WelcomeCard onSuggestionClick={send} suggestions={suggestions} />
            ) : (
              <>
                {messages.filter((m) => m.id !== "welcome" && !m.id.startsWith("welcome-")).map((msg) => (
                  <div key={msg.id} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                    {/* Message bubble */}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                        msg.role === "user"
                          ? "ml-auto bg-gradient-to-br from-primary to-[hsl(340,82%,52%)] text-white rounded-br-md shadow-sm"
                          : "mr-auto bg-muted text-foreground rounded-bl-md",
                      )}
                    >
                      {msg.text}
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

                    {/* Follow-up question */}
                    {msg.followUp && (
                      <button
                        onClick={() => send(msg.followUp!)}
                        className="mt-2 mr-auto flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-primary transition-all hover:bg-primary/10 hover:border-primary/30 active:scale-95"
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
                        className="group rounded-full border border-primary/20 bg-background px-3 py-1.5 text-xs text-foreground transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 active:scale-95"
                      >
                        <span className="flex items-center gap-1.5">
                          <Zap className="h-3 w-3 text-primary/50 group-hover:text-primary transition-colors" />
                          {s}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Typing indicator */}
            {loading && <TypingIndicator />}
          </div>

          {/* ── Input bar ── */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-border/60 bg-background px-3 py-2.5"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about services, vendors..."
              disabled={loading}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
              maxLength={500}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || loading}
              className={cn(
                "h-8 w-8 shrink-0 rounded-lg transition-all duration-200",
                input.trim()
                  ? "bg-gradient-to-br from-primary to-[hsl(340,82%,52%)] text-white shadow-sm hover:shadow-md hover:opacity-90"
                  : "bg-muted text-muted-foreground",
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
