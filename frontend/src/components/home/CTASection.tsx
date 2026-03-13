import { motion } from "framer-motion";
import { ArrowRight, Store, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-16 md:py-20 bg-background">
      <div className="container">
        <div className="grid md:grid-cols-2 gap-6">
          {/* For Customers */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden p-8 md:p-10 rounded-3xl gradient-hero text-background"
          >
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/20 blur-2xl" />
            <Users className="w-10 h-10 text-primary mb-4" />
            <h3 className="font-display text-2xl font-bold mb-2">Looking for a Service?</h3>
            <p className="text-background/70 mb-6 text-sm leading-relaxed">
              Browse thousands of verified vendors, compare prices, and book in seconds. Your perfect service provider is just a tap away.
            </p>
            <Button
              onClick={() => navigate("/services")}
              size="lg"
              className="gradient-bg text-primary-foreground border-0 rounded-xl font-semibold"
            >
              Explore Services
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </motion.div>

          {/* For Vendors */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative overflow-hidden p-8 md:p-10 rounded-3xl bg-card border-2 border-primary/20"
          >
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 blur-2xl" />
            <Store className="w-10 h-10 text-primary mb-4" />
            <h3 className="font-display text-2xl font-bold mb-2">Grow Your Business</h3>
            <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
              Join VendorCenter and reach thousands of customers in your area. Set up your profile, manage bookings, and watch your business grow.
            </p>
            <Button
              onClick={() => { window.location.href = "/vendor/register"; }}
              variant="outline"
              size="lg"
              className="rounded-xl font-semibold border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Register as Vendor
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
