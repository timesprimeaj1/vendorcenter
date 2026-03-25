import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Calendar, Settings, LogOut, ClipboardList,
  TrendingUp, Clock, CheckCircle2, AlertCircle, Store, Pencil, User
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/vendor/hooks/useVendorAuth";
import { vendorApi as api } from "@/vendor/lib/vendorApi";
import { isVendorProfileComplete } from "@/vendor/lib/profileCompletion";
import VendorHeader from "@/vendor/components/VendorHeader";

function resolveProfileImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("/api/")) return url;
  return `/api/uploads/files/${url}`;
}

const VendorDashboard = () => {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 });
  const { t } = useTranslation("vendor");

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    api.getVendorProfile()
      .then((res) => {
        const profile = res.data ?? null;
        setHasProfile(!!profile);
        setOnboarded(isVendorProfileComplete(profile));
      })
      .catch(() => {
        setHasProfile(false);
        setOnboarded(false);
      });

    api.getProfile()
      .then((res) => {
        if (res.data?.profilePictureUrl) setProfilePicUrl(resolveProfileImageUrl(res.data.profilePictureUrl));
      })
      .catch(() => {});

    api.getBookings()
      .then((res) => {
        const bookings: any[] = res.data || [];
        setStats({
          total: bookings.length,
          pending: bookings.filter((b) => b.status === "pending").length,
          completed: bookings.filter((b) => b.status === "completed").length,
        });
      })
      .catch(() => {});
  }, [user]);

  if (loading || !user) return null;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav */}
      <VendorHeader showProfile profilePicUrl={profilePicUrl} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">{t("dashboard.welcome")}</h1>
          <p className="text-muted-foreground mb-8">{t("dashboard.overview")}</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { title: t("dashboard.totalBookings"), value: String(stats.total), icon: Calendar, color: "text-blue-500" },
            { title: t("dashboard.pending"), value: String(stats.pending), icon: Clock, color: "text-yellow-500" },
            { title: t("dashboard.completed"), value: String(stats.completed), icon: CheckCircle2, color: "text-green-500" },
            { title: t("dashboard.revenue"), value: `₹${(stats.completed * 1000).toLocaleString("en-IN")}`, icon: TrendingUp, color: "text-purple-500" },
          ].map((stat, i) => (
            <motion.div key={stat.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <stat.icon className={`w-8 h-8 ${stat.color} opacity-80`} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Pencil className="w-5 h-5 text-violet-500" />
                {t("dashboard.editProfile")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t("dashboard.editProfileDesc")}
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/edit-profile")}>
                {t("dashboard.editDetails")}
              </Button>
            </CardContent>
          </Card>

          {onboarded === false && (
            <Card className="cursor-pointer hover:shadow-md transition-shadow border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Store className="w-5 h-5 text-orange-500" />
                  {hasProfile ? t("dashboard.continueOnboarding") : t("dashboard.completeOnboarding")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {hasProfile
                    ? t("dashboard.onboardingIncomplete")
                    : t("dashboard.onboardingSetup")}
                </p>
                <Button variant="outline" size="sm" onClick={() => navigate("/onboarding")}>
                  {t("dashboard.getStarted")}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="w-5 h-5 text-blue-500" />
                {t("dashboard.manageServices")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t("dashboard.manageServicesDesc")}
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/services")}>
                {t("dashboard.viewServices")}
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5 text-green-500" />
                {t("dashboard.viewBookings")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t("dashboard.viewBookingsDesc")}
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/bookings")}>
                {t("dashboard.viewBookings")}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Verification Status */}
        {!user.verified && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <Card className="mt-8 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">{t("dashboard.emailVerificationRequired")}</p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      {t("dashboard.emailVerificationDesc")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default VendorDashboard;
