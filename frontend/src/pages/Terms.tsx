import { motion } from "framer-motion";
import { FileText, Shield, Users, Store, Globe } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useScrollReveal } from "@/hooks/useScrollAnimation";

const sections = [
  { icon: <Globe className="w-5 h-5" />, title: "Platform Usage", body: "Users must not abuse the platform, bypass security controls, or interfere with bookings, payments, or service operations." },
  { icon: <Store className="w-5 h-5" />, title: "Vendor Responsibility", body: "Vendors are responsible for accurate service information, lawful conduct, and professional service delivery." },
  { icon: <Users className="w-5 h-5" />, title: "Customer Responsibility", body: "Customers must provide correct booking details, be available for scheduled appointments, and follow platform payment and cancellation rules." },
  { icon: <Shield className="w-5 h-5" />, title: "Service Availability", body: "Availability, pricing, and timelines depend on vendor coverage area, service radius, and real-time booking conditions." },
];

const Terms = () => {
  const cardsRef = useScrollReveal<HTMLDivElement>({ preset: "fadeUp", stagger: 0.1, children: true });

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden gradient-hero text-white">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-32 -right-32 w-[360px] h-[360px] rounded-full bg-primary/12 blur-[90px] animate-float-slow" />
          <div className="absolute bottom-0 -left-16 w-[280px] h-[280px] rounded-full bg-accent/8 blur-[70px] animate-float" style={{ animationDelay: "1.5s" }} />
          <div className="absolute inset-0 gradient-mesh opacity-25" />
        </div>
        <div className="container relative py-16 md:py-24 text-center max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.12] mb-6">
              <FileText className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-semibold tracking-widest uppercase text-white/90">Terms of Service</span>
            </div>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="font-display text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-4 tracking-tight">
            Terms of Service
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="text-lg text-white/60 max-w-xl mx-auto">
            By using VendorCenter, you agree to use the platform lawfully and provide accurate account and booking details.
          </motion.p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-20">
        <div ref={cardsRef} className="container max-w-3xl space-y-6">
          {sections.map((s, i) => (
            <div key={i} className="p-6 rounded-2xl bg-card border border-border/60 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                  {s.icon}
                </div>
                <div>
                  <h2 className="font-display font-semibold text-lg mb-2">{s.title}</h2>
                  <p className="text-muted-foreground leading-7">{s.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </Layout>
  );
};

export default Terms;
