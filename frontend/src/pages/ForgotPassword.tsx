import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { toast } from "sonner";

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

type Step = "email" | "otp" | "password";

const ForgotPassword = () => {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otpId, setOtpId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendOtp = async () => {
    if (!email) { toast.error("Enter your email"); return; }
    setLoading(true);
    try {
      const res = await api.requestOtp(email, "password_reset");
      if (res.data) {
        setOtpId(res.data.otpId);
        setStep("otp");
        toast.success("OTP sent to your email");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndProceed = () => {
    if (!otpCode || otpCode.length < 6) { toast.error("Enter 6-digit OTP"); return; }
    setStep("password");
  };

  const handleResetPassword = async () => {
    if (!PASSWORD_RULE.test(newPassword)) {
      toast.error("Password must be 8+ characters and include uppercase, lowercase, number, and special character"); return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match"); return;
    }
    setLoading(true);
    try {
      await api.resetPassword({ email, otpId, code: otpCode, newPassword });
      toast.success("Password reset successful! Please sign in.");
      navigate("/login");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
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

          <h1 className="font-display text-2xl md:text-3xl font-bold mb-2">Reset password</h1>
          <p className="text-muted-foreground mb-8">
            {step === "email" && "Enter your email to receive a reset code"}
            {step === "otp" && "Enter the verification code sent to your email"}
            {step === "password" && "Set your new password"}
          </p>

          {/* Progress indicator */}
          <div className="flex gap-2 mb-8">
            {(["email", "otp", "password"] as Step[]).map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  (["email", "otp", "password"] as Step[]).indexOf(step) >= i
                    ? "gradient-bg"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>

          {step === "email" && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="relative glow-focus rounded-xl">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Email address"
                  type="email"
                  className="pl-10 h-12 rounded-xl"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSendOtp()}
                />
              </div>
              <Button
                disabled={loading}
                onClick={handleSendOtp}
                className="w-full h-12 gradient-bg text-primary-foreground border-0 rounded-xl font-semibold text-base btn-press shadow-lg hover:shadow-xl transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Send Reset Code
                {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
              </Button>
            </motion.div>
          )}

          {step === "otp" && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <Input
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                className="h-12 rounded-xl text-center tracking-[0.5em] font-mono text-lg"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleVerifyAndProceed()}
              />
              <p className="text-xs text-muted-foreground text-center">
                Code sent to <span className="font-medium text-foreground">{email}</span>
              </p>
              <Button
                disabled={loading}
                onClick={handleVerifyAndProceed}
                className="w-full h-12 gradient-bg text-primary-foreground border-0 rounded-xl font-semibold text-base"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
              <Button variant="ghost" className="w-full text-sm text-muted-foreground" onClick={handleSendOtp} disabled={loading}>
                Resend code
              </Button>
            </motion.div>
          )}

          {step === "password" && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="relative glow-focus rounded-xl">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="New password (min 8 characters)"
                  type="password"
                  className="pl-10 h-12 rounded-xl"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground -mt-2">Use 8+ characters with uppercase, lowercase, number, and special character.</p>
              <div className="relative glow-focus rounded-xl">
                <CheckCircle2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Confirm new password"
                  type="password"
                  className="pl-10 h-12 rounded-xl"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleResetPassword()}
                />
              </div>
              <Button
                disabled={loading}
                onClick={handleResetPassword}
                className="w-full h-12 gradient-bg text-primary-foreground border-0 rounded-xl font-semibold text-base"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Reset Password
                {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
              </Button>
            </motion.div>
          )}

          <div className="mt-8">
            <Link to="/login" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Right - Visual */}
      <div className="hidden lg:flex flex-1 gradient-hero items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-20 -right-20 w-[360px] h-[360px] rounded-full bg-primary/15 blur-[80px] animate-float" />
          <div className="absolute bottom-10 -left-20 w-[300px] h-[300px] rounded-full bg-accent/10 blur-[70px] animate-float-slow" style={{ animationDelay: "2s" }} />
          <div className="absolute inset-0 gradient-mesh opacity-30" />
        </div>
        <div className="relative text-center text-white max-w-sm">
          <div className="w-20 h-20 rounded-3xl gradient-bg flex items-center justify-center mx-auto mb-8 animate-pulse-glow">
            <Lock className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="font-display text-3xl font-bold mb-4">Secure Reset</h2>
          <p className="text-white/65 leading-relaxed">
            We'll send a verification code to your email to help you reset your password securely.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
