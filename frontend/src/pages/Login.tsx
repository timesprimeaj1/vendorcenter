import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { toast } from "sonner";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpId, setOtpId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("email");
  const [rateLimited, setRateLimited] = useState(false);
  const { loginWithTokens } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/";

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
      toast.info("Redirecting to Vendor Portal...");
      window.location.href = "/vendor/dashboard";
      return;
    }

    if (role === "admin") {
      clearCustomerSession();
      clearVendorSession();
      localStorage.setItem("adminAccessToken", result.accessToken);
      localStorage.setItem("adminRefreshToken", result.refreshToken);
      localStorage.setItem("adminUser", JSON.stringify(result.actor));
      toast.info("Redirecting to Admin Portal...");
      window.location.href = "/company/dashboard";
      return;
    }

    clearCustomerSession();
    clearVendorSession();
    clearAdminSession();
    navigate("/");
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill all fields");
      return;
    }

    setLoading(true);
    try {
      const res = await api.login({ email, password });
      if (!res.data?.accessToken || !res.data?.refreshToken || !res.data?.actor) {
        throw new Error("Login failed");
      }
      toast.success("Welcome back!");
      routeByRole({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        actor: res.data.actor,
      });
    } catch (err: any) {
      const msg = err.message || "Login failed";
      const isRateLimit = msg.toLowerCase().includes("too many") || err.status === 429;
      if (isRateLimit) {
        setRateLimited(true);
        setOtpEmail(email);
        setActiveTab("phone");
        toast.error("Too many attempts. Try OTP login instead.", { duration: 5000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!otpEmail) {
      toast.error("Enter your email");
      return;
    }

    setLoading(true);
    try {
      const res = await api.requestOtp(otpEmail, "login");
      if (res.data) {
        setOtpId(res.data.otpId);
        setOtpSent(true);
        toast.success("OTP sent to your email");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send OTP");
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
      const res = await api.verifyOtp(otpId, otpCode, "login");
      if (!res.data?.accessToken || !res.data?.refreshToken || !res.data?.actor) {
        toast.error("OTP verified but login failed. Please try email login.");
        return;
      }

      toast.success("Welcome back!");
      routeByRole({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        actor: res.data.actor,
      });
    } catch (err: any) {
      toast.error(err.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.08),transparent)]" />

      <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <Link to="/" className="flex items-center gap-2 mb-8 group">
            <div className="w-9 h-9 rounded-lg gradient-bg flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="text-primary-foreground font-display font-bold text-lg">V</span>
            </div>
            <span className="font-display font-bold text-xl">
              Vendor<span className="gradient-text">Center</span>
            </span>
          </Link>

          <h1 className="font-display text-2xl md:text-3xl font-bold mb-2">Welcome back</h1>
          <p className="text-muted-foreground mb-8">Sign in to your account to continue</p>

          {/* Rate limit banner */}
          {rateLimited && activeTab === "phone" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 flex items-center gap-2.5 p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-sm"
            >
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-amber-700 dark:text-amber-300">
                Too many login attempts. Use OTP to sign in securely.
              </span>
            </motion.div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="phone" className="gap-1.5">
                OTP Login
                {rateLimited && <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email">
              <form className="space-y-4" onSubmit={handleEmailLogin}>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    placeholder="Email address"
                    type="email"
                    className="pl-10 h-12 rounded-xl border-border/60 focus:border-primary/40 transition-colors"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    placeholder="Password"
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
                    <span className="text-muted-foreground">Remember me</span>
                  </label>
                  <Link to="/forgot-password" className="text-primary hover:underline font-medium">
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 gradient-bg text-primary-foreground border-0 rounded-xl font-semibold text-base btn-press glow-focus"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Sign In
                  {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="phone">
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    placeholder="Email address for OTP"
                    type="email"
                    className="pl-10 h-12 rounded-xl border-border/60 focus:border-primary/40 transition-colors"
                    value={otpEmail}
                    onChange={(e) => setOtpEmail(e.target.value)}
                  />
                </div>

                {otpSent && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                    <Input
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                      className="h-12 rounded-xl text-center tracking-[0.5em] font-mono text-lg border-border/60 focus:border-primary/40"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-2 text-center">OTP sent! Check your email.</p>
                  </motion.div>
                )}

                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => (otpSent ? handleVerifyOtp() : handleSendOtp())}
                  className="w-full h-12 gradient-bg text-primary-foreground border-0 rounded-xl font-semibold text-base btn-press glow-focus"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  {otpSent ? "Verify OTP" : "Send OTP"}
                  {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Right side hero panel */}
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
            Your Local Marketplace
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="text-background/70 leading-relaxed"
          >
            Connect with thousands of verified service providers. Book, manage, and review — all in one place.
          </motion.p>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="mt-10 flex items-center justify-center gap-6 text-background/60 text-sm"
          >
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>Verified Vendors</span>
            </div>
            <div className="w-px h-4 bg-background/20" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>Secure Payments</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Login;
