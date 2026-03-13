import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, MapPin, Star, BadgeCheck, X, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SERVICE_CATEGORIES, getCategoryMeta } from "@/data/serviceCategories";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "@/hooks/useLocation";
import { toast } from "sonner";

const Services = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialCategory = searchParams.get("category");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [minRating, setMinRating] = useState(0);
  const { user } = useAuth();
  const { location: userLoc } = useLocation();
  const hasLocation = !!(userLoc?.latitude && userLoc?.longitude);

  // Sync URL param → state on navigation
  useEffect(() => {
    const cat = searchParams.get("category");
    setSelectedCategory(cat);
  }, [searchParams]);

  // Update URL when category changes
  const selectCategory = (cat: string | null) => {
    setSelectedCategory(cat);
    if (cat) {
      setSearchParams({ category: cat }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  // Fetch live categories with vendor counts
  const { data: liveCats } = useQuery({
    queryKey: ["vendor-categories"],
    queryFn: async () => {
      const res = await api.getCategories();
      return res.data ?? [];
    },
    staleTime: 60_000,
  });

  // Build display categories: show all categories, no misleading counts
  const displayCategories = (() => {
    if (liveCats && liveCats.length > 0) {
      const liveKeys = new Set(liveCats.map((c) => c.cat));
      const live = liveCats.map((c) => {
        const meta = getCategoryMeta(c.cat);
        return { name: c.cat, icon: meta?.icon ?? "📋" };
      });
      const rest = SERVICE_CATEGORIES
        .filter((c) => !liveKeys.has(c.key))
        .map((c) => ({ name: c.key, icon: c.icon }));
      return [...live, ...rest];
    }
    return SERVICE_CATEGORIES.map((c) => ({ name: c.key, icon: c.icon }));
  })();

  const mapVendor = (v: any, fallbackCategory?: string) => ({
    id: v.id,
    name: v.businessName,
    category: (v.serviceCategories as string[])?.[0] || fallbackCategory || "Service",
    rating: Number(v.rating) || 0,
    reviews: Number(v.reviews) || 0,
    image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop",
    price: "—",
    location: v.zone || "Nearby",
    verified: v.verificationStatus === "approved",
    distance: "—",
    vendorId: v.vendorId,
    serviceName: v.businessName,
  });

  // Fetch vendors by selected category (real API)
  const { data: services, isLoading } = useQuery({
    queryKey: ["services", selectedCategory, userLoc?.latitude, userLoc?.longitude, minRating],
    queryFn: async () => {
      try {
        if (!hasLocation) {
          return [];
        }

        if (selectedCategory) {
          const res = await api.getVendorsByCategory(
            selectedCategory,
            userLoc?.latitude,
            userLoc?.longitude,
            undefined,
            minRating || undefined
          );
          return (res.data || []).map((v: any) => mapVendor(v, selectedCategory));
        }
        // No category selected — fetch all approved vendors
        const res = await api.getApprovedVendors(
          userLoc?.latitude,
          userLoc?.longitude,
          undefined,
          minRating || undefined
        );
        return (res.data || []).map((v: any) => mapVendor(v));
      } catch {
        return [];
      }
    },
    enabled: hasLocation,
  });

  const vendors = services || [];
  const filtered = vendors.filter((v: any) => {
    const matchesSearch = !searchQuery || v.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleBook = (vendor: any) => {
    navigate(`/vendor/${vendor.vendorId || vendor.id}`);
  };

  return (
    <Layout>
      {/* Header */}
      <div className="bg-secondary/50 border-b border-border">
        <div className="container py-6">
          <h1 className="font-display text-2xl md:text-3xl font-bold mb-4">
            Browse <span className="gradient-text">Services</span>
          </h1>
          <div className="flex gap-3">
            <div className="flex-1 relative max-w-lg">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search services..." className="pl-10 h-11 rounded-xl" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <Button
              variant="outline"
              className="h-11 rounded-xl gap-2"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {minRating > 0 && (
                <span className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  1
                </span>
              )}
            </Button>
          </div>

          {/* Rating filter panel */}
          {showFilters && (
            <div className="mt-3 p-4 bg-card border rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">Minimum Rating</p>
                {minRating > 0 && (
                  <button
                    onClick={() => setMinRating(0)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    onClick={() => setMinRating(minRating === r ? 0 : r)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      minRating === r
                        ? "bg-amber-100 text-amber-800 border-2 border-amber-400 shadow-sm"
                        : "bg-secondary text-secondary-foreground hover:bg-amber-50 border-2 border-transparent"
                    }`}
                  >
                    <span>{r}</span>
                    <Star className={`w-3.5 h-3.5 ${minRating === r ? "fill-amber-500 text-amber-500" : "text-amber-400"}`} />
                    <span className="text-xs text-muted-foreground">& up</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="container py-6">
        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
          <button
            onClick={() => selectCategory(null)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !selectedCategory ? "gradient-bg text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-primary/10"
            }`}
          >
            All
          </button>
          {displayCategories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => selectCategory(selectedCategory === cat.name ? null : cat.name)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === cat.name
                  ? "gradient-bg text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-primary/10"
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading..." : `${filtered.length} services found`}
          </p>
          {selectedCategory && (
            <button
              onClick={() => selectCategory(null)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <X className="w-3 h-3" /> Clear filter
            </button>
          )}
        </div>

        {!hasLocation && (
          <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
            Enable location to see only nearby vendors.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((vendor, index) => (
            <motion.div
              key={vendor.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="group bg-card rounded-2xl border border-border/60 overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all duration-300 cursor-pointer hover-lift"
              onClick={() => navigate(`/vendor/${vendor.vendorId || vendor.id}`)}
            >
              <div className="relative h-40 overflow-hidden">
                <img src={vendor.image} alt={vendor.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                {vendor.verified && (
                  <Badge className="absolute top-3 left-3 bg-success text-success-foreground border-0 text-xs gap-1">
                    <BadgeCheck className="w-3 h-3" /> Verified
                  </Badge>
                )}
                <Badge variant="secondary" className="absolute top-3 right-3 bg-card/90 backdrop-blur-sm text-xs">{vendor.distance}</Badge>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display font-semibold truncate">{vendor.name}</h3>
                    <p className="text-xs text-muted-foreground">{vendor.category}</p>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-success/10">
                    <Star className="w-3.5 h-3.5 fill-warning text-warning" />
                    <span className="text-sm font-bold">{vendor.rating}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{vendor.location}</span>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60">
                  <div>
                    <span className="text-xs text-muted-foreground">From</span>
                    <div className="font-display font-bold text-lg text-primary">{vendor.price}</div>
                  </div>
                  <Button size="sm" className="gradient-bg text-primary-foreground border-0 rounded-xl" onClick={(e) => { e.stopPropagation(); handleBook(vendor); }}>View Details</Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Services;
