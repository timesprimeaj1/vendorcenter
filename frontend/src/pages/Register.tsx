import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("auth");
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
    if (!email || !password) { toast.error(t("messages:error.fillAllFields")); return; }
    if (!PASSWORD_RULE.test(password)) {
      toast.error(t("register.passwordRule"));
      return;
    }
    if (phone && !PHONE_RULE.test(phone)) {
      toast.error(t("validation.phone10Digits"));
      return;
    }
    if (!agreed) { toast.error(t("messages:error.fillAllFields")); return; }
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
        toast.success(t("messages:success.accountCreated"));
      }
    } catch (err: any) {
      toast.error(err.message || t("messages:error.registrationFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 6) { toast.error(t("validation.enter6DigitOtp")); return; }
    setLoading(true);
    try {
      await api.verifyOtp(otpId, otpCode, "signup");
      toast.success(t("messages:success.emailVerified"));
      navigate("/login");
    } catch (err: any) {
      toast.error(err.message || t("messages:error.invalidOtp"));
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
        toast.success(t("messages:success.otpSent"));
      }
    } catch (err: any) {
      toast.error(err.message || t("messages:error.failedSendOtp"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left - Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 overflow-y-auto">
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
            {step === "otp" ? t("register.verifyEmail") : t("register.createAccount")}
          </h1>
          <p className="text-muted-foreground mb-6">
            {step === "otp" ? t("register.otpSentTo", { email }) : t("register.joinSubtitle")}
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
                placeholder={t("register.otpPlaceholder")}
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
                {t("register.verifyAndContinue")}
                {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {t("register.didntReceive")}{" "}
                <button onClick={handleResendOtp} disabled={loading} className="text-primary hover:underline font-medium">
                  {t("register.resendOtp")}
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
              <div className="font-semibold text-sm">{t("register.roleCustomer")}</div>
              <div className="text-xs text-muted-foreground">{t("register.roleCustomerDesc")}</div>
            </button>
            <button
              onClick={() => setRole("vendor")}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                role === "vendor" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
              }`}
            >
              <Store className={`w-5 h-5 mb-2 ${role === "vendor" ? "text-primary" : "text-muted-foreground"}`} />
              <div className="font-semibold text-sm">{t("register.roleVendor")}</div>
              <div className="text-xs text-muted-foreground">{t("register.roleVendorDesc")}</div>
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleRegister}>
            <div className="relative glow-focus rounded-xl">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={t("register.fullName")} className="pl-10 h-12 rounded-xl" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="relative glow-focus rounded-xl">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={t("register.emailPlaceholder")} type="email" className="pl-10 h-12 rounded-xl" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="relative glow-focus rounded-xl">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={t("register.phonePlaceholder")} type="tel" inputMode="numeric" maxLength={10} className="pl-10 h-12 rounded-xl" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} />
            </div>
            <p className="text-xs text-muted-foreground -mt-2">{t("register.phoneValidation")}</p>
            <div className="relative glow-focus rounded-xl">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("register.passwordPlaceholder")}
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
            <p className="text-xs text-muted-foreground -mt-2">{t("register.passwordRule")}</p>

            {role === "vendor" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4">
                <Input placeholder={t("register.businessName")} className="h-12 rounded-xl" value={businessName} onChange={e => setBusinessName(e.target.value)} />
                <div>
                  <p className="text-sm font-medium mb-2">{t("register.selectCategories")}</p>
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
                      placeholder={t("register.specifyCategory")}
                      className="h-10 rounded-xl mt-2"
                      value={otherCategory}
                      onChange={(e) => setOtherCategory(e.target.value)}
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t("register.vendorLocationNote")}</p>
              </motion.div>
            )}

            <div className="flex items-start gap-2">
              <input type="checkbox" className="rounded border-border mt-1" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
              <span className="text-xs text-muted-foreground">
                {t("register.agreeToTerms")}{" "}
                <Link to="/terms" className="text-primary hover:underline">{t("register.termsOfService")}</Link> and{" "}
                <Link to="/privacy" className="text-primary hover:underline">{t("register.privacyPolicy")}</Link>
              </span>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-12 gradient-bg text-primary-foreground border-0 rounded-xl font-semibold text-base btn-press shadow-lg hover:shadow-xl transition-all">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {t("register.createAccountBtn")}
              {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-8">
            {t("register.haveAccount")}{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">{t("register.signIn")}</Link>
          </p>
          </>
          )}
        </motion.div>
      </div>

      {/* Right - Visual */}
      <div className="hidden lg:flex flex-1 gradient-hero items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-20 -right-20 w-[360px] h-[360px] rounded-full bg-primary/15 blur-[80px] animate-float" />
          <div className="absolute bottom-10 -left-20 w-[300px] h-[300px] rounded-full bg-accent/10 blur-[70px] animate-float-slow" style={{ animationDelay: "2s" }} />
          <div className="absolute top-1/2 left-1/2 w-48 h-48 rounded-full bg-orange-500/8 blur-[50px] animate-float" style={{ animationDelay: "1s" }} />
          <div className="absolute inset-0 gradient-mesh opacity-30" />
        </div>
        <div className="relative text-center text-white max-w-sm">
          <div className="w-20 h-20 rounded-3xl gradient-bg flex items-center justify-center mx-auto mb-8 animate-pulse-glow">
            <span className="text-primary-foreground font-display font-bold text-3xl">V</span>
          </div>
          <h2 className="font-display text-3xl font-bold mb-4">
            {role === "vendor" ? t("register.sideVendorTitle") : t("register.sideCustomerTitle")}
          </h2>
          <p className="text-white/65 leading-relaxed">
            {role === "vendor"
              ? t("register.sideVendorDesc")
              : t("register.sideCustomerDesc")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
