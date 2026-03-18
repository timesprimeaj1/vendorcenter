import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ShieldCheck, CalendarCheck, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    id: "trust",
    label: "01",
    title: "Trusted by real people",
    description: "4.9/5 average satisfaction. Every vendor is verified, insured, and monitored.",
    badge: "4.9 rating",
    accent: "bg-white/10",
  },
  {
    id: "booking",
    label: "02",
    title: "Book in one flow",
    description: "Pick a slot, lock price, and get instant confirmation—no clutter or distractions.",
    badge: "Live availability",
    accent: "bg-primary/15",
  },
  {
    id: "cta",
    label: "03",
    title: "Move with confidence",
    description: "A concierge-like CTA that keeps you focused on completing the booking.",
    badge: "Priority support",
    accent: "bg-accent/15",
  },
];

const ScrollStorySection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<HTMLDivElement[]>([]);
  const visualRefs = useRef<HTMLDivElement[]>([]);

  useLayoutEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      stepRefs.current.forEach((el, index) => {
        if (!el) return;
        gsap.set(el, {
          opacity: index === 0 ? 1 : 0.35,
          y: index === 0 ? 0 : 24,
        });
      });

      visualRefs.current.forEach((el, index) => {
        if (!el) return;
        gsap.set(el, {
          opacity: index === 0 ? 1 : 0,
          scale: index === 0 ? 1 : 0.94,
          y: index === 0 ? 0 : 30,
        });
      });

      const tl = gsap.timeline({
        defaults: { ease: "power2.out" },
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "+=250%",
          scrub: true,
          pin: true,
        },
      });

      steps.forEach((_, index) => {
        if (index === 0) return;
        const label = `step-${index}`;

        tl.to(stepRefs.current[index - 1], { opacity: 0.25, y: -8, duration: 0.6 }, label)
          .to(stepRefs.current[index], { opacity: 1, y: 0, duration: 0.6 }, label)
          .to(
            visualRefs.current[index - 1],
            { opacity: 0, scale: 0.9, y: -20, duration: 0.8 },
            label
          )
          .to(
            visualRefs.current[index],
            { opacity: 1, scale: 1, y: 0, duration: 0.9 },
            "<"
          );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative h-[320vh] text-white overflow-hidden bg-slate-950"
    >
      <div className="absolute inset-0 story-gradient" />
      <div className="absolute -top-24 left-1/4 w-64 h-64 bg-primary/25 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-accent/20 blur-[140px] rounded-full" />

      <div className="sticky top-0 h-screen flex items-center">
        <div className="container grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-center">
          <div className="space-y-8 max-w-xl">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.3em] text-white/60">Story</p>
              <h2 className="font-display text-4xl md:text-5xl font-semibold leading-tight text-white">
                A calm, premium booking flow built around one clear action.
              </h2>
              <p className="text-base text-white/70">
                Scroll to move through the narrative—trust signal, booking preview, and a focused CTA—
                without breaking the visual rhythm.
              </p>
            </div>

            <div className="space-y-4">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  ref={(el) => {
                    if (el) stepRefs.current[index] = el;
                  }}
                  className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg p-4 md:p-5"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-semibold tracking-[0.2em] text-white/60">
                      {step.label}
                    </span>
                    <div className="h-0.5 w-8 bg-white/15" />
                    <span className="text-sm font-medium text-white/80">{step.badge}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">
                      {index === 0 && <ShieldCheck className="w-4 h-4" />}
                      {index === 1 && <CalendarCheck className="w-4 h-4" />}
                      {index === 2 && <Sparkles className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="font-display text-lg text-white">{step.title}</h3>
                      <p className="text-sm text-white/60 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative h-[420px] md:h-[500px]">
            {steps.map((step, index) => (
              <div
                key={step.id}
                ref={(el) => {
                  if (el) visualRefs.current[index] = el;
                }}
                className="story-visual absolute inset-0 flex items-center justify-center"
              >
                {step.id === "trust" && (
                  <div className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-white/10 backdrop-blur-xl p-8 shadow-2xl">
                    <div className="absolute -top-10 right-10 w-24 h-24 bg-primary/25 blur-3xl rounded-full" />
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-white/60">Customer trust</p>
                        <p className="text-2xl font-semibold text-white">4.9 / 5.0</p>
                      </div>
                    </div>
                    <div className="mt-6 flex items-center gap-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                      ))}
                      <span className="text-sm text-white/60">Based on verified bookings</span>
                    </div>
                    <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Trust layer</p>
                        <p className="text-base text-white">Background checks & live quality scoring</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center text-white font-semibold">
                        ✓
                      </div>
                    </div>
                  </div>
                )}

                {step.id === "booking" && (
                  <div className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-white/10 backdrop-blur-xl p-8 shadow-2xl">
                    <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-accent/25 blur-3xl rounded-full" />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-white/50">Booking preview</p>
                        <p className="text-xl font-semibold text-white">Premium Deep Clean</p>
                        <p className="text-sm text-white/60">Tomorrow · 10:00 - 12:00</p>
                      </div>
                      <div className="px-3 py-1 rounded-full bg-white/10 text-xs text-white/80 border border-white/10">
                        Live slots
                      </div>
                    </div>
                    <div className="mt-6 space-y-3">
                      <div className="flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div>
                          <p className="text-xs text-white/50">Home size</p>
                          <p className="text-base text-white">2 BHK</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-white/50">Est. price</p>
                          <p className="text-base text-white">₹2,900</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center text-white font-semibold">
                          +
                        </div>
                        <div>
                          <p className="text-sm text-white">Add upholstery care</p>
                          <p className="text-xs text-white/50">Optional add-on</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-white/50">Total</p>
                        <p className="text-2xl font-semibold text-white">₹3,400</p>
                      </div>
                      <Button size="lg" className="rounded-xl px-6 bg-white text-slate-900 hover:bg-white/90">
                        Continue
                      </Button>
                    </div>
                  </div>
                )}

                {step.id === "cta" && (
                  <div className="relative w-full max-w-md rounded-[28px] border border-white/10 bg-white/10 backdrop-blur-xl p-8 shadow-2xl">
                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-white/20 blur-[120px] rounded-full" />
                    <div className="space-y-4 relative">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs text-white/80 border border-white/10">
                        Priority concierge
                      </div>
                      <h3 className="text-2xl font-semibold text-white">
                        Finish your booking with a single, focused CTA.
                      </h3>
                      <p className="text-sm text-white/60">
                        No extra cards or distractions—just the path to confirm with assurance and support.
                      </p>
                      <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
                        <div className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center text-white font-semibold">
                          24/7
                        </div>
                        <div>
                          <p className="text-sm text-white">Human support on standby</p>
                          <p className="text-xs text-white/50">Instant help if anything changes</p>
                        </div>
                      </div>
                      <Button
                        size="lg"
                        className="w-full rounded-xl bg-white text-slate-900 hover:bg-white/90 shadow-lg"
                      >
                        Book with confidence
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ScrollStorySection;
