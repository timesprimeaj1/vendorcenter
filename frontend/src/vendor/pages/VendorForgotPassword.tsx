import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { vendorApi as api } from "@/vendor/lib/vendorApi";
import { toast } from "sonner";

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

type Step = "email" | "otp" | "password";

const VendorForgotPassword = () => {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otpId, setOtpId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation("vendor");

  const handleSendOtp = async () => {
    if (!email) { toast.error(t("forgotPassword.enterEmail")); return; }
    setLoading(true);
    try {
      const res = await api.requestOtp(email, "password_reset");
      if (res.data) {
        setOtpId(res.data.otpId);
        setStep("otp");
        toast.success(t("forgotPassword.otpSent"));
      }
    } catch (err: any) {
      toast.error(err.message || t("forgotPassword.failedSendOtp"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndProceed = () => {
    if (!otpCode || otpCode.length < 6) { toast.error(t("forgotPassword.enter6DigitOtp")); return; }
    setStep("password");
  };

  const handleResetPassword = async () => {
    if (!PASSWORD_RULE.test(newPassword)) {
      toast.error(t("forgotPassword.passwordRequirements")); return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("forgotPassword.passwordsDontMatch")); return;
    }
    setLoading(true);
    try {
      await api.resetPassword({ email, otpId, code: otpCode, newPassword });
      toast.success(t("forgotPassword.resetSuccess"));
      navigate("/login");
    } catch (err: any) {
      toast.error(err.message || t("forgotPassword.resetFailed"));
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

          <div className="flex justify-end mb-4"><LanguageSwitcher compact /></div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">{t("forgotPassword.title")}</h1>
          <p className="text-muted-foreground mb-8">
            {step === "email" && t("forgotPassword.stepEmail")}
            {step === "otp" && t("forgotPassword.stepOtp")}
            {step === "password" && t("forgotPassword.stepPassword")}
          </p>

          <div className="flex gap-2 mb-8">
            {(["email", "otp", "password"] as Step[]).map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  (["email", "otp", "password"] as Step[]).indexOf(step) >= i
                    ? "bg-gradient-to-r from-orange-500 to-pink-500"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>

          {step === "email" && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder={t("forgotPassword.emailPlaceholder")} type="email" className="pl-10 h-12 rounded-xl" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSendOtp()} />
              </div>
              <Button disabled={loading} onClick={handleSendOtp} className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 text-white border-0 rounded-xl font-semibold text-base">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                {t("forgotPassword.sendResetCode")}
                {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
              </Button>
            </motion.div>
          )}

          {step === "otp" && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <Input placeholder={t("forgotPassword.enter6DigitOtp")} maxLength={6} className="h-12 rounded-xl text-center tracking-[0.5em] font-mono text-lg" value={otpCode} onChange={e => setOtpCode(e.target.value)} onKeyDown={e => e.key === "Enter" && handleVerifyAndProceed()} />
              <p className="text-xs text-muted-foreground text-center">
                {t("forgotPassword.codeSentTo")} <span className="font-medium text-foreground">{email}</span>
              </p>
              <Button disabled={loading} onClick={handleVerifyAndProceed} className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 text-white border-0 rounded-xl font-semibold text-base">
                {t("forgotPassword.continue")} <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
              <Button variant="ghost" className="w-full text-sm text-muted-foreground" onClick={handleSendOtp} disabled={loading}>{t("forgotPassword.resendCode")}</Button>
            </motion.div>
          )}

          {step === "password" && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder={t("forgotPassword.newPasswordPlaceholder")} type="password" className="pl-10 h-12 rounded-xl" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground -mt-2">{t("forgotPassword.passwordRule")}</p>
              <div className="relative">
                <CheckCircle2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder={t("forgotPassword.confirmPasswordPlaceholder")} type="password" className="pl-10 h-12 rounded-xl" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleResetPassword()} />
              </div>
              <Button disabled={loading} onClick={handleResetPassword} className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 text-white border-0 rounded-xl font-semibold text-base">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                {t("forgotPassword.resetPassword")}
                {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
              </Button>
            </motion.div>
          )}

          <div className="mt-8">
            <Link to="/login" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> {t("forgotPassword.backToSignIn")}
            </Link>
          </div>
        </motion.div>
      </div>

      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-orange-500/15 blur-3xl" />
          <div className="absolute bottom-20 -left-20 w-80 h-80 rounded-full bg-pink-500/10 blur-3xl" />
        </div>
        <div className="relative text-center text-white max-w-sm">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center mx-auto mb-8">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-4">{t("forgotPassword.sideTitle")}</h2>
          <p className="text-white/70 leading-relaxed">
            {t("forgotPassword.sideDesc")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VendorForgotPassword;
