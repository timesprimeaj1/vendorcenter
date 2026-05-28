import Layout from "@/components/layout/Layout";
import HeroSection from "@/components/home/HeroSection";
import CategoriesSection from "@/components/home/CategoriesSection";
import FeaturedVendors from "@/components/home/FeaturedVendors";
import HowItWorks from "@/components/home/HowItWorks";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import CTASection from "@/components/home/CTASection";
import SEO from "@/components/SEO";
import { JsonLd } from "@/components/JsonLd";

const Index = () => {
  return (
    <Layout>
      <SEO path="/" />
      <JsonLd schema={[
        {
          "@type": "LocalBusiness",
          "name": "VendorCenter",
          "url": "https://vendorcenter.in",
          "logo": "https://vendorcenter.in/favicon.svg",
          "description": "India's trusted marketplace for local services. Connect with verified vendors for home services, repairs, and more.",
          "address": { "@type": "PostalAddress", "addressCountry": "IN" }
        },
        {
          "@type": "WebSite",
          "name": "VendorCenter",
          "url": "https://vendorcenter.in",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://vendorcenter.in/services?category={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        }
      ]} />
      <HeroSection />
      <CategoriesSection />
      <div className="section-divider" />
      <FeaturedVendors />
      <div className="section-divider" />
      <HowItWorks />
      <div className="section-divider" />
      <TestimonialsSection />
      <div className="section-divider" />
      <CTASection />
    </Layout>
  );
};

export default Index;
