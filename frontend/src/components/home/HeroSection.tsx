import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, MapPin, ArrowRight, Star, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "@/hooks/useLocation";
import { useNavigate } from "react-router-dom";
import { SERVICE_CATEGORIES } from "@/data/serviceCategories";
import { api, type PublicStats } from "@/lib/api";

const HeroSection = () => {
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
    { label: "Active Vendors", value: liveStats?.activeVendors ?? 0, icon: "🏪" },
    { label: "Happy Customers", value: liveStats?.happyCustomers ?? 0, icon: "😊" },
    { label: "Services Completed", value: liveStats?.servicesCompleted ?? 0, icon: "✅" },
    { label: "Cities Covered", value: liveStats?.citiesCovered ?? 0, icon: "🌆" },
  ];

  const formatCount = (value: number) => {
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
  return (
    <section className="relative overflow-hidden gradient-hero text-background">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/10 blur-3xl animate-float" />
        <div className="absolute bottom-0 -left-20 w-60 h-60 rounded-full bg-accent/10 blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />
        <div className="absolute top-1/2 right-1/4 w-40 h-40 rounded-full bg-primary/5 blur-2xl animate-float" style={{ animationDelay: "0.8s" }} />
      </div>

      <div className="container relative py-16 md:py-24 lg:py-32">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-background/10 backdrop-blur-sm border border-background/10 mb-6">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-background/80">Verified & Trusted Vendors</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
          >
            Find the Best{" "}
            <span className="gradient-text">Local Services</span>
            <br />
            Near You
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-background/70 mb-8 max-w-xl mx-auto"
          >
            From home cleaning to salon services — book trusted professionals in minutes.
          </motion.p>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto"
          >
            <div className="flex-1 relative" ref={wrapperRef}>
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
              <Input
                placeholder="What service do you need?"
                className="pl-10 h-12 rounded-xl bg-background text-foreground border-0 shadow-lg"
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
              className="h-12 px-6 gradient-bg text-primary-foreground border-0 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-shadow"
              onClick={handleSearch}
            >
              Search
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </motion.div>

          {/* Quick location */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex items-center justify-center gap-2 mt-4"
          >
            <MapPin className="w-3.5 h-3.5 text-primary" />
            {loading ? (
              <span className="text-sm text-background/60">Detecting your location...</span>
            ) : error ? (
              <button onClick={refresh} className="text-sm text-background/60 underline hover:text-background/80">
                Enable location access
              </button>
            ) : (
              <span className="text-sm text-background/80">{fullAddress || cityName}</span>
            )}
          </motion.div>
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-3xl mx-auto"
        >
          {stats.map((stat, i) => (
            <div key={i} className="text-center p-4 rounded-2xl bg-background/5 backdrop-blur-sm border border-background/10">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="font-display font-bold text-xl md:text-2xl text-background">{formatCount(stat.value)}</div>
              <div className="text-xs text-background/50 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
