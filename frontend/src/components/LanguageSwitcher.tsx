import { useTranslation } from "react-i18next";
import { Globe, Check, Languages, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { supportedLanguages, type SupportedLanguage } from "@/i18n/i18n";
import { useEffect, useCallback, useRef, useState } from "react";

/* ─── Google Translate: cookie + hidden widget ─── */

declare global {
  interface Window {
    google?: {
      translate?: {
        TranslateElement: {
          new (opts: Record<string, unknown>, el: string): unknown;
        };
      };
    };
    googleTranslateElementInit?: () => void;
  }
}

const GT_CONTAINER_ID = "google_translate_element";

const INDIAN_LANGUAGES = [
  { code: "hi", label: "हिन्दी — Hindi" },
  { code: "bn", label: "বাংলা — Bengali" },
  { code: "ta", label: "தமிழ் — Tamil" },
  { code: "te", label: "తెలుగు — Telugu" },
  { code: "kn", label: "ಕನ್ನಡ — Kannada" },
  { code: "ml", label: "മലയാളം — Malayalam" },
  { code: "gu", label: "ગુજરાતી — Gujarati" },
  { code: "pa", label: "ਪੰਜਾਬੀ — Punjabi" },
  { code: "ur", label: "اردو — Urdu" },
  { code: "or", label: "ଓଡ଼ିଆ — Odia" },
  { code: "ne", label: "नेपाली — Nepali" },
];

const GLOBAL_LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh-CN", label: "中文" },
  { code: "ar", label: "العربية" },
  { code: "ru", label: "Русский" },
  { code: "it", label: "Italiano" },
];

/** Check if Google Translate is currently active on the page */
function isGtActive(): boolean {
  const c = document.cookie;
  return c.includes("googtrans=/en/") || !!document.querySelector("html.translated-ltr, html.translated-rtl");
}

/**
 * Nuke Google Translate completely:
 * - clear cookies on every domain variant
 * - remove the script, container, all injected iframes & style tags
 * - remove GT's <font> wrappers and class mutations on <html>
 */
function nukeGoogleTranslate() {
  // 1. Clear cookies
  const expires = "expires=Thu, 01 Jan 1970 00:00:00 UTC";
  document.cookie = `googtrans=; ${expires}; path=/;`;
  document.cookie = `googtrans=; ${expires}; path=/; domain=${location.hostname};`;
  document.cookie = `googtrans=; ${expires}; path=/; domain=.${location.hostname};`;

  // 2. Tell GT widget to reset (if loaded)
  const sel = document.querySelector<HTMLSelectElement>("select.goog-te-combo");
  if (sel) {
    sel.value = "";
    sel.dispatchEvent(new Event("change"));
  }

  // 3. Remove all GT-injected elements
  document.getElementById("google-translate-script")?.remove();
  document.getElementById(GT_CONTAINER_ID)?.remove();
  document.querySelectorAll(
    ".goog-te-banner-frame, #goog-gt-tt, .goog-te-balloon-frame, .goog-te-menu-frame, .skiptranslate"
  ).forEach((el) => el.remove());

  // 4. Remove GT shadow-DOM host (#gtx-host)
  document.getElementById("gtx-host")?.remove();
  document.getElementById("gtx-trans")?.remove();

  // 5. Clean <html> class
  document.documentElement.classList.remove("translated-ltr", "translated-rtl");

  // 6. Fix body position
  document.body.style.top = "";
  document.body.style.position = "";

  // 7. Clear global callback so fresh load works next time
  delete window.googleTranslateElementInit;
  if (window.google?.translate) {
    window.google = undefined;
  }
}

/** Load GT widget (hidden) and trigger translation */
function triggerGoogleTranslate(langCode: string) {
  const setLanguage = () => {
    const sel = document.querySelector<HTMLSelectElement>("select.goog-te-combo");
    if (sel) {
      sel.value = langCode;
      sel.dispatchEvent(new Event("change"));
      return true;
    }
    return false;
  };

  if (setLanguage()) return;

  // Set cookie
  const val = `/en/${langCode}`;
  document.cookie = `googtrans=${val}; path=/;`;
  document.cookie = `googtrans=${val}; path=/; domain=${location.hostname};`;

  if (!document.getElementById("google-translate-script")) {
    let container = document.getElementById(GT_CONTAINER_ID);
    if (!container) {
      container = document.createElement("div");
      container.id = GT_CONTAINER_ID;
      document.body.appendChild(container);
    }

    window.googleTranslateElementInit = () => {
      if (!window.google?.translate) return;
      new window.google.translate.TranslateElement(
        { pageLanguage: "en", autoDisplay: false },
        GT_CONTAINER_ID
      );
      setTimeout(() => setLanguage(), 600);
      // Double-check after 1.5s to handle slow init
      setTimeout(() => setLanguage(), 1500);
    };

    const script = document.createElement("script");
    script.id = "google-translate-script";
    script.src =
      "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    document.body.appendChild(script);
  }
}

/* ─── Component ─── */

interface LanguageSwitcherProps {
  compact?: boolean;
}

const LanguageSwitcher = ({ compact = false }: LanguageSwitcherProps) => {
  const { i18n } = useTranslation();
  const currentLang = (i18n.language?.substring(0, 2) || "en") as SupportedLanguage;
  const gtWasActive = useRef(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (isGtActive()) gtWasActive.current = true;
  }, []);

  /**
   * Switch to a hardcoded i18n language (en / mr).
   * If Google Translate was active, the only reliable way to get a clean DOM
   * is a page reload — GT saves original text nodes internally and restores
   * them on reset, overwriting whatever React rendered.
   */
  const handleNativeLanguage = useCallback(
    (lang: SupportedLanguage) => {
      if (isGtActive() || gtWasActive.current) {
        // Persist choice to localStorage so i18n picks it up after reload
        localStorage.setItem("vc_language", lang);
        nukeGoogleTranslate();
        // Reload for clean DOM — i18n reads vc_language on init
        window.location.reload();
        return;
      }
      i18n.changeLanguage(lang);
    },
    [i18n]
  );

  const handleGtLanguage = useCallback((langCode: string) => {
    gtWasActive.current = true;
    triggerGoogleTranslate(langCode);
  }, []);

  /* shared label */
  const triggerLabel = supportedLanguages[currentLang];

  /* ── Compact mode (mobile) — inline expand, no fly-out sub-menu ── */
  if (compact) {
    return (
      <DropdownMenu onOpenChange={(open) => { if (!open) setMoreOpen(false); }}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            translate="no"
            className="notranslate text-xs font-medium gap-1.5 px-2"
          >
            <Globe className="w-3.5 h-3.5" />
            {triggerLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          translate="no"
          className="notranslate w-[220px] max-h-[70vh] overflow-y-auto"
        >
          {!moreOpen ? (
            <>
              {(
                Object.entries(supportedLanguages) as [SupportedLanguage, string][]
              ).map(([code, label]) => (
                <DropdownMenuItem
                  key={code}
                  onClick={() => handleNativeLanguage(code)}
                  className="gap-2"
                >
                  {currentLang === code && <Check className="w-3.5 h-3.5 text-primary" />}
                  {label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => { e.preventDefault(); setMoreOpen(true); }}
                className="gap-2 text-primary font-medium"
              >
                <Languages className="w-3.5 h-3.5" />
                More languages…
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem
                onClick={(e) => { e.preventDefault(); setMoreOpen(false); }}
                className="gap-2 text-muted-foreground text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Indian Languages
              </DropdownMenuLabel>
              {INDIAN_LANGUAGES.map((l) => (
                <DropdownMenuItem
                  key={l.code}
                  onClick={() => handleGtLanguage(l.code)}
                  className="text-sm"
                >
                  {l.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Global Languages
              </DropdownMenuLabel>
              {GLOBAL_LANGUAGES.map((l) => (
                <DropdownMenuItem
                  key={l.code}
                  onClick={() => handleGtLanguage(l.code)}
                  className="text-sm"
                >
                  {l.label}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  /* ── Full mode (desktop) ── */
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          translate="no"
          className="notranslate text-sm font-medium gap-1.5 px-3"
        >
          <Globe className="w-4 h-4" />
          {triggerLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        translate="no"
        className="notranslate min-w-[180px]"
      >
        {(
          Object.entries(supportedLanguages) as [SupportedLanguage, string][]
        ).map(([code, label]) => (
          <DropdownMenuItem
            key={code}
            onClick={() => handleNativeLanguage(code)}
            className="gap-2"
          >
            {currentLang === code && <Check className="w-4 h-4 text-primary" />}
            {label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 text-muted-foreground">
            <Languages className="w-4 h-4" />
            More languages…
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="notranslate max-h-[60vh] overflow-y-auto min-w-[200px]">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Indian Languages
              </DropdownMenuLabel>
              {INDIAN_LANGUAGES.map((l) => (
                <DropdownMenuItem
                  key={l.code}
                  onClick={() => handleGtLanguage(l.code)}
                >
                  {l.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Global Languages
              </DropdownMenuLabel>
              {GLOBAL_LANGUAGES.map((l) => (
                <DropdownMenuItem
                  key={l.code}
                  onClick={() => handleGtLanguage(l.code)}
                >
                  {l.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
