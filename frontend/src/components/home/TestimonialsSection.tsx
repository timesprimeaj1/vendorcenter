import { Star, Quote } from "lucide-react";
import { testimonials } from "@/data/mockData";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useScrollReveal } from "@/hooks/useScrollAnimation";

function toInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "VC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function clampWords(text: string, maxWords = 20) {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")}...`;
}

const TestimonialsSection = () => {
  const { data: publicReviews } = useQuery({
    queryKey: ["public-reviews"],
    queryFn: async () => {
      const res = await api.getPublicReviews(3);
      return res.data ?? [];
    },
    staleTime: 60_000,
  });

  const reviewCards = (publicReviews && publicReviews.length > 0)
    ? publicReviews.map((r) => ({
        id: r.id,
        text: clampWords(r.reviewText || "Great service experience.", 20),
        rating: Math.max(1, Math.min(5, Number(r.rating) || 5)),
        avatar: toInitials(r.customerName || "Customer"),
        name: r.customerName || "Verified Customer",
        service: r.serviceName || "Service",
      }))
    : testimonials;

  const headerRef = useScrollReveal<HTMLDivElement>({ preset: "fadeUp" });
  const gridRef = useScrollReveal<HTMLDivElement>({ preset: "fadeUp", stagger: 0.1, children: true, delay: 0.15 });

  return (
    <section className="py-16 md:py-20 bg-secondary/30">
      <div className="container">
        <div ref={headerRef} className="text-center mb-12">
          <h2 className="font-display text-2xl md:text-3xl font-bold">
            What Our <span className="gradient-text">Customers</span> Say
          </h2>
          <p className="text-muted-foreground mt-2">Real reviews from real people</p>
        </div>

        <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {reviewCards.map((t) => (
            <div
              key={t.id}
              className="bg-card p-6 rounded-2xl border border-border/60 hover:border-primary/20 transition-all duration-300 card-3d"
            >
              <Quote className="w-8 h-8 text-primary/20 mb-3" />
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{t.text}"</p>
              <div className="flex items-center gap-1 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-3.5 h-3.5 ${i < t.rating ? "fill-warning text-warning" : "text-border"}`} />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full gradient-bg flex items-center justify-center text-primary-foreground text-xs font-bold">
                  {t.avatar}
                </div>
                <div>
                  <div className="font-medium text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.service}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
