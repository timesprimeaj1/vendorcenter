import { useState, useEffect, useRef, useCallback, useMemo, Component, type ErrorInfo, type ReactNode } from "react";
import { MapView, VendorMarkers, UserLocationMarker, ZoneLayer, MarkerCluster } from "@/components/map";
import type { VendorMapData, ZoneData } from "@/components/map";
import { useUserLocation } from "@/hooks/useUserLocation";
import { api } from "@/lib/api";
import Layout from "@/components/layout/Layout";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { MapPin, Search, Loader2, LocateFixed, AlertCircle, MousePointerClick, Star, ArrowRight, Compass } from "lucide-react";
import { toast } from "sonner";
import { forwardGeocode, reverseGeocode } from "@/services/locationService";
import { useScrollReveal } from "@/hooks/useScrollAnimation";

class MapErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Map error:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-[400px] rounded-xl bg-muted flex items-center justify-center">
          <p className="text-muted-foreground">Map failed to load. Please refresh the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Explore() {
  const navigate = useNavigate();
  const { location, error: locError, loading: locLoading, refresh, setManualLocation } = useUserLocation();
  const [vendors, setVendors] = useState<VendorMapData[]>([]);
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [radiusKm, setRadiusKm] = useState(10);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<{ lat: number; lng: number; display: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Debounced autocomplete suggestions
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = searchQuery.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setLoadingSuggestions(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await forwardGeocode(q);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectSuggestion = useCallback((s: { lat: number; lng: number; display: string }) => {
    setManualLocation(s.lat, s.lng);
    setSearchQuery(s.display.split(",").slice(0, 2).join(","));
    setShowSuggestions(false);
    setSuggestions([]);
    toast.success(`Location set to ${s.display.split(",")[0]}`);
  }, [setManualLocation]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setManualLocation(lat, lng);
    reverseGeocode(lat, lng).then((address) => {
      setSearchQuery(address.split(",").slice(0, 2).join(",").trim());
      toast.success(`Location set to ${address.split(",")[0]}`);
    }).catch(() => {
      toast.success("Location set from map");
    });
  }, [setManualLocation]);

  // Fetch vendors when location or radius changes
  useEffect(() => {
    if (!location) return;
    setLoadingVendors(true);
    fetch(`/api/location/vendors-nearby?lat=${location.latitude}&lng=${location.longitude}&radiusKm=${radiusKm}&limit=100`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setVendors(res.data);
      })
      .catch(() => toast.error("Failed to load vendors"))
      .finally(() => setLoadingVendors(false));
  }, [location, radiusKm]);

  // Fetch zones once
  useEffect(() => {
    fetch("/api/location/zones")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setZones(
            res.data
              .filter((z: any) => z.polygonCoordinates)
              .map((z: any) => ({
                id: z.id,
                name: z.zone,
                city: z.city,
                polygonCoordinates: z.polygonCoordinates,
                active: z.active,
              }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await forwardGeocode(searchQuery);
      if (results.length > 0) {
        setManualLocation(results[0].lat, results[0].lng);
        toast.success(`Location set to ${results[0].display.split(",")[0]}`);
      } else {
        toast.error("Location not found");
      }
    } catch {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const mapCenter: [number, number] = useMemo(
    () => location ? [location.latitude, location.longitude] : [20.5937, 78.9629],
    [location?.latitude, location?.longitude]
  );

  return (
    <Layout>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.06),transparent)]" />
        <div className="container mx-auto px-4 py-5 relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center shadow-lg">
              <Compass className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold">Explore Services</h1>
              <p className="text-sm text-muted-foreground">Find verified vendors near you</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            {/* Search bar with autocomplete */}
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1 group" ref={searchWrapperRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 transition-colors group-focus-within:text-primary" />
                <Input
                  placeholder="Search location (e.g. Koramangala, Bangalore)"
                  className="pl-10 h-11 rounded-xl border-border/60 focus:border-primary/40"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (suggestions.length > 0) {
                        selectSuggestion(suggestions[0]);
                      } else {
                        handleSearch();
                      }
                    }
                    if (e.key === "Escape") setShowSuggestions(false);
                  }}
                />
                {/* Suggestions dropdown */}
                {showSuggestions && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
                    {suggestions.map((s, i) => {
                      const parts = s.display.split(",");
                      const primary = parts[0].trim();
                      const secondary = parts.slice(1, 3).map(p => p.trim()).join(", ");
                      return (
                        <button
                          key={`${s.lat}-${s.lng}-${i}`}
                          className="w-full text-left px-4 py-2.5 hover:bg-muted/60 flex items-start gap-3 border-b last:border-0 transition-colors"
                          onClick={() => selectSuggestion(s)}
                        >
                          <MapPin className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{primary}</p>
                            {secondary && <p className="text-xs text-muted-foreground truncate">{secondary}</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {loadingSuggestions && searchQuery.trim().length >= 3 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <Button onClick={handleSearch} disabled={searching} className="h-11 rounded-xl btn-press">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
              </Button>
            </div>

            {/* Locate me button */}
            <Button variant="outline" onClick={refresh} disabled={locLoading} className="h-11 rounded-xl gap-2 btn-press">
              {locLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
              My Location
            </Button>
          </div>

          {/* Radius slider */}
          <div className="mt-3 flex items-center gap-4">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Radius: {radiusKm} km</span>
            <Slider
              value={[radiusKm]}
              onValueChange={([v]) => setRadiusKm(v)}
              min={1}
              max={50}
              step={1}
              className="flex-1 max-w-xs"
            />
            <span className="text-sm font-medium">
              {loadingVendors ? (
                <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
              ) : (
                vendors.length
              )}{" "}
              vendors found
            </span>
          </div>
        </div>
      </div>

      {/* Location permission error */}
      {locError && !location && (
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl text-sm">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-amber-700 dark:text-amber-300">
              {locError.code === "PERMISSION_DENIED"
                ? "Location access denied. Search for your location above instead."
                : "Could not detect your location. Please search for it above."}
            </span>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
          <MousePointerClick className="w-3.5 h-3.5" />
          <span>Click anywhere on the map to set your location</span>
        </div>
        <MapErrorBoundary>
        <MapView center={mapCenter} zoom={location ? 13 : 5} className="w-full h-[calc(100vh-280px)] min-h-[400px] rounded-xl overflow-hidden shadow-lg border border-border/40" onMapClick={handleMapClick}>
          {location && (
            <UserLocationMarker
              position={[location.latitude, location.longitude]}
              accuracy={location.accuracy}
            />
          )}
          <VendorMarkers vendors={vendors.length <= 50 ? vendors : []} />
          {vendors.length > 50 && <MarkerCluster vendors={vendors} />}
          <ZoneLayer zones={zones} />
        </MapView>
        </MapErrorBoundary>

        {/* Vendor cards list below map */}
        {vendors.length > 0 ? (
          <div className="mt-8">
            <h2 className="font-display text-lg font-semibold mb-4">Nearby Vendors</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {vendors.map((v) => (
                <div
                  key={v.vendorId}
                  className="group border rounded-xl p-4 bg-card hover:shadow-lg hover:border-primary/20 transition-all duration-300 cursor-pointer card-3d"
                  onClick={() => navigate(`/vendor/${encodeURIComponent(v.vendorId)}`)}
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{v.businessName}</p>
                      <p className="text-sm text-muted-foreground">{v.zone}</p>
                    </div>
                    {v.averageRating > 0 && (
                      <span className="flex items-center gap-1 text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full shrink-0">
                        <Star className="w-3 h-3 fill-current" /> {Number(v.averageRating).toFixed(1)}
                      </span>
                    )}
                  </div>
                  {v.serviceCategories && v.serviceCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {v.serviceCategories.slice(0, 3).map((cat) => (
                        <span
                          key={cat}
                          className="text-xs bg-muted px-2 py-0.5 rounded-full"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/40 text-sm">
                    <span className="text-muted-foreground">{Number(v.distanceKm).toFixed(1)} km away</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg text-xs h-7 gap-1 group-hover:gradient-bg group-hover:text-primary-foreground group-hover:border-0 transition-all"
                      onClick={(e) => { e.stopPropagation(); navigate(`/vendor/${encodeURIComponent(v.vendorId)}`); }}
                    >
                      View <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !loadingVendors && location ? (
          <div className="mt-8 flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="font-display text-lg font-semibold mb-2">No vendors nearby</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Try increasing the search radius or searching a different location to find service providers.
            </p>
          </div>
        ) : null}
      </div>
    </div>
    </Layout>
  );
}
