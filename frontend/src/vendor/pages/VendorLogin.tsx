import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth } from "@/vendor/hooks/useVendorAuth";
import { vendorApi as api } from "@/vendor/lib/vendorApi";
import { auth, RecaptchaVerifier, signInWithPhoneNumber } from "@/lib/firebase";
import type { ConfirmationResult } from "firebase/auth";
import { toast } from "sonner";

type AuthStep = "method" | "phone-input" | "phone-otp" | "email-login";

const RESEND_COOLDOWN = 30;

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

const VendorLogin = () => {
  const { t } = useTranslation("vendor");
  const { user, loginWithTokens, logout } = useAuth();
  const navigate = useNavigate();

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
  const [otpEmail, setOtpEmail] = useState("");
  const [otpId, setOtpId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  // Shared
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

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

  const normalizeEmail = (v: string) => v.trim().toLowerCase();

  const ensureSwitchedAccount = async (targetEmail: string) => {
    if (!user?.email) return;
    if (normalizeEmail(user.email) !== normalizeEmail(targetEmail)) {
      await logout();
    }
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
      const res = await api.phoneLogin(idToken);
      if (!res.data?.accessToken || !res.data?.refreshToken || !res.data?.actor) {
        throw new Error("Login failed");
      }
      if (res.data.actor.role !== "vendor") {
        toast.error(t("login.vendorOnly"));
        return;
      }
      loginWithTokens({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        actor: res.data.actor,
      });
      toast.success(t("login.welcomeBack"));
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Phone OTP verify error:", err);
      if (err.code === "auth/invalid-verification-code") {
        toast.error(t("login.invalidPhoneOtp"));
      } else {
        toast.error(err.message || t("login.otpLoginFailed"));
      }
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  // ── Email auth ──────────────────────────────────
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error(t("login.fillAllFields")); return; }
    setLoading(true);
    try {
      await ensureSwitchedAccount(email);
      const res = await api.login({ email, password, role: "vendor" });
      if (!res.data?.accessToken || !res.data?.refreshToken || !res.data?.actor) {
        throw new Error("Login failed");
      }
      if (res.data.actor.role !== "vendor") {
        toast.error(t("login.vendorOnly"));
        return;
      }
      loginWithTokens({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        actor: res.data.actor,
      });
      toast.success(t("login.welcomeBack"));
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || t("login.signIn"));
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailOtp = async () => {
    if (!otpEmail) { toast.error(t("login.fillAllFields")); return; }
    setLoading(true);
    try {
      await ensureSwitchedAccount(otpEmail);
      const res = await api.requestOtp(otpEmail, "login");
      if (res.data) {
        setOtpId(res.data.otpId);
        setOtpSent(true);
        setCountdown(RESEND_COOLDOWN);
        toast.success(t("login.otpSentToEmail"));
      }
    } catch (err: any) {
      toast.error(err.message || t("login.failedSendOtp"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (code: string) => {
    if (!otpId || code.length < 6) return;
    setLoading(true);
    try {
      const res = await api.verifyOtp(otpId, code, "login");
      if (res.data?.accessToken && res.data?.refreshToken && res.data?.actor) {
        if (res.data.actor.role !== "vendor") {
          toast.error(t("login.vendorOnly"));
          return;
        }
        loginWithTokens({
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken,
          actor: res.data.actor,
        });
        toast.success(t("login.welcomeBack"));
        navigate("/dashboard");
      } else {
        toast.error(t("login.otpLoginFailed"));
      }
    } catch (err: any) {
      toast.error(err.message || t("login.invalidOtp"));
      setOtpCode("");
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
        className="group w-full flex items-center gap-4 p-4 rounded-2xl border border-border/60 bg-background hover:border-orange-400/40 hover:bg-orange-50/30 dark:hover:bg-orange-950/10 transition-all duration-200"
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/15 to-pink-500/15 flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-orange-600" />
        </div>
        <div className="text-left flex-1">
          <p className="font-semibold text-sm">{t("login.phoneMethod")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("login.phoneMethodDesc")}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
      </button>

      <button
        type="button"
        onClick={() => goTo("email-login")}
        className="group w-full flex items-center gap-4 p-4 rounded-2xl border border-border/60 bg-background hover:border-orange-400/40 hover:bg-orange-50/30 dark:hover:bg-orange-950/10 transition-all duration-200"
      >
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Mail className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="text-left flex-1">
          <p className="font-semibold text-sm">{t("login.emailMethod")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t("login.emailMethodDesc")}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
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
            className="h-12 rounded-xl border-border/60 focus:border-orange-400/50 text-base tracking-wide font-medium transition-colors"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") sendPhoneOtp(); }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">{t("login.phoneDisclaimer")}</p>
      </div>

      <Button
        type="button"
        disabled={loading || phone.replace(/\D/g, "").length !== 10}
        onClick={sendPhoneOtp}
        className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 text-white border-0 rounded-xl font-semibold text-base"
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
        onClick={() => { setOtp(""); goTo("phone-input", -1); }}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {t("login.changeNumber")}
      </button>

      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/15 to-pink-500/15 flex items-center justify-center mx-auto mb-3">
          <Phone className="w-6 h-6 text-orange-600" />
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
            className="text-orange-600 hover:underline font-medium"
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
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-orange-500" />
          <Input
            placeholder={t("login.emailPlaceholder")}
            type="email"
            className="pl-10 h-12 rounded-xl border-border/60 focus:border-orange-400/50 transition-colors"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </div>
        <div className="relative group">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-orange-500" />
          <Input
            placeholder={t("login.passwordPlaceholder")}
            type={showPassword ? "text" : "password"}
            className="pl-10 pr-10 h-12 rounded-xl border-border/60 focus:border-orange-400/50 transition-colors"
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
          <Link to="/forgot-password" className="text-orange-600 hover:underline font-medium">
            {t("login.forgotPassword")}
          </Link>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 text-white border-0 rounded-xl font-semibold text-base"
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

      {!otpSent ? (
        <div className="space-y-3">
          <div className="relative group">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("login.otpEmailPlaceholder")}
              type="email"
              className="pl-10 h-11 rounded-xl border-border/60"
              value={otpEmail}
              onChange={(e) => setOtpEmail(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={loading || !otpEmail}
            onClick={handleSendEmailOtp}
            className="w-full h-11 rounded-xl border-border/60 text-sm font-medium"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Mail className="w-3.5 h-3.5 mr-2" />}
            {t("login.sendEmailOtp")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground text-center">{t("login.emailOtpSent")}</p>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otpCode}
              onChange={(val) => {
                setOtpCode(val);
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
              className="block mx-auto text-xs text-orange-600 hover:underline font-medium"
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
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Invisible reCAPTCHA */}
      <div ref={recaptchaRef} id="vendor-recaptcha-container" />

      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 mb-8 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <span className="font-bold text-xl">
              Vendor<span className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">Portal</span>
            </span>
          </Link>

          <div className="flex justify-end mb-4"><LanguageSwitcher compact /></div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1.5">{t("login.title")}</h1>
          <p className="text-muted-foreground mb-8">{t("login.subtitle")}</p>

          {/* Step content */}
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

          <p className="text-center text-sm text-muted-foreground mt-8">
            {t("login.noAccount")}{" "}
            <Link to="/register" className="text-orange-600 hover:underline font-medium">
              {t("login.registerAsVendor")}
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Right panel */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-orange-500/15 blur-3xl" />
          <div className="absolute bottom-20 -left-20 w-80 h-80 rounded-full bg-pink-500/10 blur-3xl" />
        </div>
        <div className="relative text-center text-white max-w-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center mx-auto mb-8 shadow-2xl">
              <span className="text-white font-bold text-3xl">V</span>
            </div>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-3xl font-bold mb-4"
          >
            {t("login.sideTitle")}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="text-white/70 leading-relaxed"
          >
            {t("login.sideDesc")}
          </motion.p>
        </div>
      </div>
    </div>
  );
};

export default VendorLogin;
