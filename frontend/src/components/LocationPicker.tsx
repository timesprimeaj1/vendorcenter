import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Navigation, Clock, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocation } from "@/hooks/useLocation";
import { forwardGeocode } from "@/services/locationService";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";

interface LocationResult {
  lat: number;
  lng: number;
  display: string;
}

const RECENT_KEY = "vc_recent_locations";
const MAX_RECENT = 5;

function getRecentLocations(): LocationResult[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentLocation(loc: LocationResult) {
  const recent = getRecentLocations().filter(
    (r) => r.lat !== loc.lat || r.lng !== loc.lng
  );
  recent.unshift(loc);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

interface LocationPickerProps {
  open: boolean;
  onClose: () => void;
}

const LocationPicker = ({ open, onClose }: LocationPickerProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [recentLocations, setRecentLocations] = useState<LocationResult[]>([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { setManualLocation, refresh } = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      setRecentLocations(getRecentLocations());
      setQuery("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 200);
      // Fetch saved addresses for logged-in customers
      if (user && user.role === "customer") {
        api.getAddresses().then(res => setSavedAddresses(res.data ?? [])).catch(() => {});
      }
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await forwardGeocode(value);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  const selectLocation = (loc: LocationResult) => {
    saveRecentLocation(loc);
    setManualLocation(loc.lat, loc.lng);
    onClose();
  };

  const handleGetCurrentLocation = () => {
    setGpsLoading(true);
    // Clear cache so it fetches fresh
    localStorage.removeItem("vc_last_location");
    refresh();
    setTimeout(() => {
      setGpsLoading(false);
      onClose();
    }, 1500);
  };

  // Truncate display name for UI
  const shortName = (display: string) => {
    const parts = display.split(",").map((s) => s.trim());
    return parts.length > 3
      ? parts.slice(0, 3).join(", ")
      : display;
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={onClose}
          />

          {/* Side panel */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "tween", duration: 0.3 }}
            className="fixed top-0 left-0 h-full w-full max-w-md bg-background z-[61] shadow-2xl flex flex-col"
          >
            {/* Close button */}
            <div className="flex items-center p-4 pb-2">
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search input */}
            <div className="px-4 pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search for area, street name.."
                  className="pl-10 pr-4 h-12 rounded-lg border-border text-base"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Search results */}
              {query.trim().length >= 2 ? (
                <div className="px-4">
                  {searching ? (
                    <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Searching...
                    </div>
                  ) : results.length > 0 ? (
                    <div className="space-y-1">
                      {results.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => selectLocation(r)}
                          className="w-full text-left px-3 py-3 rounded-lg hover:bg-secondary transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <Navigation className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                            <div>
                              <p className="text-sm font-medium">
                                {shortName(r.display)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {r.display}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="py-4 text-sm text-muted-foreground">
                      No results found
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {/* Get current location */}
                  <div className="px-4">
                    <button
                      onClick={handleGetCurrentLocation}
                      disabled={gpsLoading}
                      className="w-full flex items-center gap-3 px-3 py-4 rounded-lg hover:bg-secondary transition-colors border border-border/50"
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Navigation className="w-4 h-4 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold">
                          {gpsLoading ? "Detecting..." : "Get current location"}
                        </p>
                        <p className="text-xs text-muted-foreground">Using GPS</p>
                      </div>
                    </button>
                  </div>

                  {/* Saved addresses */}
                  {savedAddresses.length > 0 && (
                    <div className="mt-6 px-4">
                      <h3 className="text-xs font-semibold text-muted-foreground tracking-wider mb-3 px-3">
                        SAVED ADDRESSES
                      </h3>
                      <div className="space-y-1">
                        {savedAddresses.map((addr: any) => (
                          <button
                            key={addr.id}
                            onClick={() => {
                              if (addr.latitude && addr.longitude) {
                                selectLocation({
                                  lat: Number(addr.latitude),
                                  lng: Number(addr.longitude),
                                  display: addr.fullAddress || `${addr.label} — ${addr.pincode}`,
                                });
                              }
                            }}
                            className="w-full text-left flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-secondary transition-colors"
                          >
                            <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium flex items-center gap-1.5">
                                {addr.label}
                                {addr.isDefault && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Default</span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {addr.fullAddress || addr.pincode}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent searches */}
                  {recentLocations.length > 0 && (
                    <div className="mt-6 px-4">
                      <h3 className="text-xs font-semibold text-muted-foreground tracking-wider mb-3 px-3">
                        RECENT SEARCHES
                      </h3>
                      <div className="space-y-1">
                        {recentLocations.map((loc, i) => (
                          <button
                            key={i}
                            onClick={() => selectLocation(loc)}
                            className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-secondary transition-colors"
                          >
                            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                            <p className="text-sm line-clamp-1">{shortName(loc.display)}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default LocationPicker;
