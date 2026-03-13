import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { User, ClipboardList, Settings, X, MapPin, Clock, CheckCircle2, XCircle, Loader2, AlertCircle, Download, CalendarDays, Camera, Star } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Tab = "bookings" | "settings";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  confirmed: <CheckCircle2 className="w-4 h-4" />,
  in_progress: <Loader2 className="w-4 h-4 animate-spin" />,
  completed: <CheckCircle2 className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
};

const Account = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, logout, updateUser, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const initialTab = (searchParams.get("tab") as Tab) || "bookings";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [editOpen, setEditOpen] = useState(false);
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Fetch which bookings already have reviews
  const { data: reviewedBookingIds, refetch: refetchReviewed } = useQuery({
    queryKey: ["my-reviewed-bookings"],
    queryFn: async () => {
      const res = await api.getMyReviewedBookings();
      return new Set(res.data ?? []);
    },
    enabled: !!user,
  });
  const reviewedBookings = reviewedBookingIds ?? new Set<string>();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  // Fetch profile
  const { data: profile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await api.getProfile();
      return res.data;
    },
    enabled: !!user,
  });

  // Fetch bookings
  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["user-bookings"],
    queryFn: async () => {
      const res = await api.getBookings();
      return res.data ?? [];
    },
    enabled: !!user,
  });

  if (authLoading || !user) return null;

  const downloadReceipt = async (bookingId: string) => {
    try {
      const blob = await api.downloadReceipt(bookingId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${bookingId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download receipt");
    }
  };

  const submitReview = async (bookingId: string) => {
    if (reviewRating < 1) { toast.error("Please select a rating"); return; }
    setSubmittingReview(true);
    try {
      await api.createReview({ bookingId, rating: reviewRating, reviewText: reviewText.trim() || undefined });
      toast.success("Review submitted! Thank you.");
      refetchReviewed();
      setReviewBookingId(null);
      setReviewRating(0);
      setReviewText("");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const displayName = profile?.name || user.name || user.email.split("@")[0];
  const displayPhone = profile?.phone || user.phone || "Not set";
  const displayEmail = profile?.email || user.email;
  const profilePicUrl = (profile as any)?.profilePictureUrl
    ? ((profile as any).profilePictureUrl.startsWith("http") || (profile as any).profilePictureUrl.startsWith("/api/")
        ? (profile as any).profilePictureUrl
        : `/api/uploads/files/${(profile as any).profilePictureUrl}`)
    : null;

  const tabs = [
    { key: "bookings" as Tab, label: "Bookings", icon: <ClipboardList className="w-5 h-5" /> },
    { key: "settings" as Tab, label: "Settings", icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <Layout>
      {/* Profile header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 text-white">
        <div className="container py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {profilePicUrl ? (
                <img src={profilePicUrl} alt={displayName} className="w-16 h-16 rounded-full object-cover border-2 border-white/30" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="w-8 h-8 text-white/70" />
                </div>
              )}
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">{displayName}</h1>
                <p className="text-sm text-white/70 mt-1">
                  {displayPhone} &nbsp;&middot;&nbsp; {displayEmail}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="border-white/50 text-white bg-white/10 hover:bg-white/20 rounded-xl"
              onClick={() => setEditOpen(true)}
            >
              EDIT PROFILE
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <aside className="md:w-64 shrink-0">
            <nav className="flex md:flex-col gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors w-full text-left ${
                    activeTab === tab.key
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {activeTab === "bookings" && (
              <div>
                <h2 className="text-xl font-bold mb-4">Your Bookings</h2>
                {bookingsLoading ? (
                  <div className="flex items-center gap-3 py-8 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading bookings...
                  </div>
                ) : !bookings || bookings.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium">No bookings yet</p>
                    <p className="text-sm mt-1">Your bookings will appear here after you book a service.</p>
                    <Button className="mt-4 rounded-xl" onClick={() => navigate("/services")}>
                      Browse Services
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bookings.map((booking: any) => (
                      <div
                        key={booking.id}
                        className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-base">{booking.serviceName}</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              ORDER #{booking.transactionId} &nbsp;|&nbsp; {new Date(booking.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                            </p>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[booking.status] || "bg-gray-100 text-gray-800"}`}>
                            {statusIcons[booking.status]}
                            {booking.status.replace("_", " ")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                          <div className="space-y-0.5">
                            {booking.scheduledDate && (
                              <span className="text-xs text-primary font-medium flex items-center gap-1">
                                <CalendarDays className="w-3 h-3" />
                                {new Date(booking.scheduledDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                {booking.scheduledTime && ` at ${booking.scheduledTime}`}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              Payment: {booking.paymentStatus}
                            </span>
                          </div>
                          {(booking.status === "confirmed" || booking.status === "completed") && (
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" className="text-xs rounded-lg" onClick={() => downloadReceipt(booking.id)}>
                                <Download className="w-3 h-3 mr-1" /> Receipt
                              </Button>
                              {booking.status === "completed" && !reviewedBookings.has(booking.id) && reviewBookingId !== booking.id && (
                                <Button
                                  size="sm"
                                  className="text-xs rounded-lg"
                                  onClick={() => { setReviewBookingId(booking.id); setReviewRating(0); setReviewText(""); }}
                                >
                                  <Star className="w-3 h-3 mr-1" /> Write Review
                                </Button>
                              )}
                              {reviewedBookings.has(booking.id) && (
                                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Reviewed
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Inline Review Form */}
                        {reviewBookingId === booking.id && (
                          <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                            <div>
                              <p className="text-sm font-medium mb-1">Rate your experience</p>
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => setReviewRating(star)}
                                    className="p-0.5 transition-transform hover:scale-110"
                                  >
                                    <Star
                                      className={`w-6 h-6 ${star <= reviewRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <textarea
                                placeholder="Tell us about your experience (optional)"
                                className="w-full text-sm border border-border rounded-lg p-2.5 resize-none bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                                rows={3}
                                value={reviewText}
                                onChange={(e) => setReviewText(e.target.value)}
                                maxLength={2000}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="text-xs rounded-lg"
                                onClick={() => submitReview(booking.id)}
                                disabled={submittingReview || reviewRating < 1}
                              >
                                {submittingReview ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                Submit Review
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs rounded-lg"
                                onClick={() => { setReviewBookingId(null); setReviewRating(0); setReviewText(""); }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "settings" && (
              <div>
                <h2 className="text-xl font-bold mb-4">Account Settings</h2>
                <div className="bg-card border border-border rounded-xl divide-y divide-border">
                  <div className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="text-sm font-semibold">Name</p>
                      <p className="text-sm text-muted-foreground">{displayName}</p>
                    </div>
                    <button onClick={() => setEditOpen(true)} className="text-sm font-semibold text-primary hover:underline">
                      CHANGE
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="text-sm font-semibold">Phone number</p>
                      <p className="text-sm text-muted-foreground">{displayPhone}</p>
                    </div>
                    <button onClick={() => setEditOpen(true)} className="text-sm font-semibold text-primary hover:underline">
                      CHANGE
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="text-sm font-semibold">Email</p>
                      <p className="text-sm text-muted-foreground">{displayEmail}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Edit Profile side panel */}
      <EditProfilePanel
        open={editOpen}
        onClose={() => setEditOpen(false)}
        profile={{
          name: (profile?.name ?? user.name ?? "").trim(),
          phone: String(profile?.phone ?? user.phone ?? "").trim(),
          email: displayEmail,
          profilePictureUrl: (profile as any)?.profilePictureUrl,
        }}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["user-profile"] });
          // Re-fetch profile and update auth context + localStorage
          api.getProfile().then((res) => {
            if (res.data) {
              updateUser({
                name: res.data.name ?? undefined,
                phone: res.data.phone ?? undefined,
              });
            }
          });
        }}
      />
    </Layout>
  );
};

// ─── Edit Profile Panel ─────────────────────────
function EditProfilePanel({ open, onClose, profile, onSaved }: {
  open: boolean;
  onClose: () => void;
  profile: { name: string; phone: string; email: string; profilePictureUrl?: string | null };
  onSaved: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [phoneError, setPhoneError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [newPicUrl, setNewPicUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(profile.name ?? "");
    setPhone(profile.phone ?? "");
    setNewPicUrl(null);
    setPreviewUrl(profile.profilePictureUrl
      ? (profile.profilePictureUrl.startsWith("http") || profile.profilePictureUrl.startsWith("/api/")
          ? profile.profilePictureUrl
          : `/api/uploads/files/${profile.profilePictureUrl}`)
      : null);
  }, [open, profile.name, profile.phone, profile.profilePictureUrl]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    try {
      const result = await api.uploadFile(file);
      setNewPicUrl(result.url);
    } catch {
      toast.error("Photo upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (phone && !/^\d{10}$/.test(phone)) {
      setPhoneError("Phone number must be exactly 10 digits");
      return;
    }
    setPhoneError("");
    setSaving(true);
    try {
      await api.updateProfile({
        name: name || undefined,
        phone: phone || undefined,
        profilePictureUrl: newPicUrl || undefined,
      });
      toast.success("Profile updated!");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-background z-[61] shadow-2xl flex flex-col"
          >
            <div className="flex items-center gap-3 p-5 border-b border-border">
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold">Edit profile</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Profile picture */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Profile" className="w-24 h-24 rounded-full object-cover border-2 border-primary/20" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center">
                      <User className="w-10 h-10 text-muted-foreground" />
                    </div>
                  )}
                  <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-md hover:opacity-90">
                    <Camera className="w-4 h-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </label>
                </div>
                {uploading && <p className="text-xs text-muted-foreground mt-2">Uploading...</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="h-12 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Phone number</label>
                <Input
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setPhone(val);
                    setPhoneError("");
                  }}
                  placeholder="10-digit phone number"
                  className={`h-12 rounded-lg ${phoneError ? "border-red-500" : ""}`}
                  maxLength={10}
                  inputMode="numeric"
                />
                {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
                {phone && phone.length < 10 && !phoneError && (
                  <p className="text-xs text-muted-foreground mt-1">{phone.length}/10 digits</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Email</label>
                <Input
                  value={profile.email}
                  disabled
                  className="h-12 rounded-lg bg-secondary/50"
                />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
              </div>
            </div>

            <div className="p-5 border-t border-border">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-12 rounded-xl gradient-bg text-primary-foreground font-semibold"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default Account;
