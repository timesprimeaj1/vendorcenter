import { motion } from "framer-motion";
import { Cookie, Key, Settings, HardDrive } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useScrollReveal } from "@/hooks/useScrollAnimation";

const sections = [
  { icon: <Cookie className="w-5 h-5" />, title: "Functional Cookie In Use", body: "We use a functional cookie named sidebar:state to remember UI sidebar open or collapsed state. It is set at path / with a max age of 7 days." },
  { icon: <HardDrive className="w-5 h-5" />, title: "What Is Stored Outside Cookies", body: "Authentication data is stored in browser local storage using role-specific keys such as customer_accessToken, customer_refreshToken, vendor_accessToken, and vendor_refreshToken. These are not cookie values." },
  { icon: <Key className="w-5 h-5" />, title: "Why We Use Them", body: "This storage is used to keep users signed in, support token refresh, and preserve interface preferences. It helps maintain secure and consistent sessions across page navigation." },
];

const Cookies = () => {
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
              <Settings className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-semibold tracking-widest uppercase text-white/90">Cookie Policy</span>
            </div>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="font-display text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-4 tracking-tight">
            Cookie Policy
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="text-lg text-white/60 max-w-xl mx-auto">
            VendorCenter uses minimal cookies and relies mainly on browser local storage for session tokens.
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

export default Cookies;
