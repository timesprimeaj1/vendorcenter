import { useState, useEffect } from "react";
import { Star, MapPin, BadgeCheck, ArrowRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useLocation } from "@/hooks/useLocation";
import { Link } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollAnimation";
import { useTranslation } from "react-i18next";

const FeaturedVendors = () => {
  const { t } = useTranslation("home");
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { location: userLoc } = useLocation();
  const hasLocation = !!(userLoc?.latitude && userLoc?.longitude);

  useEffect(() => {
    if (!hasLocation) {
      setVendors([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    api.getApprovedVendors(userLoc?.latitude, userLoc?.longitude, 10)
      .then((res) => {
        setVendors(
          (res.data || []).slice(0, 6).map((v: any) => ({
            id: v.vendorId || v.id,
            name: v.businessName,
            category: (v.serviceCategories as string[])?.[0] || "Service",
            rating: Number(v.rating) || 0,
            reviews: Number(v.reviews) || 0,
            location: v.zone || "Nearby",
            verified: v.verificationStatus === "approved",
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hasLocation, userLoc?.latitude, userLoc?.longitude]);
  const headerRef = useScrollReveal<HTMLDivElement>({ preset: "fadeUp" });
  const gridRef = useScrollReveal<HTMLDivElement>({ preset: "fadeUp", stagger: 0.08, children: true, delay: 0.15 });

  return (
    <section className="py-16 md:py-20 bg-secondary/30">
      <div className="container">
        <div ref={headerRef} className="flex items-end justify-between mb-10">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold">
              {t("featured.titleStart")} <span className="gradient-text">{t("featured.titleHighlight")}</span>
            </h2>
            <p className="text-muted-foreground mt-2">{t("featured.subtitle")}</p>
          </div>
          <Link to="/services" className="hidden md:flex items-center gap-1 text-sm font-medium text-primary link-underline">
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>{hasLocation ? t("featured.noVendorsWithLocation") : t("featured.noVendorsNoLocation")}</p>
          </div>
        ) : (
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {vendors.map((vendor) => (
            <div
              key={vendor.id}
              className="group bg-card rounded-2xl border border-border/60 overflow-hidden card-3d border-glow cursor-pointer"
            >
              {/* Content */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-display font-semibold text-base truncate">{vendor.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{vendor.category}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg bg-success/10">
                    <Star className="w-3.5 h-3.5 fill-warning text-warning" />
                    <span className="text-sm font-bold">{vendor.rating.toFixed(1)}</span>
                    {vendor.reviews > 0 && (
                      <span className="text-xs text-muted-foreground">({vendor.reviews})</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{vendor.location}</span>
                </div>

                {vendor.verified && (
                  <div className="mt-3">
                    <Badge className="bg-success text-success-foreground border-0 text-xs gap-1">
                      <BadgeCheck className="w-3 h-3" />
                      {t("common:status.verified")}
                    </Badge>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-border/60">
                  <Link
                    to={`/vendor/${vendor.id}`}
                    className="px-4 py-2 rounded-xl gradient-bg text-primary-foreground text-sm font-medium hover:shadow-md transition-all btn-press inline-block"
                  >
                    {t("common:actions.viewAndBook")}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </section>
  );
};

export default FeaturedVendors;
