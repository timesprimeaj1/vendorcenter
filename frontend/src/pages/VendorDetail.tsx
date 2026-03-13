import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MapPin, Star, BadgeCheck, Clock, Calendar, MessageSquare, Download, ChevronLeft, ChevronRight, X } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const placeholder = "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=600&fit=crop";

const VendorDetail = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["vendor-detail", vendorId],
    queryFn: async () => {
      const res = await api.getVendorDetail(vendorId!);
      return res.data;
    },
    enabled: !!vendorId,
  });

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
    if (!user) { toast.error("Please log in to book"); return; }
    if (user.role !== "customer") {
      toast.error("Bookings can be requested only from a customer account. Please log in as customer.");
      return;
    }
    if (!selectedService) { toast.error("Please select a service"); return; }
    if (!scheduledDate) { toast.error("Please select a date"); return; }
    if (!scheduledTime) { toast.error("Please select a time"); return; }

    setBooking(true);
    try {
      await api.createBooking({
        vendorId: vendorId!,
        serviceName: selectedService,
        scheduledDate,
        scheduledTime,
        notes: notes || undefined,
      });
      toast.success("Booking request sent! The vendor will confirm shortly.");
      setScheduledDate("");
      setScheduledTime("");
      setNotes("");
      setSelectedService(null);
    } catch (err: any) {
      toast.error(err.message || "Booking failed");
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
          <h2 className="text-xl font-semibold mb-2">Vendor not found</h2>
          <Button variant="outline" onClick={() => navigate("/services")}>Back to Services</Button>
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
      <div className="bg-secondary/50 border-b border-border">
        <div className="container py-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>
      </div>

      {/* Photo Gallery */}
      <div className="container pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 rounded-2xl overflow-hidden max-h-[320px]">
          {photos.slice(0, 4).map((src, i) => (
            <div
              key={i}
              className={`relative overflow-hidden cursor-pointer ${i === 0 ? "col-span-2 row-span-2" : ""}`}
              onClick={() => setLightboxIdx(i)}
            >
              <img src={src} alt={`${vendorName} photo ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" loading="lazy" />
              {i === 3 && photos.length > 4 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white font-semibold text-lg">+{photos.length - 4} more</span>
                </div>
              )}
            </div>
          ))}
        </div>
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
                      <BadgeCheck className="w-3 h-3" /> Verified
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
            <div>
              <h2 className="font-display font-semibold text-lg mb-3">Services Offered</h2>
              {services.length > 0 ? (
                <div className="space-y-2">
                  {services.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setSelectedService(s.serviceName)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                        selectedService === s.serviceName
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <div>
                        <p className="font-medium">{s.serviceName}</p>
                        {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <span className="font-display font-bold text-primary">₹{s.price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No services listed yet.</p>
              )}
            </div>
          </div>

          {/* Right: Booking form */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-card border border-border/60 rounded-2xl p-5 space-y-4 shadow-sm">
              <h3 className="font-display font-semibold text-lg">Book a Service</h3>

              {/* Selected service */}
              {selectedService ? (
                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                  <span className="text-sm font-medium">{selectedService}</span>
                  <button onClick={() => setSelectedService(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a service from the list</p>
              )}

              {/* Date picker */}
              <div>
                <label className="text-sm font-medium mb-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-primary" /> Date
                </label>
                <Input
                  type="date"
                  value={scheduledDate}
                  min={minDate}
                  onChange={e => setScheduledDate(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              {/* Time picker */}
              <div>
                <label className="text-sm font-medium mb-1 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary" /> Time
                </label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={e => setScheduledTime(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium mb-1 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-primary" /> Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  maxLength={500}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Any special requirements..."
                />
              </div>

              <Button
                className="w-full gradient-bg text-primary-foreground border-0 rounded-xl h-11"
                disabled={!selectedService || !scheduledDate || !scheduledTime || booking}
                onClick={handleBooking}
              >
                {booking ? "Sending..." : "Request Booking"}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Select a service, date, and time before submitting your booking request.
              </p>
              <p className="text-xs text-muted-foreground text-center">
                The vendor will review and confirm your booking
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default VendorDetail;
