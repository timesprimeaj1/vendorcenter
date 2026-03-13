import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Calendar, Settings, LogOut, ClipboardList,
  TrendingUp, Clock, CheckCircle2, AlertCircle, Store, Pencil, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/vendor/hooks/useVendorAuth";
import { vendorApi as api } from "@/vendor/lib/vendorApi";
import { isVendorProfileComplete } from "@/vendor/lib/profileCompletion";

const VendorDashboard = () => {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 });

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
        if (res.data?.profilePictureUrl) setProfilePicUrl(res.data.profilePictureUrl);
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
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="font-bold text-lg hidden sm:block">
              Vendor<span className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">Portal</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              {user.verified ? "Verified" : "Pending Verification"}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1.5" />
              Logout
            </Button>
            <button onClick={() => navigate("/edit-profile")} className="w-9 h-9 rounded-full overflow-hidden border-2 border-orange-300 flex items-center justify-center bg-muted hover:ring-2 hover:ring-orange-400 transition">
              {profilePicUrl ? (
                <img src={profilePicUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Welcome back!</h1>
          <p className="text-muted-foreground mb-8">Here's an overview of your vendor account.</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { title: "Total Bookings", value: String(stats.total), icon: Calendar, color: "text-blue-500" },
            { title: "Pending", value: String(stats.pending), icon: Clock, color: "text-yellow-500" },
            { title: "Completed", value: String(stats.completed), icon: CheckCircle2, color: "text-green-500" },
            { title: "Revenue", value: `₹${(stats.completed * 1000).toLocaleString("en-IN")}`, icon: TrendingUp, color: "text-purple-500" },
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
                Edit Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Edit your business details once. Changes become permanent after saving.
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/edit-profile")}>
                Edit Details
              </Button>
            </CardContent>
          </Card>

          {onboarded === false && (
            <Card className="cursor-pointer hover:shadow-md transition-shadow border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Store className="w-5 h-5 text-orange-500" />
                  {hasProfile ? "Continue Onboarding" : "Complete Onboarding"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {hasProfile
                    ? "Your onboarding is incomplete. Finish business details to publish your vendor profile."
                    : "Set up your business profile, add service details, and submit for verification."}
                </p>
                <Button variant="outline" size="sm" onClick={() => navigate("/onboarding")}>
                  Get Started
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="w-5 h-5 text-blue-500" />
                Manage Services
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Add, edit, or remove services you offer to customers.
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/services")}>
                View Services
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5 text-green-500" />
                View Bookings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Track and manage customer bookings and appointments.
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/bookings")}>
                View Bookings
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
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">Email Verification Required</p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      Please verify your email address to start receiving bookings. Check your inbox for a verification link or OTP.
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
