import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { auth, RecaptchaVerifier, signInWithPhoneNumber } from "@/lib/firebase";
import type { ConfirmationResult } from "firebase/auth";
import { toast } from "sonner";

type AuthStep = "method" | "phone-input" | "phone-otp" | "email-login" | "email-otp";

const RESEND_COOLDOWN = 30;

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

const Login = () => {
  const { t } = useTranslation("auth");
  const { loginWithTokens } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/";

  // Step & direction
  const [step, setStep] = useState<AuthStep>("method");
  const [direction, setDirection] = useState(1);

  // Phone
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);

  // Email
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailOtpId, setEmailOtpId] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);

  // Shared
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  // Init invisible reCAPTCHA
  useEffect(() => {
    if (!recaptchaRef.current || recaptchaVerifier.current) return;
    recaptchaVerifier.current = new RecaptchaVerifier(auth, recaptchaRef.current, {
      size: "invisible",
      callback: () => {},
    });
  }, []);

  const goTo = useCallback((next: AuthStep, dir = 1) => {
    setDirection(dir);
    setStep(next);
  }, []);

  // ── Session helpers ─────────────────────────────
  const clearCustomerSession = () => {
    localStorage.removeItem("customer_accessToken");
    localStorage.removeItem("customer_refreshToken");
    localStorage.removeItem("customer_user");
  };
  const clearVendorSession = () => {
    localStorage.removeItem("vendor_accessToken");
    localStorage.removeItem("vendor_refreshToken");
    localStorage.removeItem("vendor_user");
    localStorage.removeItem("vendor_onboarding_status");
  };
  const clearAdminSession = () => {
    localStorage.removeItem("adminAccessToken");
    localStorage.removeItem("adminRefreshToken");
    localStorage.removeItem("adminUser");
  };

  const routeByRole = (result: { accessToken: string; refreshToken: string; actor: { role: string } }) => {
    const role = result.actor.role;
    if (role === "customer") {
      clearVendorSession();
      clearAdminSession();
      loginWithTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        actor: result.actor as any,
      });
      navigate(redirectPath);
      return;
    }
    if (role === "vendor") {
      clearCustomerSession();
      clearAdminSession();
      localStorage.setItem("vendor_accessToken", result.accessToken);
      localStorage.setItem("vendor_refreshToken", result.refreshToken);
      localStorage.setItem("vendor_user", JSON.stringify(result.actor));
      toast.success(t("messages:success.loginSuccess"));
      window.location.href = "/vendor/dashboard";
      return;
    }
    if (role === "admin") {
      clearCustomerSession();
      clearVendorSession();
      localStorage.setItem("adminAccessToken", result.accessToken);
      localStorage.setItem("adminRefreshToken", result.refreshToken);
      localStorage.setItem("adminUser", JSON.stringify(result.actor));
      toast.success(t("messages:success.loginSuccess"));
      window.location.href = "/company/dashboard";
      return;
    }
    clearCustomerSession();
    clearVendorSession();
    clearAdminSession();
    navigate("/");
  };

  // ── Phone auth ──────────────────────────────────
  const sendPhoneOtp = async () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length !== 10) {
      toast.error(t("login.phoneInvalid"));
      return;
    }
    setLoading(true);
    try {
      if (!recaptchaVerifier.current) {
        recaptchaVerifier.current = new RecaptchaVerifier(auth, recaptchaRef.current!, {
          size: "invisible",
          callback: () => {},
        });
      }
      const result = await signInWithPhoneNumber(auth, `+91${cleaned}`, recaptchaVerifier.current);
      setConfirmResult(result);
      setCountdown(RESEND_COOLDOWN);
      goTo("phone-otp");
      toast.success(t("login.otpSentPhone"));
    } catch (err: any) {
      console.error("Firebase phone OTP error:", err);
      if (err.code === "auth/too-many-requests") {
        toast.error(t("login.tooManyAttempts"));
      } else {
        toast.error(t("login.phoneOtpFailed"));
      }
      // Reset reCAPTCHA on failure
      recaptchaVerifier.current = null;
    } finally {
      setLoading(false);
    }
  };

  const verifyPhoneOtp = async (code: string) => {
    if (!confirmResult || code.length < 6) return;
    setLoading(true);
    try {
      const userCredential = await confirmResult.confirm(code);
      const idToken = await userCredential.user.getIdToken();
      const res = await api.phoneLogin(idToken, "customer");
      if (!res.data?.accessToken || !res.data?.refreshToken || !res.data?.actor) {
        throw new Error("Login failed");
      }
      toast.success(t("messages:success.loginSuccess"));
      routeByRole({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        actor: res.data.actor,
      });
    } catch (err: any) {
      console.error("Phone OTP verify error:", err);
      if (err.code === "auth/invalid-verification-code") {
        toast.error(t("login.invalidOtp"));
      } else {
        toast.error(err.message || t("messages:error.loginFailed"));
      }
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  // ── Email auth ──────────────────────────────────
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error(t("validation.fillAllFields"));
      return;
    }
    setLoading(true);
    try {
      const res = await api.login({ email, password, role: "customer" });
      if (!res.data?.accessToken || !res.data?.refreshToken || !res.data?.actor) {
        throw new Error("Login failed");
      }
      toast.success(t("messages:success.loginSuccess"));
      routeByRole({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        actor: res.data.actor,
      });
    } catch (err: any) {
      const msg = err.message || t("messages:error.loginFailed");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailOtp = async () => {
    if (!email) {
      toast.error(t("validation.fillAllFields"));
      return;
    }
    setLoading(true);
    try {
      const res = await api.requestOtp(email, "login");
      if (res.data) {
        setEmailOtpId(res.data.otpId);
        setEmailOtpSent(true);
        setCountdown(RESEND_COOLDOWN);
        toast.success(t("messages:success.otpSent"));
      }
    } catch (err: any) {
      toast.error(err.message || t("messages:error.failedSendOtp"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (code: string) => {
    if (!emailOtpId || code.length < 6) return;
    setLoading(true);
    try {
      const res = await api.verifyOtp(emailOtpId, code, "login");
      if (!res.data?.accessToken || !res.data?.refreshToken || !res.data?.actor) {
        toast.error(t("messages:error.loginFailed"));
        return;
      }
      toast.success(t("messages:success.loginSuccess"));
      routeByRole({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        actor: res.data.actor,
      });
    } catch (err: any) {
      toast.error(err.message || t("messages:error.invalidOtp"));
      setEmailOtp("");
    } finally {
      setLoading(false);
    }
  };

  // ── Render steps ────────────────────────────────
  const renderMethodPicker = () => (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => goTo("phone-input")}
        className="group w-full flex items-center gap-4 p-4 rounded-2xl border border-border/60 bg-background hover:border-primary/40 hover:bg-primary/[0.03] transition-all duration-200"
      >
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
          <Smartphone className="w-5 h-5 text-primary" />
        </div>
        <div className="text-left flex-1">
          <p className="font-semibold text-sm">{t("login.phoneMethod")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("login.phoneMethodDesc")}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </button>

      <button
        type="button"
        onClick={() => goTo("email-login")}
        className="group w-full flex items-center gap-4 p-4 rounded-2xl border border-border/60 bg-background hover:border-primary/40 hover:bg-primary/[0.03] transition-all duration-200"
      >
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-muted/80 transition-colors">
          <Mail className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="text-left flex-1">
          <p className="font-semibold text-sm">{t("login.emailMethod")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("login.emailMethodDesc")}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </button>
    </div>
  );

  const renderPhoneInput = () => (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => goTo("method", -1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {t("login.back")}
      </button>

      <div>
        <label className="text-sm font-medium mb-2 block">{t("login.enterPhone")}</label>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 h-12 px-3 rounded-xl border border-border/60 bg-muted/50 text-sm font-medium shrink-0">
            <span className="text-base">🇮🇳</span>
            <span>+91</span>
          </div>
          <Input
            placeholder="99999 00001"
            type="tel"
            maxLength={12}
            className="h-12 rounded-xl border-border/60 focus:border-primary/40 text-base tracking-wide font-medium transition-colors"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") sendPhoneOtp();
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">{t("login.phoneDisclaimer")}</p>
      </div>

      <Button
        type="button"
        disabled={loading || phone.replace(/\D/g, "").length !== 10}
        onClick={sendPhoneOtp}
        className="w-full h-12 gradient-bg text-primary-foreground border-0 rounded-xl font-semibold text-base btn-press glow-focus"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
        {t("login.getOtp")}
      </Button>
    </div>
  );

  const renderPhoneOtp = () => (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => {
          setOtp("");
          goTo("phone-input", -1);
        }}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {t("login.changeNumber")}
      </button>

      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Phone className="w-6 h-6 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">
          {t("login.otpSentTo")} <span className="font-semibold text-foreground">+91 {phone}</span>
        </p>
      </div>

      <div className="flex justify-center">
        <InputOTP
          maxLength={6}
          value={otp}
          onChange={(val) => {
            setOtp(val);
            if (val.length === 6) verifyPhoneOtp(val);
          }}
          disabled={loading}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} className="w-12 h-14 text-lg rounded-xl border-border/60" />
            <InputOTPSlot index={1} className="w-12 h-14 text-lg rounded-xl border-border/60" />
            <InputOTPSlot index={2} className="w-12 h-14 text-lg rounded-xl border-border/60" />
          </InputOTPGroup>
          <span className="mx-1 text-muted-foreground">-</span>
          <InputOTPGroup>
            <InputOTPSlot index={3} className="w-12 h-14 text-lg rounded-xl border-border/60" />
            <InputOTPSlot index={4} className="w-12 h-14 text-lg rounded-xl border-border/60" />
            <InputOTPSlot index={5} className="w-12 h-14 text-lg rounded-xl border-border/60" />
          </InputOTPGroup>
        </InputOTP>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("login.verifying")}
        </div>
      )}

      <div className="text-center text-sm">
        {countdown > 0 ? (
          <p className="text-muted-foreground">
            {t("login.resendIn")} <span className="font-semibold tabular-nums">{countdown}s</span>
          </p>
        ) : (
          <button
            type="button"
            onClick={sendPhoneOtp}
            disabled={loading}
            className="text-primary hover:underline font-medium"
          >
            {t("login.resendOtp")}
          </button>
        )}
      </div>
    </div>
  );

  const renderEmailLogin = () => (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => goTo("method", -1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {t("login.back")}
      </button>

      <form className="space-y-4" onSubmit={handleEmailLogin}>
        <div className="relative group">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            placeholder={t("login.emailPlaceholder")}
            type="email"
            className="pl-10 h-12 rounded-xl border-border/60 focus:border-primary/40 transition-colors"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </div>
        <div className="relative group">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            placeholder={t("login.passwordPlaceholder")}
            type={showPassword ? "text" : "password"}
            className="pl-10 pr-10 h-12 rounded-xl border-border/60 focus:border-primary/40 transition-colors"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded border-border" />
            <span className="text-muted-foreground">{t("login.rememberMe")}</span>
          </label>
          <Link to="/forgot-password" className="text-primary hover:underline font-medium">
            {t("login.forgotPassword")}
          </Link>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 gradient-bg text-primary-foreground border-0 rounded-xl font-semibold text-base btn-press glow-focus"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {t("login.signIn")}
          {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
        </Button>
      </form>

      {/* Email OTP fallback */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/40" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-3 text-muted-foreground">{t("login.or")}</span>
        </div>
      </div>

      {!emailOtpSent ? (
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={handleSendEmailOtp}
          className="w-full h-11 rounded-xl border-border/60 text-sm font-medium"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Mail className="w-3.5 h-3.5 mr-2" />}
          {t("login.sendEmailOtp")}
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground text-center">{t("login.emailOtpSent")}</p>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={emailOtp}
              onChange={(val) => {
                setEmailOtp(val);
                if (val.length === 6) handleVerifyEmailOtp(val);
              }}
              disabled={loading}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="w-10 h-12 text-base rounded-lg border-border/60" />
                <InputOTPSlot index={1} className="w-10 h-12 text-base rounded-lg border-border/60" />
                <InputOTPSlot index={2} className="w-10 h-12 text-base rounded-lg border-border/60" />
                <InputOTPSlot index={3} className="w-10 h-12 text-base rounded-lg border-border/60" />
                <InputOTPSlot index={4} className="w-10 h-12 text-base rounded-lg border-border/60" />
                <InputOTPSlot index={5} className="w-10 h-12 text-base rounded-lg border-border/60" />
              </InputOTPGroup>
            </InputOTP>
          </div>
          {countdown > 0 ? (
            <p className="text-xs text-muted-foreground text-center">
              {t("login.resendIn")} <span className="font-semibold tabular-nums">{countdown}s</span>
            </p>
          ) : (
            <button
              type="button"
              onClick={handleSendEmailOtp}
              disabled={loading}
              className="block mx-auto text-xs text-primary hover:underline font-medium"
            >
              {t("login.resendOtp")}
            </button>
          )}
        </div>
      )}
    </div>
  );

  const stepContent: Record<AuthStep, () => JSX.Element> = {
    method: renderMethodPicker,
    "phone-input": renderPhoneInput,
    "phone-otp": renderPhoneOtp,
    "email-login": renderEmailLogin,
    "email-otp": renderEmailLogin, // handled inline
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-background">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.06),transparent)]" />

      {/* Invisible reCAPTCHA container */}
      <div ref={recaptchaRef} id="recaptcha-container" />

      <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 mb-10 group">
            <div className="w-9 h-9 rounded-lg gradient-bg flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="text-primary-foreground font-display font-bold text-lg">V</span>
            </div>
            <span className="font-display font-bold text-xl">
              Vendor<span className="gradient-text">Center</span>
            </span>
          </Link>

          {/* Header */}
          <h1 className="font-display text-2xl md:text-3xl font-bold mb-1.5">{t("login.welcome")}</h1>
          <p className="text-muted-foreground mb-8">{t("login.subtitle")}</p>

          {/* Step content with slide animation */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {stepContent[step]()}
            </motion.div>
          </AnimatePresence>

          {/* Register link */}
          <p className="text-center text-sm text-muted-foreground mt-8">
            {t("login.noAccount")}{" "}
            <Link to="/register" className="text-primary hover:underline font-medium">
              {t("login.signUp")}
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Right hero panel */}
      <div className="hidden lg:flex flex-1 gradient-hero items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 gradient-mesh opacity-30" />
        <div className="absolute inset-0">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/15 blur-3xl animate-float-drift" />
          <div className="absolute bottom-10 -left-20 w-96 h-96 rounded-full bg-accent/10 blur-3xl animate-float-drift-reverse" />
          <div className="absolute top-1/2 right-1/4 w-40 h-40 rounded-full bg-white/5 blur-2xl animate-pulse-glow" />
        </div>

        <div className="relative text-center text-background max-w-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="w-24 h-24 rounded-3xl gradient-bg flex items-center justify-center mx-auto mb-8 animate-pulse-glow shadow-2xl">
              <span className="text-primary-foreground font-display font-bold text-4xl">V</span>
            </div>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="font-display text-3xl font-bold mb-4"
          >
            {t("login.sideTitle")}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="text-background/70 leading-relaxed"
          >
            {t("login.sideDescription")}
          </motion.p>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="mt-10 grid grid-cols-3 gap-4"
          >
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-green-300" />
              </div>
              <span className="text-xs text-background/60">{t("login.securePayments")}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-blue-300" />
              </div>
              <span className="text-xs text-background/60">{t("login.verifiedVendors")}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-purple-300" />
              </div>
              <span className="text-xs text-background/60">{t("login.instantBooking")}</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Login;
