import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Lock, User, Phone, Eye, EyeOff, ArrowRight, Store, Users, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { SERVICE_CATEGORIES } from "@/data/serviceCategories";

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const PHONE_RULE = /^\d{10}$/;
const VENDOR_SIGNUP_PREFILL_KEY = "vendor_signup_prefill";

const Register = () => {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get("role") === "vendor" ? "vendor" : "customer";
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"customer" | "vendor">(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showOther, setShowOther] = useState(false);
  const [otherCategory, setOtherCategory] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  // OTP verification step
  const [step, setStep] = useState<"form" | "otp">("form");
  const [otpId, setOtpId] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Email and password are required"); return; }
    if (!PASSWORD_RULE.test(password)) {
      toast.error("Password must be 8+ characters and include uppercase, lowercase, number, and special character");
      return;
    }
    if (phone && !PHONE_RULE.test(phone)) {
      toast.error("Phone number must be exactly 10 digits");
      return;
    }
    if (!agreed) { toast.error("Please accept the terms"); return; }
    setLoading(true);
    try {
      if (role === "vendor") {
        const normalizedCategories = selectedCategories.filter((cat) => cat !== "Other");
        localStorage.setItem(
          VENDOR_SIGNUP_PREFILL_KEY,
          JSON.stringify({
            email: email.trim().toLowerCase(),
            name: name.trim(),
            phone: phone.trim(),
            businessName: businessName.trim(),
            serviceCategories: normalizedCategories,
            otherCategory: otherCategory.trim(),
          })
        );
      }

      await signup({
        email,
        password,
        role,
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        businessName: role === "vendor" ? (businessName.trim() || undefined) : undefined,
      });
      // Account created, now send OTP for verification
      const otpRes = await api.requestOtp(email, "signup");
      if (otpRes.data) {
        setOtpId(otpRes.data.otpId);
        setStep("otp");
        toast.success("Account created! Check your email for the OTP.");
      }
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 6) { toast.error("Enter the 6-digit OTP"); return; }
    setLoading(true);
    try {
      await api.verifyOtp(otpId, otpCode, "signup");
      toast.success("Email verified! You can now log in.");
      navigate("/login");
    } catch (err: any) {
      toast.error(err.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      const otpRes = await api.requestOtp(email, "signup");
      if (otpRes.data) {
        setOtpId(otpRes.data.otpId);
        setOtpCode("");
        toast.success("New OTP sent to your email");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-lg gradient-bg flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-lg">V</span>
            </div>
            <span className="font-display font-bold text-xl">
              Vendor<span className="gradient-text">Center</span>
            </span>
          </Link>

          <h1 className="font-display text-2xl md:text-3xl font-bold mb-2">
            {step === "otp" ? "Verify your email" : "Create account"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {step === "otp" ? `We sent a 6-digit code to ${email}` : "Join VendorCenter today"}
          </p>

          {step === "otp" ? (
            /* OTP Verification Step */
            <div className="space-y-4">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-primary" />
                </div>
              </div>
              <Input
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                className="h-14 rounded-xl text-center tracking-[0.5em] font-mono text-xl"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
              <Button
                disabled={loading}
                onClick={handleVerifyOtp}
                className="w-full h-12 gradient-bg text-primary-foreground border-0 rounded-xl font-semibold text-base"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Verify & Continue
                {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Didn't receive the code?{" "}
                <button onClick={handleResendOtp} disabled={loading} className="text-primary hover:underline font-medium">
                  Resend OTP
                </button>
              </p>
            </div>
          ) : (
          <>
          {/* Role selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => setRole("customer")}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                role === "customer" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
              }`}
            >
              <Users className={`w-5 h-5 mb-2 ${role === "customer" ? "text-primary" : "text-muted-foreground"}`} />
              <div className="font-semibold text-sm">Customer</div>
              <div className="text-xs text-muted-foreground">Book services</div>
            </button>
            <button
              onClick={() => setRole("vendor")}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                role === "vendor" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
              }`}
            >
              <Store className={`w-5 h-5 mb-2 ${role === "vendor" ? "text-primary" : "text-muted-foreground"}`} />
              <div className="font-semibold text-sm">Vendor</div>
              <div className="text-xs text-muted-foreground">Offer services</div>
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleRegister}>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Full name" className="pl-10 h-12 rounded-xl" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Email address" type="email" className="pl-10 h-12 rounded-xl" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Phone number" type="tel" inputMode="numeric" maxLength={10} className="pl-10 h-12 rounded-xl" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} />
            </div>
            <p className="text-xs text-muted-foreground -mt-2">Phone number should be exactly 10 digits.</p>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Create password (min 8 chars)"
                type={showPassword ? "text" : "password"}
                className="pl-10 pr-10 h-12 rounded-xl"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">Use 8+ characters with uppercase, lowercase, number, and special character.</p>

            {role === "vendor" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4">
                <Input placeholder="Business name" className="h-12 rounded-xl" value={businessName} onChange={e => setBusinessName(e.target.value)} />
                <div>
                  <p className="text-sm font-medium mb-2">Select your service categories</p>
                  <div className="flex flex-wrap gap-2">
                    {SERVICE_CATEGORIES.map((cat) => {
                      const active = selectedCategories.includes(cat.key);
                      return (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() =>
                            setSelectedCategories((prev) =>
                              active ? prev.filter((c) => c !== cat.key) : [...prev, cat.key]
                            )
                          }
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-secondary text-secondary-foreground hover:border-primary/30"
                          }`}
                        >
                          {cat.icon} {cat.key}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setShowOther((v) => !v)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        showOther
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary text-secondary-foreground hover:border-primary/30"
                      }`}
                    >
                      ➕ Other
                    </button>
                  </div>
                  {showOther && (
                    <Input
                      placeholder="Specify your category name"
                      className="h-10 rounded-xl mt-2"
                      value={otherCategory}
                      onChange={(e) => setOtherCategory(e.target.value)}
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">You'll set your work location during onboarding after approval.</p>
              </motion.div>
            )}

            <div className="flex items-start gap-2">
              <input type="checkbox" className="rounded border-border mt-1" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
              <span className="text-xs text-muted-foreground">
                I agree to the{" "}
                <a href="#" className="text-primary hover:underline">Terms of Service</a> and{" "}
                <a href="#" className="text-primary hover:underline">Privacy Policy</a>
              </span>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-12 gradient-bg text-primary-foreground border-0 rounded-xl font-semibold text-base">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Create Account
              {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
          </>
          )}
        </motion.div>
      </div>

      {/* Right - Visual */}
      <div className="hidden lg:flex flex-1 gradient-hero items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/15 blur-3xl animate-float" />
          <div className="absolute bottom-20 -left-20 w-80 h-80 rounded-full bg-accent/10 blur-3xl animate-float" style={{ animationDelay: "2s" }} />
        </div>
        <div className="relative text-center text-background max-w-sm">
          <div className="w-20 h-20 rounded-3xl gradient-bg flex items-center justify-center mx-auto mb-8 animate-pulse-glow">
            <span className="text-primary-foreground font-display font-bold text-3xl">V</span>
          </div>
          <h2 className="font-display text-3xl font-bold mb-4">
            {role === "vendor" ? "Grow Your Business" : "Find Services Fast"}
          </h2>
          <p className="text-background/70 leading-relaxed">
            {role === "vendor"
              ? "Reach thousands of customers, manage bookings, and scale your business with VendorCenter."
              : "Discover verified professionals near you. Book trusted services in just a few taps."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
