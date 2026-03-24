import Layout from "@/components/layout/Layout";
import HeroSection from "@/components/home/HeroSection";
import CategoriesSection from "@/components/home/CategoriesSection";
import FeaturedVendors from "@/components/home/FeaturedVendors";
import HowItWorks from "@/components/home/HowItWorks";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import CTASection from "@/components/home/CTASection";

const Index = () => {
  return (
    <Layout>
      <HeroSection />
      <div className="section-divider" />
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
