import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth } from "@/vendor/hooks/useVendorAuth";
import { vendorApi as api } from "@/vendor/lib/vendorApi";
import { toast } from "sonner";

const VendorLogin = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpId, setOtpId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, login, loginWithTokens, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("vendor");

  const normalizeEmail = (value: string) => value.trim().toLowerCase();

  const ensureSwitchedAccount = async (targetEmail: string) => {
    if (!user?.email) return;
    if (normalizeEmail(user.email) !== normalizeEmail(targetEmail)) {
      await logout();
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error(t("login.fillAllFields")); return; }
    setLoading(true);
    try {
      await ensureSwitchedAccount(email);
      await login({ email, password });
      toast.success(t("login.welcomeBack"));
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || t("login.signIn"));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!otpEmail) { toast.error(t("login.fillAllFields")); return; }
    setLoading(true);
    try {
      await ensureSwitchedAccount(otpEmail);
      const res = await api.requestOtp(otpEmail, "login");
      if (res.data) {
        setOtpId(res.data.otpId);
        setOtpSent(true);
        toast.success(t("login.otpSentToEmail"));
      }
    } catch (err: any) {
      toast.error(err.message || t("login.failedSendOtp"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 6) { toast.error(t("login.otpCodePlaceholder")); return; }
    setLoading(true);
    try {
      const res = await api.verifyOtp(otpId, otpCode, "login");
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
          <h1 className="text-2xl md:text-3xl font-bold mb-2">{t("login.title")}</h1>
          <p className="text-muted-foreground mb-8">{t("login.subtitle")}</p>

          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="email">{t("login.emailTab")}</TabsTrigger>
              <TabsTrigger value="phone">{t("login.otpTab")}</TabsTrigger>
            </TabsList>

            <TabsContent value="email">
              <form className="space-y-4" onSubmit={handleEmailLogin}>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder={t("login.emailPlaceholder")} type="email" className="pl-10 h-12 rounded-xl" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={t("login.passwordPlaceholder")}
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
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-border" />
                    <span className="text-muted-foreground">{t("login.rememberMe")}</span>
                  </label>
                  <Link to="/forgot-password" className="text-primary hover:underline font-medium">
                    {t("login.forgotPassword")}
                  </Link>
                </div>
                <Button type="submit" disabled={loading} className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 text-white border-0 rounded-xl font-semibold text-base">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  {t("login.signIn")}
                  {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="phone">
              <form className="space-y-4" onSubmit={e => e.preventDefault()}>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder={t("login.otpEmailPlaceholder")} type="email" className="pl-10 h-12 rounded-xl" value={otpEmail} onChange={e => setOtpEmail(e.target.value)} />
                </div>
                {otpSent && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                    <Input placeholder={t("login.otpCodePlaceholder")} maxLength={6} className="h-12 rounded-xl text-center tracking-[0.5em] font-mono text-lg" value={otpCode} onChange={e => setOtpCode(e.target.value)} />
                    <p className="text-xs text-muted-foreground mt-2 text-center">{t("login.otpSent")}</p>
                  </motion.div>
                )}
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => otpSent ? handleVerifyOtp() : handleSendOtp()}
                  className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 text-white border-0 rounded-xl font-semibold text-base"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  {otpSent ? t("login.verifyAndSignIn") : t("login.sendOtp")}
                  {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-center text-sm text-muted-foreground mt-8">
            {t("login.noAccount")}{" "}
            <Link to="/register" className="text-primary hover:underline font-medium">
              {t("login.registerAsVendor")}
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
            <span className="text-white font-bold text-3xl">V</span>
          </div>
          <h2 className="text-3xl font-bold mb-4">{t("login.sideTitle")}</h2>
          <p className="text-white/70 leading-relaxed">
            {t("login.sideDesc")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VendorLogin;
