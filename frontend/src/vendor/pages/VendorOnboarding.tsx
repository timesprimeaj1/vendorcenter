import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Loader2, Store, MapPin, Clock, LogOut, LocateFixed, ImagePlus, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/vendor/hooks/useVendorAuth";
import { vendorApi as api } from "@/vendor/lib/vendorApi";
import { toast } from "sonner";
import { MapErrorBoundary } from "@/vendor/components/MapErrorBoundary";
import LocationPicker from "@/vendor/components/LocationPicker";
import PlaceAutocompleteInput from "@/vendor/components/PlaceAutocompleteInput";

const SERVICE_CATEGORIES = [
  "Cleaning", "Plumbing", "Electrical", "Painting",
  "Carpentry", "Pest Control", "AC Repair", "Salon",
  "Appliance Repair", "Moving", "Photography", "Catering"
];
const VENDOR_SIGNUP_PREFILL_KEY = "vendor_signup_prefill";

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    const a = data.address || {};
    // Build a readable area string: suburb/neighbourhood, city, state
    const parts = [
      a.suburb || a.neighbourhood || a.village || a.town || "",
      a.city || a.state_district || "",
      a.state || "",
    ].filter(Boolean);
    return parts.join(", ") || data.display_name || "";
  } catch {
    return "";
  }
}

const VendorOnboarding = () => {
  const { user, logout, loading: authLoading, setOnboardingStatus } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [otherCategory, setOtherCategory] = useState("");
  const [zone, setZone] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [serviceRadius, setServiceRadius] = useState("10");
  const [workingHours, setWorkingHours] = useState("9:00 AM - 6:00 PM");
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [portfolioFiles, setPortfolioFiles] = useState<{ file: File; preview: string }[]>([]);
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPhone, setAccountPhone] = useState("");
  const [businessNameLocked, setBusinessNameLocked] = useState(false);

  // Pre-fill from signed-up account details and local signup draft.
  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (!user) return;

    let isMounted = true;

    const hydratePrefill = async () => {
      let nextBusinessName = (user.businessName || "").trim();
      let nextName = (user.name || "").trim();
      let nextPhone = (user.phone || "").trim();
      const nextEmail = (user.email || "").trim();

      try {
        const profileRes = await api.getProfile();
        const profile = profileRes.data;
        if (profile) {
          nextName = (profile.name || "").trim() || nextName;
          nextPhone = (profile.phone || "").trim() || nextPhone;
          nextBusinessName = (profile.businessName || "").trim() || nextBusinessName;
        }
      } catch {
        // Ignore profile fetch failures; user session data still gives fallback values.
      }

      try {
        const raw = localStorage.getItem(VENDOR_SIGNUP_PREFILL_KEY);
        if (raw) {
          const draft = JSON.parse(raw) as {
            email?: string;
            name?: string;
            phone?: string;
            businessName?: string;
            serviceCategories?: string[];
            otherCategory?: string;
          };
          const draftEmail = (draft.email || "").trim().toLowerCase();
          const currentEmail = nextEmail.trim().toLowerCase();

          if (draftEmail && currentEmail && draftEmail === currentEmail) {
            nextName = nextName || (draft.name || "").trim();
            nextPhone = nextPhone || (draft.phone || "").trim();
            nextBusinessName = nextBusinessName || (draft.businessName || "").trim();

            if (Array.isArray(draft.serviceCategories)) {
              const categories = draft.serviceCategories
                .map((cat) => cat.trim())
                .filter((cat) => cat.length > 0);

              if ((draft.otherCategory || "").trim()) {
                categories.push("Other");
                setOtherCategory((draft.otherCategory || "").trim());
              }

              const unique = Array.from(new Set(categories));
              if (unique.length > 0) {
                setSelectedCategories((prev) => (prev.length > 0 ? prev : unique));
              }
            }
          }
        }
      } catch {
        // Ignore malformed local data.
      }

      if (!isMounted) return;
      setAccountName(nextName);
      setAccountPhone(nextPhone);
      setAccountEmail(nextEmail);
      setBusinessName(nextBusinessName);
      setBusinessNameLocked(!!nextBusinessName);
    };

    void hydratePrefill();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading, navigate]);

  if (authLoading || !user) return null;

  const businessNameFromSignup = businessNameLocked;

  const setLocationAndGeocode = async (lat: number, lng: number) => {
    setLatitude(String(lat));
    setLongitude(String(lng));
    const address = await reverseGeocode(lat, lng);
    if (address) setZone(address);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handlePortfolioAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 6 - portfolioFiles.length;
    const toAdd = files.slice(0, remaining).map(f => ({ file: f, preview: URL.createObjectURL(f) }));
    setPortfolioFiles(prev => [...prev, ...toAdd]);
    e.target.value = "";
  };

  const removePortfolioFile = (idx: number) => {
    setPortfolioFiles(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].preview);
      next.splice(idx, 1);
      return next;
    });
  };

  const handleSubmit = async () => {
    const finalCategories = selectedCategories.includes("Other") && otherCategory.trim()
      ? [...selectedCategories.filter(c => c !== "Other"), otherCategory.trim()]
      : selectedCategories.filter(c => c !== "Other");
    if (!businessName) { toast.error("Enter your business name"); return; }
    if (finalCategories.length === 0) { toast.error("Select at least one service category"); return; }
    if (!zone) { toast.error("Enter your zone/area"); return; }

    setLoading(true);
    try {
      // Upload portfolio photos first
      let uploadedUrls: string[] = [];
      if (portfolioFiles.length > 0) {
        setUploadingPhotos(true);
        try {
          const result = await api.uploadFiles(portfolioFiles.map(p => p.file));
          uploadedUrls = result.urls;
        } catch {
          toast.error("Failed to upload portfolio photos");
          setLoading(false);
          setUploadingPhotos(false);
          return;
        }
        setUploadingPhotos(false);
      }

      await api.submitOnboarding({
        businessName,
        serviceCategories: finalCategories,
        latitude: parseFloat(latitude) || 0,
        longitude: parseFloat(longitude) || 0,
        zone,
        serviceRadiusKm: parseFloat(serviceRadius) || 10,
        workingHours,
        portfolioUrls: uploadedUrls,
      });
      localStorage.removeItem(VENDOR_SIGNUP_PREFILL_KEY);
      setOnboardingStatus("complete");
      toast.success("Onboarding submitted! Your profile is under review.");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Onboarding failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="font-bold text-lg hidden sm:block">
              Vendor<span className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">Portal</span>
            </span>
          </Link>
          <Button variant="ghost" size="sm" onClick={async () => { await logout(); navigate("/login"); }}>
            <LogOut className="w-4 h-4 mr-1.5" />
            Logout
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Dashboard
          </Button>

          <h1 className="text-2xl md:text-3xl font-bold mb-2">Set Up Your Service Area</h1>
          <p className="text-muted-foreground mb-8">
            Tell us where you operate so customers can find you.
          </p>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Signup Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="text-sm font-medium">{accountName || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium break-all">{accountEmail || user.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium">{accountPhone || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Business Name</p>
                  <p className="text-sm font-medium">{businessName || "Not provided"}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Store className="w-5 h-5 text-orange-500" />
                  {businessNameFromSignup ? "Service Categories" : "Business Details"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!businessNameFromSignup && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Business Name *</label>
                    <Input placeholder="e.g. SparkClean Services" className="h-11 rounded-xl" value={businessName} onChange={e => setBusinessName(e.target.value)} />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Service Categories *</label>
                  <div className="flex flex-wrap gap-2">
                    {SERVICE_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          selectedCategories.includes(cat)
                            ? "bg-orange-500 text-white border-orange-500"
                            : "bg-background border-border hover:border-orange-300"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => toggleCategory("Other")}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        selectedCategories.includes("Other")
                          ? "bg-orange-500 text-white border-orange-500"
                          : "bg-background border-border hover:border-orange-300"
                      }`}
                    >
                      Other
                    </button>
                  </div>
                  {selectedCategories.includes("Other") && (
                    <Input
                      placeholder="Enter your custom category name"
                      className="h-11 rounded-xl mt-2"
                      value={otherCategory}
                      onChange={e => setOtherCategory(e.target.value)}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Zone / Area *</label>
                  <PlaceAutocompleteInput
                    value={zone}
                    onChange={setZone}
                    onSelect={(suggestion) => {
                      setZone(suggestion.display);
                      setLatitude(String(suggestion.lat));
                      setLongitude(String(suggestion.lng));
                    }}
                    placeholder="Type 3+ chars (e.g. South Delhi)"
                    className="h-11 rounded-xl"
                  />
                </div>

                {/* Map Picker */}
                <MapErrorBoundary>
                    <LocationPicker
                      latitude={parseFloat(latitude) || 0}
                      longitude={parseFloat(longitude) || 0}
                      serviceRadiusKm={parseFloat(serviceRadius) || 10}
                      onLocationChange={(lat, lng) => {
                        setLocationAndGeocode(lat, lng);
                      }}
                    />
                </MapErrorBoundary>

                {/* Detect my location button */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-xl gap-2"
                  disabled={detectingLocation}
                  onClick={async () => {
                    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
                    setDetectingLocation(true);
                    navigator.geolocation.getCurrentPosition(
                      async (pos) => {
                        const lat = pos.coords.latitude;
                        const lng = pos.coords.longitude;
                        await setLocationAndGeocode(lat, lng);
                        toast.success("Location detected!");
                        setDetectingLocation(false);
                      },
                      () => { toast.error("Could not detect location"); setDetectingLocation(false); }
                    );
                  }}
                >
                  {detectingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
                  {detectingLocation ? "Detecting..." : "Detect My Location"}
                </Button>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Service Radius (km)</label>
                  <Input placeholder="10" className="h-11 rounded-xl" type="number" value={serviceRadius} onChange={e => setServiceRadius(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="w-5 h-5 text-green-500" />
                  Working Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input placeholder="e.g. 9:00 AM - 6:00 PM" className="h-11 rounded-xl" value={workingHours} onChange={e => setWorkingHours(e.target.value)} />
              </CardContent>
            </Card>

            {/* Portfolio Photos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ImagePlus className="w-5 h-5 text-purple-500" />
                  Portfolio Photos (optional)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Upload up to 6 photos showcasing your work. These will be shown on your profile.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {portfolioFiles.map((pf, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-border">
                      <img src={pf.preview} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePortfolioFile(idx)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {portfolioFiles.length < 6 && (
                    <label className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-orange-300 flex flex-col items-center justify-center cursor-pointer transition-colors">
                      <ImagePlus className="w-6 h-6 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">Add photo</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handlePortfolioAdd} />
                    </label>
                  )}
                </div>
                {uploadingPhotos && <p className="text-sm text-orange-500">Uploading photos...</p>}
              </CardContent>
            </Card>

            <Button
              disabled={loading}
              onClick={handleSubmit}
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 text-white border-0 rounded-xl font-semibold text-base"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Submit for Review
              {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default VendorOnboarding;
