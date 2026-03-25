import { Link } from "react-router-dom";
import { MapPin, Mail, Phone, Instagram, Twitter, Facebook, Linkedin } from "lucide-react";
import { useTranslation } from "react-i18next";

const socialLinks = [
  { Icon: Instagram, href: "https://instagram.com" },
  { Icon: Twitter, href: "https://twitter.com" },
  { Icon: Facebook, href: "https://facebook.com" },
  { Icon: Linkedin, href: "https://linkedin.com" },
];

const Footer = () => {
  const { t } = useTranslation("common");

  const companyLinks: { label: string; to: string }[] = [
    { label: t("nav.about"), to: "/about" },
    { label: t("nav.services"), to: "/services" },
    { label: t("nav.explore"), to: "/explore" },
  ];

  const vendorLinks: { label: string; href?: string; to?: string }[] = [
    { label: t("nav.register"), to: "/register" },
    { label: t("footer.vendorDashboard"), href: "/vendor/dashboard" },
    { label: t("nav.login"), to: "/login" },
    { label: t("footer.support"), href: "mailto:support@vendorcenter.in" },
  ];

  return (
    <footer className="bg-foreground text-background/80">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg gradient-bg flex items-center justify-center">
                <span translate="no" className="notranslate text-primary-foreground font-display font-bold text-lg">{t("brandLogo")}</span>
              </div>
              <span translate="no" className="notranslate font-display font-bold text-xl text-background">
                {t("brandName")}
              </span>
            </Link>
            <p className="text-sm text-background/60 leading-relaxed mb-4">
              {t("footer.tagline")}
            </p>
            <div className="flex gap-3">
              {socialLinks.map(({ Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-background/10 flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-display font-semibold text-background mb-4 text-sm uppercase tracking-wider">{t("footer.company")}</h4>
            <ul className="space-y-2.5">
              {companyLinks.map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className="text-sm text-background/60 hover:text-primary transition-colors">{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Vendor Links */}
          <div>
            <h4 className="font-display font-semibold text-background mb-4 text-sm uppercase tracking-wider">{t("footer.forVendors")}</h4>
            <ul className="space-y-2.5">
              {vendorLinks.map((item) => (
                <li key={item.label}>
                  {item.to ? (
                    <Link to={item.to} className="text-sm text-background/60 hover:text-primary transition-colors">{item.label}</Link>
                  ) : (
                    <a href={item.href} target="_blank" rel="noopener noreferrer" className="text-sm text-background/60 hover:text-primary transition-colors">{item.label}</a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold text-background mb-4 text-sm uppercase tracking-wider">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-background/60">
                <Mail className="w-4 h-4 mt-0.5 shrink-0" />
                <a href="mailto:support@vendorcenter.in" className="hover:text-primary transition-colors">support@vendorcenter.in</a>
              </li>
              <li className="flex items-start gap-2 text-sm text-background/60">
                <Phone className="w-4 h-4 mt-0.5 shrink-0" />
                <span>8123456789</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-background/60">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <a
                  href="https://maps.google.com/?q=Ratnagiri,+Maharashtra"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  {t("footer.location")}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-background/10 mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-background/40">{t("footer.copyright")}</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="text-xs text-background/40 hover:text-background/70 transition-colors">{t("footer.privacyPolicy")}</Link>
            <Link to="/terms" className="text-xs text-background/40 hover:text-background/70 transition-colors">{t("footer.termsOfService")}</Link>
            <Link to="/cookies" className="text-xs text-background/40 hover:text-background/70 transition-colors">{t("footer.cookiePolicy")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
