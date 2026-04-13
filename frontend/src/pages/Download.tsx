import { motion } from "framer-motion";
import { Download as DownloadIcon, Smartphone, Shield, RefreshCw, Monitor } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useEffect, useState, useMemo, useCallback } from "react";

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };

interface VersionInfo {
  currentVersion: string;
  changelog: string;
  customerApk: string;
  vendorApk: string;
}

const DownloadPage = () => {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const isMobile = useMemo(() => /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent), []);

  useEffect(() => {
    fetch("/api/version").then((r) => r.json()).then((res) => {
      if (res?.data) setVersion(res.data);
    }).catch(() => {});
  }, []);

  const customerApk = version?.customerApk || "https://github.com/timesprimeaj1/vendorcenter/releases/latest/download/vendorcenter-customer.apk";
  const vendorApk = version?.vendorApk || "https://github.com/timesprimeaj1/vendorcenter/releases/latest/download/vendorcenter-vendor.apk";
  const currentVersion = version?.currentVersion || "1.1.1";
  const changelog = version?.changelog || "Firebase auth fix, service zones, vendor availability, bug fixes";

  const triggerDownload = useCallback((url: string) => {
    // Trigger download without navigating away — avoids blank GitHub page on mobile
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', '');
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return (
    <Layout>
      <section className="relative overflow-hidden gradient-hero text-white">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-primary/15 blur-[100px] animate-float-slow" />
          <div className="absolute bottom-0 -left-20 w-[320px] h-[320px] rounded-full bg-accent/10 blur-[80px] animate-float" style={{ animationDelay: "1.5s" }} />
        </div>
        <div className="container relative py-20 md:py-28 text-center max-w-3xl mx-auto">
          <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/[0.08] backdrop-blur-md border border-white/[0.12] mb-6">
              <Smartphone className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-semibold tracking-widest uppercase text-white/90">Mobile Apps</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Download VendorCenter</h1>
            <p className="text-lg text-white/80 mb-2">Get the app for Android — available for both customers and vendors.</p>
            <p className="text-sm text-white/60">Version {currentVersion}</p>
          </motion.div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-background">
        <div className="container max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Desktop Notice */}
            {!isMobile && (
              <motion.div
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="md:col-span-2 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center"
              >
                <Monitor className="w-10 h-10 text-primary mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">Open this page on your Android phone</h3>
                <p className="text-muted-foreground text-sm mb-3">
                  APK files can only be installed on Android devices. Visit <strong>vendorcenter.in/download</strong> on your phone to download directly.
                </p>
              </motion.div>
            )}
            {/* Customer App */}
            <motion.div
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border bg-card p-8 text-center shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Smartphone className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Customer App</h2>
              <p className="text-muted-foreground mb-6">
                Find trusted local service providers, book services, make payments, and track your bookings.
              </p>
              <button
                onClick={() => triggerDownload(customerApk)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
              >
                <DownloadIcon className="w-5 h-5" />
                Download Customer APK
              </button>
            </motion.div>

            {/* Vendor App */}
            <motion.div
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="rounded-2xl border bg-card p-8 text-center shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-orange-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Vendor App</h2>
              <p className="text-muted-foreground mb-6">
                Manage your services, accept bookings, track payments, and grow your business.
              </p>
              <button
                onClick={() => triggerDownload(vendorApk)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors cursor-pointer"
              >
                <DownloadIcon className="w-5 h-5" />
                Download Vendor APK
              </button>
            </motion.div>
          </div>

          {/* What's New */}
          {changelog && (
            <motion.div
              variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-12 rounded-2xl border bg-card p-8"
            >
              <div className="flex items-center gap-3 mb-4">
                <RefreshCw className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">What's New in v{currentVersion}</h3>
              </div>
              <p className="text-muted-foreground">{changelog}</p>
            </motion.div>
          )}

          {/* Install Instructions */}
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 rounded-2xl border bg-muted/50 p-8"
          >
            <h3 className="text-lg font-semibold mb-4">How to Install</h3>
            <ol className="space-y-3 text-muted-foreground list-decimal list-inside">
              <li>Tap the download button above on your Android phone.</li>
              <li>Open the downloaded APK file from your notifications or file manager.</li>
              <li>If prompted, allow installation from unknown sources in your device settings.</li>
              <li>Tap <strong>Install</strong> and wait for the installation to complete.</li>
              <li>Open VendorCenter and sign in with your phone number or email.</li>
            </ol>
            <p className="mt-4 text-sm text-muted-foreground/70">
              Requires Android 6.0 or later. iOS version coming soon.
            </p>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default DownloadPage;
