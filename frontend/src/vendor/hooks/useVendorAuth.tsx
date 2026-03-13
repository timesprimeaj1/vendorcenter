import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { vendorApi, type Actor, type AuthResult, type LoginPayload, type SignupPayload } from "@/vendor/lib/vendorApi";
import { isVendorProfileComplete } from "@/vendor/lib/profileCompletion";

type OnboardingStatus = "unknown" | "incomplete" | "complete";

interface AuthState {
  user: Actor | null;
  loading: boolean;
  onboardingStatus: OnboardingStatus;
  onboardingLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  loginWithTokens: (result: AuthResult) => void;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshOnboardingStatus: () => Promise<OnboardingStatus>;
  setOnboardingStatus: (status: OnboardingStatus) => void;
}

const VendorAuthContext = createContext<AuthState | undefined>(undefined);

export function VendorAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Actor | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingStatus, setOnboardingStatusState] = useState<OnboardingStatus>("unknown");
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  const setOnboardingStatus = useCallback((status: OnboardingStatus) => {
    setOnboardingStatusState(status);
    localStorage.setItem("vendor_onboarding_status", status);
  }, []);

  const refreshOnboardingStatus = useCallback(async (): Promise<OnboardingStatus> => {
    const token = localStorage.getItem("vendor_accessToken");
    if (!token) {
      setOnboardingStatus("unknown");
      return "unknown";
    }

    setOnboardingLoading(true);
    try {
      const res = await vendorApi.getVendorProfile();
      const status: OnboardingStatus = isVendorProfileComplete(res.data ?? null) ? "complete" : "incomplete";
      setOnboardingStatus(status);
      return status;
    } catch {
      setOnboardingStatus("incomplete");
      return "incomplete";
    } finally {
      setOnboardingLoading(false);
    }
  }, [setOnboardingStatus]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("vendor_user");
      if (stored) {
        setUser(JSON.parse(stored));
      } else {
        // Compatibility bridge: if a vendor logged in via the main app while an older
        // build wrote tokens to customer_* keys, migrate the session for vendor portal.
        const legacyUserRaw = localStorage.getItem("customer_user");
        const legacyAccess = localStorage.getItem("customer_accessToken");
        const legacyRefresh = localStorage.getItem("customer_refreshToken");
        if (legacyUserRaw && legacyAccess && legacyRefresh) {
          const legacyUser = JSON.parse(legacyUserRaw) as Actor;
          if (legacyUser?.role === "vendor") {
            localStorage.setItem("vendor_user", JSON.stringify(legacyUser));
            localStorage.setItem("vendor_accessToken", legacyAccess);
            localStorage.setItem("vendor_refreshToken", legacyRefresh);
            setUser(legacyUser);
          }
        }
      }
      const status = localStorage.getItem("vendor_onboarding_status") as OnboardingStatus | null;
      if (status === "complete" || status === "incomplete" || status === "unknown") {
        setOnboardingStatusState(status);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading && user && onboardingStatus === "unknown") {
      void refreshOnboardingStatus();
    }
  }, [loading, user, onboardingStatus, refreshOnboardingStatus]);

  const login = useCallback(async (payload: LoginPayload) => {
    const res = await vendorApi.login(payload);
    if (res.data) {
      if (res.data.actor.role !== "vendor") {
        localStorage.removeItem("vendor_accessToken");
        localStorage.removeItem("vendor_refreshToken");
        localStorage.removeItem("vendor_user");
        localStorage.removeItem("vendor_onboarding_status");
        setUser(null);
        setOnboardingStatusState("unknown");
        throw new Error("This portal is for vendors only. Please use the customer site.");
      }
      localStorage.setItem("vendor_accessToken", res.data.accessToken);
      localStorage.setItem("vendor_refreshToken", res.data.refreshToken);
      localStorage.setItem("vendor_user", JSON.stringify(res.data.actor));
      setUser(res.data.actor);
      setOnboardingStatus("unknown");
      void refreshOnboardingStatus();
    }
  }, [refreshOnboardingStatus, setOnboardingStatus]);

  const loginWithTokens = useCallback((result: AuthResult) => {
    localStorage.setItem("vendor_accessToken", result.accessToken);
    localStorage.setItem("vendor_refreshToken", result.refreshToken);
    localStorage.setItem("vendor_user", JSON.stringify(result.actor));
    setUser(result.actor);
    setOnboardingStatus("unknown");
    void refreshOnboardingStatus();
  }, [refreshOnboardingStatus, setOnboardingStatus]);

  const signup = useCallback(async (payload: SignupPayload) => {
    await vendorApi.signup(payload);
  }, []);

  const logout = useCallback(async () => {
    try { await vendorApi.logout(); } catch { /* ignore */ }
    localStorage.removeItem("vendor_accessToken");
    localStorage.removeItem("vendor_refreshToken");
    localStorage.removeItem("vendor_user");
    localStorage.removeItem("vendor_onboarding_status");
    setUser(null);
    setOnboardingStatusState("unknown");
  }, []);

  return (
    <VendorAuthContext.Provider
      value={{
        user,
        loading,
        onboardingStatus,
        onboardingLoading,
        login,
        loginWithTokens,
        signup,
        logout,
        refreshOnboardingStatus,
        setOnboardingStatus,
      }}
    >
      {children}
    </VendorAuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(VendorAuthContext);
  if (!ctx) throw new Error("useAuth must be used within VendorAuthProvider");
  return ctx;
}
