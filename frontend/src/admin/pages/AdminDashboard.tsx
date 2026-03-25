import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, LogOut, Users, Store, MapPin, BarChart3,
  Calendar, CreditCard, ClipboardList, Activity, TrendingUp,
  Clock, IndianRupee
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { adminApi } from "../lib/adminApi";

interface Stats {
  totalCustomers: number;
  totalVendors: number;
  totalBookings: number;
  pendingApprovals: number;
  totalRevenue: number;
}

interface ActivityItem {
  id: string;
  actor_id: string;
  role: string;
  action: string;
  entity: string;
  metadata: any;
  created_at: string;
}

const AdminDashboard = () => {
  const { user, logout, loading } = useAdminAuth();
  const navigate = useNavigate();
  const [modules, setModules] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      adminApi.getDashboard().then(res => {
        if (res.data?.manage) setModules(res.data.manage);
      }).catch(() => {});
      adminApi.getStats().then(res => {
        if (res.data) setStats(res.data);
      }).catch(() => {});
      adminApi.getRecentActivity().then(res => {
        if (res.data) setActivity(res.data);
      }).catch(() => {});
    }
  }, [user]);

  if (loading || !user) return null;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const statCards = [
    { title: "Customers", value: stats?.totalCustomers ?? "--", icon: Users, color: "text-blue-500", bg: "bg-blue-50" },
    { title: "Vendors", value: stats?.totalVendors ?? "--", icon: Store, color: "text-orange-500", bg: "bg-orange-50" },
    { title: "Bookings", value: stats?.totalBookings ?? "--", icon: Calendar, color: "text-green-500", bg: "bg-green-50" },
    { title: "Pending Approvals", value: stats?.pendingApprovals ?? "--", icon: Clock, color: "text-amber-500", bg: "bg-amber-50" },
    { title: "Revenue", value: stats ? `₹${stats.totalRevenue.toLocaleString("en-IN")}` : "--", icon: IndianRupee, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  const moduleConfig: Record<string, { icon: any; color: string; description: string; href?: string }> = {
    vendors: { icon: Store, color: "text-orange-500", description: "Review, approve, and manage vendor applications", href: "/vendors" },
    users: { icon: Users, color: "text-blue-500", description: "View and manage registered users", href: "/users" },
    zones: { icon: MapPin, color: "text-green-500", description: "Manage service delivery zones", href: "/zones" },
    services: { icon: ClipboardList, color: "text-purple-500", description: "Browse and moderate services" },
    bookings: { icon: Calendar, color: "text-indigo-500", description: "View platform bookings and disputes", href: "/bookings" },
    payments: { icon: CreditCard, color: "text-pink-500", description: "Monitor payment transactions and refunds" },
    employees: { icon: Users, color: "text-teal-500", description: "Manage employee accounts and zone assignments" },
    analytics: { icon: BarChart3, color: "text-amber-500", description: "Platform-wide analytics and insights" },
  };

  const formatAction = (action: string) => action.replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span translate="no" className="notranslate font-bold text-lg hidden sm:block">
              VendorCenter
              <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">ADMIN</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/dashboard" className="text-sm font-medium text-foreground">Dashboard</Link>
            <Link to="/vendors" className="text-sm font-medium text-muted-foreground hover:text-foreground">Vendors</Link>
            <Link to="/users" className="text-sm font-medium text-muted-foreground hover:text-foreground">Users</Link>
            <Link to="/bookings" className="text-sm font-medium text-muted-foreground hover:text-foreground">Bookings</Link>
            <Link to="/zones" className="text-sm font-medium text-muted-foreground hover:text-foreground">Zones</Link>
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground mb-8">Manage all aspects of the VendorCenter platform.</p>
        </motion.div>

        {/* Live Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {statCards.map((stat, i) => (
            <motion.div key={stat.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.title}</p>
                      <p className="text-xl font-bold">{stat.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Management Modules */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {modules.map((mod, i) => {
                const config = moduleConfig[mod] || { icon: ClipboardList, color: "text-gray-500", description: mod };
                const Icon = config.icon;
                return (
                  <motion.div key={mod} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.05 }}>
                    <Card
                      className={`hover:shadow-md transition-shadow ${config.href ? "cursor-pointer" : "opacity-60"}`}
                      onClick={() => config.href && navigate(config.href)}
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base capitalize">
                          <Icon className={`w-5 h-5 ${config.color}`} />
                          {mod}
                          {!config.href && <span className="text-[10px] ml-auto bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-normal normal-case">Soon</span>}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{config.description}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
            <Card>
              <CardContent className="pt-4 space-y-3 max-h-[480px] overflow-y-auto">
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
                ) : (
                  activity.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{formatAction(a.action)}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.role} &middot; {a.entity} &middot; {timeAgo(a.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
