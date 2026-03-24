import { Search, CalendarCheck, Star, MapPin } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollAnimation";

const steps = [
  {
    icon: <MapPin className="w-6 h-6" />,
    title: "Set Location",
    description: "Allow GPS or enter your area to find nearby vendors",
    color: "bg-vendor/10 text-vendor",
  },
  {
    icon: <Search className="w-6 h-6" />,
    title: "Choose Service",
    description: "Browse categories and compare vendors by rating & price",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: <CalendarCheck className="w-6 h-6" />,
    title: "Book & Confirm",
    description: "Select time slot, confirm booking, and get instant updates",
    color: "bg-success/10 text-success",
  },
  {
    icon: <Star className="w-6 h-6" />,
    title: "Rate & Review",
    description: "Share your experience and help others find great vendors",
    color: "bg-warning/10 text-warning",
  },
];

const HowItWorks = () => {
  const headingRef = useScrollReveal<HTMLDivElement>({ preset: "fadeUp" });
  const stepsRef = useScrollReveal<HTMLDivElement>({ preset: "fadeUp", stagger: 0.12, children: true, delay: 0.1 });

  return (
    <section className="py-16 md:py-20 bg-background gradient-mesh">
      <div className="container">
        <div ref={headingRef} className="text-center mb-12">
          <h2 className="font-display text-2xl md:text-3xl font-bold">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Get your service done in 4 simple steps
          </p>
        </div>

        <div ref={stepsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={index}
              className="relative text-center p-6 group"
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-[60%] w-[80%] border-t-2 border-dashed border-border" />
              )}

              <div className={`w-14 h-14 rounded-2xl ${step.color} flex items-center justify-center mx-auto mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                {step.icon}
              </div>

              <div className="text-xs font-bold text-muted-foreground mb-1">STEP {index + 1}</div>
              <h3 className="font-display font-semibold text-base mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
