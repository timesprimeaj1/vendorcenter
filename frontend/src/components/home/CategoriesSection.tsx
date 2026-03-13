import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SERVICE_CATEGORIES, getCategoryMeta } from "@/data/serviceCategories";
import { api } from "@/lib/api";
import { useLocation } from "@/hooks/useLocation";

interface DisplayCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
  color: string;
}

const CategoriesSection = () => {
  const { location } = useLocation();
  const [cats, setCats] = useState<DisplayCategory[]>(
    SERVICE_CATEGORIES.map((c, i) => ({
      id: String(i + 1),
      name: c.key,
      icon: c.icon,
      count: 0,
      color: c.color,
    }))
  );

  useEffect(() => {
    if (!location?.latitude || !location?.longitude) {
      setCats(
        SERVICE_CATEGORIES.map((c, i) => ({
          id: String(i + 1),
          name: c.key,
          icon: c.icon,
          count: 0,
          color: c.color,
        }))
      );
      return;
    }

    api.getCategories(location.latitude, location.longitude, 25).then((res) => {
      if (res.data && res.data.length > 0) {
        const live: DisplayCategory[] = res.data.map((d, i) => {
          const meta = getCategoryMeta(d.cat);
          return {
            id: String(i + 1),
            name: d.cat,
            icon: meta?.icon ?? "📋",
            count: d.vendor_count,
            color: meta?.color ?? "hsl(0,0%,50%)",
          };
        });
        // Merge: show live categories first, then show remaining static categories that have 0 vendors
        const liveKeys = new Set(live.map((l) => l.name));
        const remaining = SERVICE_CATEGORIES.filter((c) => !liveKeys.has(c.key)).map((c, i) => ({
          id: String(live.length + i + 1),
          name: c.key,
          icon: c.icon,
          count: 0,
          color: c.color,
        }));
        setCats([...live, ...remaining]);
      } else {
        setCats(
          SERVICE_CATEGORIES.map((c, i) => ({
            id: String(i + 1),
            name: c.key,
            icon: c.icon,
            count: 0,
            color: c.color,
          }))
        );
      }
    }).catch(() => {});
  }, [location?.latitude, location?.longitude]);
  return (
    <section className="py-16 md:py-20 bg-background">
      <div className="container">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold">
              Browse by <span className="gradient-text">Category</span>
            </h2>
            <p className="text-muted-foreground mt-2">Find the perfect service for your needs</p>
          </div>
          <button className="hidden md:flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            View All <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {cats.map((cat, index) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                to={`/services?category=${encodeURIComponent(cat.name)}`}
                className="group relative p-5 rounded-2xl bg-card border border-border/60 hover:border-primary/30 hover:shadow-lg transition-all duration-300 text-left card-glow block"
              >
                <div className="text-4xl mb-3">{cat.icon}</div>
                <h3 className="font-display font-semibold text-sm md:text-base">{cat.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{cat.count} vendors</p>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-4 h-4 text-primary" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoriesSection;
