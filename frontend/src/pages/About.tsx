import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Shield, Users, MapPin, Sparkles, Target, Heart, ArrowRight } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useScrollReveal } from "@/hooks/useScrollAnimation";

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

const About = () => {
  const { t } = useTranslation("home");
  const valuesRef = useScrollReveal<HTMLDivElement>({ preset: "fadeUp", stagger: 0.12, children: true });
  const storyRef = useScrollReveal<HTMLDivElement>({ preset: "fadeUp", delay: 0.1 });

  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden gradient-hero text-white">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-primary/15 blur-[100px] animate-float-slow" />
          <div className="absolute bottom-0 -left-20 w-[320px] h-[320px] rounded-full bg-accent/10 blur-[80px] animate-float" style={{ animationDelay: "1.5s" }} />
          <div className="absolute inset-0 gradient-mesh opacity-30" />
        </div>
        <div className="container relative py-20 md:py-28 text-center max-w-3xl mx-auto">
          <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.12] mb-6">
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-semibold tracking-widest uppercase text-white/90">{t("about.badge")}</span>
            </div>
          </motion.div>
          <motion.h1 variants={fadeUp} initial="hidden" animate="visible" transition={{ duration: 0.7, delay: 0.1 }} className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6 tracking-tight">
            {t("about.titleStart")}{" "}
            <span className="gradient-text">{t("about.titleHighlight")}</span>
          </motion.h1>
          <motion.p variants={fadeUp} initial="hidden" animate="visible" transition={{ duration: 0.6, delay: 0.2 }} className="text-lg md:text-xl text-white/65 leading-relaxed max-w-xl mx-auto">
            {t("about.tagline")}
          </motion.p>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">{t("about.whatDrivesUs")}</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">{t("about.whatDrivesUsSubtitle")}</p>
          </div>
          <div ref={valuesRef} className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { icon: <Shield className="w-6 h-6" />, title: t("about.values.trust.title"), desc: t("about.values.trust.description") },
              { icon: <Target className="w-6 h-6" />, title: t("about.values.quality.title"), desc: t("about.values.quality.description") },
              { icon: <Heart className="w-6 h-6" />, title: t("about.values.customer.title"), desc: t("about.values.customer.description") },
            ].map((v, i) => (
              <div key={i} className="p-6 rounded-2xl bg-card border border-border/60 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 card-3d">
                <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center mb-4 text-white">
                  {v.icon}
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{v.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 md:py-24 bg-secondary/30">
        <div ref={storyRef} className="container max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">{t("about.storyTitle")}</h2>
              <p className="text-muted-foreground leading-7 mb-4">
                {t("about.storyParagraph1")}
              </p>
              <p className="text-muted-foreground leading-7">
                {t("about.storyParagraph2")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: <Users className="w-5 h-5" />, label: t("about.stats.customersServed"), value: t("about.stats.growingDaily") },
                { icon: <MapPin className="w-5 h-5" />, label: t("about.stats.citiesActive"), value: t("about.stats.maharashtra") },
                { icon: <Shield className="w-5 h-5" />, label: t("about.stats.vendorsVerified"), value: t("about.stats.hundredPercent") },
                { icon: <Sparkles className="w-5 h-5" />, label: t("about.stats.aiDiscovery"), value: t("about.stats.smartMatch") },
              ].map((s, i) => (
                <div key={i} className="p-4 rounded-xl bg-card border border-border/60 text-center hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2 text-primary">
                    {s.icon}
                  </div>
                  <p className="font-display font-bold text-sm">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20">
        <div className="container text-center max-w-2xl mx-auto">
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">{t("about.ctaTitle")}</h2>
          <p className="text-muted-foreground mb-8">{t("about.ctaDescription")}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/services" className="inline-flex items-center justify-center h-12 px-6 gradient-bg text-primary-foreground rounded-xl font-semibold btn-press shadow-lg hover:shadow-xl transition-all">
              {t("about.exploreServices")} <ArrowRight className="w-4 h-4 ml-1.5" />
            </Link>
            <Link to="/register?role=vendor" className="inline-flex items-center justify-center h-12 px-6 bg-card border border-border text-foreground rounded-xl font-semibold hover:bg-secondary transition-colors">
              {t("about.becomeVendor")}
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default About;
