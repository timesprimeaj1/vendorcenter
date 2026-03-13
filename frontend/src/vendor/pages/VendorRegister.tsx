import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, ArrowRight, Loader2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { vendorApi as api } from "@/vendor/lib/vendorApi";
import { toast } from "sonner";

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const PHONE_RULE = /^\d{10}$/;
const VENDOR_SIGNUP_PREFILL_KEY = "vendor_signup_prefill";

const VendorRegister = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [step, setStep] = useState<"form" | "otp">("form");
  const [otpId, setOtpId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) {
      toast.error("Please fill all required fields");
      return;
    }
    if (!PASSWORD_RULE.test(password)) {
      toast.error("Password must be 8+ characters and include uppercase, lowercase, number, and special character");
      return;
    }
    if (phone && !PHONE_RULE.test(phone)) {
      toast.error("Phone number must be exactly 10 digits");
      return;
    }
    setLoading(true);
    try {
      localStorage.setItem(
        VENDOR_SIGNUP_PREFILL_KEY,
        JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim(),
          phone: phone.trim(),
          businessName: businessName.trim(),
          serviceCategories: [],
          otherCategory: "",
        })
      );

      await api.signup({ email, password, role: "vendor", name, phone: phone || undefined, businessName: businessName || undefined });
      const res = await api.requestOtp(email, "signup");
      if (res.data) {
        setOtpId(res.data.otpId);
        setStep("otp");
        toast.success("Account created! Verify your email.");
      }
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 6) {
      toast.error("Enter 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      await api.verifyOtp(otpId, otpCode, "signup");
      toast.success("Email verified! Please sign in.");
      navigate("/login");
    } catch (err: any) {
      toast.error(err.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <span className="font-bold text-xl">
              Vendor<span className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">Portal</span>
            </span>
          </Link>

          <h1 className="text-2xl md:text-3xl font-bold mb-2">Become a Vendor</h1>
          <p className="text-muted-foreground mb-8">Create your vendor account and start offering services</p>

          {step === "form" ? (
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
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Phone number (optional)" type="tel" inputMode="numeric" maxLength={10} className="pl-10 h-12 rounded-xl" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} />
              </div>
              <p className="text-xs text-muted-foreground -mt-2">Phone number should be exactly 10 digits.</p>
              <div className="relative">
                <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Business name (optional)" className="pl-10 h-12 rounded-xl" value={businessName} onChange={e => setBusinessName(e.target.value)} />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Password (min 8 characters)" type="password" className="pl-10 h-12 rounded-xl" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground -mt-2">Use 8+ characters with uppercase, lowercase, number, and special character.</p>
              <Button type="submit" disabled={loading} className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 text-white border-0 rounded-xl font-semibold text-base">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Create Vendor Account
                {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
              </Button>
            </form>
          ) : (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <Input
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                className="h-12 rounded-xl text-center tracking-[0.5em] font-mono text-lg"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value)}
              />
              <p className="text-xs text-muted-foreground text-center">
                Verification code sent to <span className="font-medium text-foreground">{email}</span>
              </p>
              <Button
                disabled={loading}
                onClick={handleVerifyOtp}
                className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 text-white border-0 rounded-xl font-semibold text-base"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Verify Email
                {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
              </Button>
            </motion.div>
          )}

          <p className="text-center text-sm text-muted-foreground mt-8">
            Already have a vendor account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>

      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-orange-500/15 blur-3xl" />
          <div className="absolute bottom-20 -left-20 w-80 h-80 rounded-full bg-pink-500/10 blur-3xl" />
        </div>
        <div className="relative text-center text-white max-w-sm">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center mx-auto mb-8">
            <Briefcase className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-4">Grow Your Business</h2>
          <p className="text-white/70 leading-relaxed">
            Join thousands of verified service providers. Reach more customers and manage everything in one place.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VendorRegister;
