import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Search, MapPin, ArrowRight, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "@/hooks/useLocation";
import { useNavigate } from "react-router-dom";
import { SERVICE_CATEGORIES } from "@/data/serviceCategories";
import { api, type PublicStats } from "@/lib/api";
import { useCountUp } from "@/hooks/useScrollAnimation";

const HeroSection = () => {
  const { t } = useTranslation("home");
  const { cityName, fullAddress, loading, error, refresh } = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [liveStats, setLiveStats] = useState<PublicStats | null>(null);
  const [suggestions, setSuggestions] = useState<typeof SERVICE_CATEGORIES[number][]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    api.getPublicStats()
      .then((res) => {
        if (!active) return;
        setLiveStats(res.data ?? null);
      })
      .catch(() => {
        if (!active) return;
        setLiveStats(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const stats = [
    { label: t("hero.stats.activeVendors"), value: liveStats?.activeVendors ?? null, icon: "🏪" },
    { label: t("hero.stats.happyCustomers"), value: liveStats?.happyCustomers ?? null, icon: "😊" },
    { label: t("hero.stats.servicesCompleted"), value: liveStats?.servicesCompleted ?? null, icon: "✅" },
    { label: t("hero.stats.citiesCovered"), value: liveStats?.citiesCovered ?? null, icon: "🌆" },
  ];

  const formatCount = (value: number | null) => {
    if (value == null) return "...";
    if (!Number.isFinite(value) || value < 0) return "0";
    return new Intl.NumberFormat("en-IN").format(value);
  };

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) { setSuggestions([]); setShowSuggestions(false); return; }
    const matches = SERVICE_CATEGORIES.filter((c) =>
      c.key.toLowerCase().includes(q)
    );
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearch = () => {
    const q = query.trim();
    if (!q) return;
    const match = SERVICE_CATEGORIES.find((c) => c.key.toLowerCase() === q.toLowerCase());
    if (match) {
      navigate(`/services?category=${encodeURIComponent(match.key)}`);
    } else {
      navigate(`/services?category=${encodeURIComponent(q)}`);
    }
  };

  const selectCategory = (cat: typeof SERVICE_CATEGORIES[number]) => {
    setQuery(cat.key);
    setShowSuggestions(false);
    navigate(`/services?category=${encodeURIComponent(cat.key)}`);
  };
  // CountUp hooks for each stat
  const [vendorCountRef, triggerVendors] = useCountUp(liveStats?.activeVendors ?? 0, 2);
  const [customerCountRef, triggerCustomers] = useCountUp(liveStats?.happyCustomers ?? 0, 2);
  const [servicesCountRef, triggerServices] = useCountUp(liveStats?.servicesCompleted ?? 0, 2);
  const [citiesCountRef, triggerCities] = useCountUp(liveStats?.citiesCovered ?? 0, 2);

  const countRefs = [vendorCountRef, customerCountRef, servicesCountRef, citiesCountRef];
  const countTriggers = [triggerVendors, triggerCustomers, triggerServices, triggerCities];

  // Trigger count animations once live stats are available.
  const statsObserved = useRef(false);
  useEffect(() => {
    if (!liveStats || statsObserved.current) return;
    statsObserved.current = true;
    countTriggers.forEach((fn) => fn());
  }, [liveStats, countTriggers]);

  return (
    <section className="relative overflow-hidden gradient-hero text-background">
      {/* Animated background elements — ambient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[100px] animate-float-slow" />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-accent/10 blur-[80px] animate-float" style={{ animationDelay: "1.5s" }} />
        <div className="absolute top-1/3 right-1/5 w-64 h-64 rounded-full bg-orange-500/8 blur-[60px] animate-float" style={{ animationDelay: "0.8s" }} />
        <div className="absolute top-2/3 left-1/4 w-48 h-48 rounded-full bg-accent/6 blur-[50px] animate-float-slow" style={{ animationDelay: "2.5s" }} />
        {/* Gradient mesh overlay */}
        <div className="absolute inset-0 gradient-mesh opacity-30" />
      </div>

      <div className="container relative py-16 md:py-20 lg:py-24">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.15] mb-6 shadow-[0_0_20px_rgba(249,115,22,0.12)]">
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-semibold tracking-widest uppercase text-white/90">{t("hero.badge")}</span>
              <Shield className="w-3.5 h-3.5 text-orange-400" />
            </div>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 tracking-tight"
          >
            {t("hero.titleLine1")}{" "}
            <span className="gradient-text relative">
              {t("hero.titleHighlight")}
              <span className="absolute -bottom-1 left-0 right-0 h-1 rounded-full gradient-bg opacity-60" />
            </span>
            <br />
            {t("hero.titleLine2")}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
            className="text-lg md:text-xl text-white/65 mb-10 max-w-xl mx-auto leading-relaxed"
          >
            {t("hero.subtitle")}
          </motion.p>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
            className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto"
          >
            <div className="flex-1 relative glow-focus rounded-xl" ref={wrapperRef}>
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
              <Input
                placeholder={t("hero.searchPlaceholder")}
                className="pl-10 h-12 rounded-xl bg-background text-foreground border-0 shadow-lg transition-shadow focus:shadow-xl"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (suggestions.length > 0) selectCategory(suggestions[0]);
                    else handleSearch();
                  }
                  if (e.key === "Escape") setShowSuggestions(false);
                }}
              />
              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.key}
                      className="w-full text-left px-4 py-2.5 hover:bg-muted/60 flex items-center gap-3 border-b last:border-0 transition-colors text-foreground"
                      onClick={() => selectCategory(s)}
                    >
                      <span className="text-xl">{s.icon}</span>
                      <span className="text-sm font-medium">{s.key}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              size="lg"
              className="h-12 px-6 gradient-bg text-primary-foreground border-0 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all btn-press"
              onClick={handleSearch}
            >
              {t("hero.searchButton", "Search")}
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </motion.div>

          {/* Quick location */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="flex items-center justify-center gap-2 mt-4"
          >
            <MapPin className="w-3.5 h-3.5 text-orange-400" />
            {loading ? (
              <span className="text-sm text-white/55">{t("hero.detectingLocation", "Detecting your location...")}</span>
            ) : error ? (
              <button onClick={refresh} className="text-sm text-white/55 underline hover:text-white/80 transition-colors">
                {t("hero.enableLocation", "Enable location access")}
              </button>
            ) : (
              <span className="text-sm text-white/75">{fullAddress || cityName}</span>
            )}
          </motion.div>
        </div>

        {/* Stats with animated counters */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: 0.08,
                delayChildren: 0.45,
              },
            },
          }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 max-w-3xl mx-auto"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              variants={{
                hidden: { opacity: 0, y: 24 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="text-center p-5 rounded-2xl bg-white/[0.08] backdrop-blur-md border border-white/[0.12] hover:bg-white/[0.14] hover:border-white/[0.22] hover:-translate-y-1 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.15)]"
            >
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="font-display font-bold text-2xl md:text-3xl text-white">
                {liveStats ? (
                  <span ref={countRefs[i]}>{formatCount(stat.value)}</span>
                ) : (
                  <span className="inline-block min-w-[2ch] text-white/55 animate-pulse">{formatCount(stat.value)}</span>
                )}
              </div>
              <div className="text-xs font-medium text-white/60 mt-1 tracking-wide uppercase">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
