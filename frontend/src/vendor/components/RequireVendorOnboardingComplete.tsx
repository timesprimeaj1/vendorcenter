import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/vendor/hooks/useVendorAuth";
import { vendorApi as api } from "@/vendor/lib/vendorApi";
import { isVendorProfileComplete } from "@/vendor/lib/profileCompletion";

type Props = {
  children: ReactNode;
};

export default function RequireVendorOnboardingComplete({ children }: Props) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let active = true;

    if (authLoading) return;
    if (!user) {
      setChecking(false);
      return;
    }

    setChecking(true);
    api.getVendorProfile()
      .then((res) => {
        if (!active) return;
        setIsComplete(isVendorProfileComplete(res.data ?? null));
      })
      .catch(() => {
        if (!active) return;
        setIsComplete(false);
      })
      .finally(() => {
        if (!active) return;
        setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [user, authLoading, location.pathname]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
