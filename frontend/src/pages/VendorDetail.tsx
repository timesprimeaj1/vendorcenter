import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MapPin, Star, BadgeCheck, Clock, Calendar, MessageSquare, Download, ChevronLeft, ChevronRight, X, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useScrollReveal } from "@/hooks/useScrollAnimation";

const placeholder = "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=600&fit=crop";

const VendorDetail = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation("services");

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [addressPincode, setAddressPincode] = useState<string>("");
  const [addressServiceable, setAddressServiceable] = useState<boolean | null>(null);
  const servicesRef = useScrollReveal({ preset: "fadeUp", delay: 0.1 });
  const bookingRef = useScrollReveal({ preset: "fadeRight", delay: 0.2 });

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["vendor-detail", vendorId],
    queryFn: async () => {
      const res = await api.getVendorDetail(vendorId!);
      return res.data;
    },
    enabled: !!vendorId,
  });

  const { data: addresses } = useQuery({
    queryKey: ["my-addresses"],
    queryFn: async () => {
      const res = await api.getAddresses();
      return res.data ?? [];
    },
    enabled: !!user && user.role === "customer",
  });

  // Auto-select default address
  useEffect(() => {
    if (addresses && addresses.length > 0 && !selectedAddressId) {
      const def = addresses.find((a: any) => a.isDefault) || addresses[0];
      setSelectedAddressId(def.id);
      setAddressPincode(def.pincode || "");
    }
  }, [addresses]);

  // Check serviceability when address changes
  useEffect(() => {
    if (!addressPincode || !/^\d{6}$/.test(addressPincode)) {
      setAddressServiceable(null);
      return;
    }
    api.checkServiceability(addressPincode)
      .then(res => setAddressServiceable(res.data?.serviceable ?? false))
      .catch(() => setAddressServiceable(null));
  }, [addressPincode]);

  const photos: string[] = (() => {
    const portfolioUrls = vendor?.portfolioUrls || [];
    if (portfolioUrls.length > 0) {
      return portfolioUrls.map((u: string) =>
        u.startsWith("http") || u.startsWith("/api/") ? u : `/api/uploads/files/${u}`
      );
    }
    // Fallback: use profile picture if available, else placeholder
    const pic = vendor?.profilePictureUrl;
    if (pic) {
      const url = pic.startsWith("http") || pic.startsWith("/api/") ? pic : `/api/uploads/files/${pic}`;
      return [url];
    }
    return [placeholder];
  })();

  const services: { id: string; serviceName: string; description: string; price: number }[] =
    (vendor?.services || []).map((s: any) => ({
      id: s.id,
      serviceName: s.name || s.serviceName,
      description: s.description || "",
      price: Number(s.price) || 0,
    }));

  const handleBooking = async () => {
    if (!user) { toast.error(t("vendorDetail.loginToBook")); return; }
    if (user.role !== "customer") {
      toast.error(t("vendorDetail.customerOnly"));
      return;
    }
    if (!selectedService) { toast.error(t("vendorDetail.selectService")); return; }
    if (!scheduledDate) { toast.error(t("vendorDetail.selectDate")); return; }
    if (!scheduledTime) { toast.error(t("vendorDetail.selectTime")); return; }
    if (!selectedAddressId) {
      toast.error("Please select a service address before booking.");
      return;
    }
    if (addressServiceable === false) {
      toast.error("Your selected address is not in a serviceable area yet. Please choose a different address.");
      return;
    }

    setBooking(true);
    try {
      await api.createBooking({
        vendorId: vendorId!,
        serviceName: selectedService,
        scheduledDate,
        scheduledTime,
        notes: notes || undefined,
        addressId: selectedAddressId || undefined,
        pincode: addressPincode || undefined,
      });
      toast.success(t("vendorDetail.bookingSent"));
      setScheduledDate("");
      setScheduledTime("");
      setNotes("");
      setSelectedService(null);
    } catch (err: any) {
      toast.error(err.message || t("vendorDetail.bookingFailed"));
    } finally {
      setBooking(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!vendor) {
    return (
      <Layout>
        <div className="container py-12 text-center">
          <h2 className="text-xl font-semibold mb-2">{t("vendorDetail.vendorNotFound")}</h2>
          <Button variant="outline" onClick={() => navigate("/services")}>{t("vendorDetail.backToServices")}</Button>
        </div>
      </Layout>
    );
  }

  const vendorName = vendor?.businessName || "Vendor";
  const isVerified = vendor?.verificationStatus === "approved";
  const zone = vendor?.zone || "";
  const workingHours = vendor?.workingHours || "";
  const categories: string[] = vendor?.serviceCategories || [];
  const profilePicture = vendor?.profilePictureUrl
    ? (vendor.profilePictureUrl.startsWith("http") || vendor.profilePictureUrl.startsWith("/api/")
        ? vendor.profilePictureUrl
        : `/api/uploads/files/${vendor.profilePictureUrl}`)
    : null;

  // Min date = tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  return (
    <Layout>
      {/* Back button */}
      <div className="bg-card/60 backdrop-blur-md border-b border-border/40">
        <div className="container py-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> {t("vendorDetail.back")}
          </button>
        </div>
      </div>

      {/* Photo Gallery — Professional Portfolio */}
      <div className="container pt-6">
        {photos.length === 1 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden cursor-pointer rounded-2xl max-h-[360px]"
            onClick={() => setLightboxIdx(0)}
          >
            <img src={photos[0]} alt={`${vendorName} photo`} className="w-full h-full object-cover" loading="lazy" />
          </motion.div>
        ) : photos.length === 2 ? (
          <div className="grid grid-cols-2 gap-2.5 rounded-2xl overflow-hidden max-h-[300px]">
            {photos.map((src, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="relative overflow-hidden cursor-pointer rounded-xl group"
                onClick={() => setLightboxIdx(i)}
              >
                <img src={src} alt={`${vendorName} photo ${i + 1}`} className="w-full h-full object-cover aspect-[4/3] group-hover:scale-105 transition-transform duration-500" loading="lazy" />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2 rounded-2xl overflow-hidden max-h-[340px]">
            {photos.slice(0, 5).map((src, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className={`relative overflow-hidden cursor-pointer rounded-xl group ${i === 0 ? "col-span-2 row-span-2" : ""}`}
                onClick={() => setLightboxIdx(i)}
              >
                <img src={src} alt={`${vendorName} photo ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                {i === 4 && photos.length > 5 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[2px]">
                    <span className="text-white font-semibold text-lg">+{photos.length - 5} more</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIdx !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setLightboxIdx(null)}
          >
            <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLightboxIdx(null)}><X className="w-6 h-6" /></button>
            {lightboxIdx > 0 && (
              <button className="absolute left-4 text-white/80 hover:text-white" onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}><ChevronLeft className="w-8 h-8" /></button>
            )}
            <img
              src={photos[lightboxIdx]}
              alt=""
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
              onClick={e => e.stopPropagation()}
            />
            {lightboxIdx < photos.length - 1 && (
              <button className="absolute right-4 text-white/80 hover:text-white" onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}><ChevronRight className="w-8 h-8" /></button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Vendor info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
              {profilePicture && (
                <img src={profilePicture} alt={vendorName} className="w-16 h-16 rounded-full object-cover border-2 border-primary/20" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-2xl md:text-3xl font-bold">{vendorName}</h1>
                  {isVerified && (
                    <Badge className="bg-success text-success-foreground border-0 text-xs gap-1">
                      <BadgeCheck className="w-3 h-3" /> {t("vendorDetail.verified")}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                  {zone && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {zone}</span>}
                  {workingHours && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {workingHours}</span>}
                </div>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {categories.map((c) => (
                    <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Services offered */}
            <div ref={servicesRef}>
              <h2 className="font-display font-semibold text-lg mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> {t("vendorDetail.servicesOffered")}
              </h2>
              {services.length > 0 ? (
                <div className="space-y-2.5">
                  {services.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setSelectedService(s.serviceName)}
                      className={`card-3d flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
                        selectedService === s.serviceName
                          ? "border-primary/60 bg-primary/10 shadow-[0_0_20px_rgba(249,115,22,0.12)]"
                          : "border-border/50 hover:border-primary/30 bg-card/60 backdrop-blur-sm hover:shadow-md"
                      }`}
                    >
                      <div>
                        <p className="font-medium">{s.serviceName}</p>
                        {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <span className="font-display font-bold text-primary text-lg">₹{s.price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{t("vendorDetail.noServicesListed")}</p>
              )}
            </div>
          </div>

          {/* Right: Booking form */}
          <div className="lg:col-span-1" ref={bookingRef}>
            <div className="sticky top-24 bg-card/80 backdrop-blur-xl border border-border/40 rounded-2xl p-5 space-y-4 shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
              <h3 className="font-display font-semibold text-lg">{t("vendorDetail.bookService")}</h3>

              {/* Selected service */}
              {selectedService ? (
                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                  <span className="text-sm font-medium">{selectedService}</span>
                  <button onClick={() => setSelectedService(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("vendorDetail.selectFromList")}</p>
              )}

              {/* Address selector */}
              {user && user.role === "customer" && (
                <div>
                  <label className="text-sm font-medium mb-1 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-primary" /> Service Address
                  </label>
                  {addresses && addresses.length > 0 ? (
                    <>
                      <select
                        value={selectedAddressId}
                        onChange={e => {
                          const addr = addresses.find((a: any) => a.id === e.target.value);
                          setSelectedAddressId(e.target.value);
                          setAddressPincode(addr?.pincode || "");
                        }}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Select an address</option>
                        {addresses.map((a: any) => (
                          <option key={a.id} value={a.id}>
                            {a.label} — {a.fullAddress?.slice(0, 40)}{a.fullAddress?.length > 40 ? "..." : ""} ({a.pincode})
                          </option>
                        ))}
                      </select>
                      {addressServiceable === true && (
                        <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> This area is serviceable
                        </p>
                      )}
                      {addressServiceable === false && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> This area may not be serviceable yet
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No saved addresses.{" "}
                      <button onClick={() => navigate("/addresses")} className="text-primary hover:underline">Add one</button>
                    </p>
                  )}
                </div>
              )}

              {/* Date picker */}
              <div>
                <label className="text-sm font-medium mb-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-primary" /> {t("vendorDetail.date")}
                </label>
                <div className="glow-focus rounded-xl">
                  <Input
                    type="date"
                    value={scheduledDate}
                    min={minDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>

              {/* Time picker */}
              <div>
                <label className="text-sm font-medium mb-1 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary" /> {t("vendorDetail.time")}
                </label>
                <div className="glow-focus rounded-xl">
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium mb-1 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-primary" /> {t("vendorDetail.notesOptional")}
                </label>
                <div className="glow-focus rounded-xl">
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    maxLength={500}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder={t("vendorDetail.notesPlaceholder")}
                  />
                </div>
              </div>

              <Button
                className="w-full gradient-bg text-primary-foreground border-0 rounded-xl h-11 btn-press shadow-lg hover:shadow-xl transition-shadow"
                disabled={!selectedService || !scheduledDate || !scheduledTime || !selectedAddressId || addressServiceable === false || booking}
                onClick={handleBooking}
              >
                {booking ? t("vendorDetail.sending") : t("vendorDetail.requestBooking")}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                {t("vendorDetail.selectBeforeSubmit")}
              </p>
              <p className="text-xs text-muted-foreground text-center">
                {t("vendorDetail.vendorWillReview")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default VendorDetail;
