import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, LogOut, ArrowLeft, TrendingUp, Users, Store,
  MapPin, IndianRupee, Calendar, BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { adminApi } from "../lib/adminApi";

interface AnalyticsData {
  totalRevenue: number;
  totalCustomers: number;
  totalVendors: number;
  activeZones: number;
  bookingsByStatus: Record<string, number>;
  monthlyBookings: { month: string; count: number }[];
  topVendors: { vendorId: string; businessName: string; bookings: number; revenue: number }[];
  customerGrowth: { month: string; count: number }[];
  vendorGrowth: { month: string; count: number }[];
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const AdminAnalytics = () => {
  const { user, logout, loading, hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      setFetching(true);
      adminApi.getAnalytics()
        .then(res => { if (res.data) setData(res.data); })
        .catch(() => {})
        .finally(() => setFetching(false));
    }
  }, [user]);

  if (loading || !user) return null;

  if (!hasPermission("analytics.view") && user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">You don't have permission to view analytics.</p>
          <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const totalBookings = data ? Object.values(data.bookingsByStatus).reduce((a, b) => a + b, 0) : 0;
  const maxMonthly = data ? Math.max(...data.monthlyBookings.map(m => m.count), 1) : 1;

  const formatMonth = (m: string) => {
    const [year, month] = m.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[parseInt(month) - 1]} ${year.slice(2)}`;
  };

  return (
    <div className="min-h-screen bg-background">
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
            <Link to="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground">Dashboard</Link>
            {hasPermission("vendors.view") && <Link to="/vendors" className="text-sm font-medium text-muted-foreground hover:text-foreground">Vendors</Link>}
            {hasPermission("users.view") && <Link to="/users" className="text-sm font-medium text-muted-foreground hover:text-foreground">Users</Link>}
            {hasPermission("bookings.view") && <Link to="/bookings" className="text-sm font-medium text-muted-foreground hover:text-foreground">Bookings</Link>}
            <Link to="/analytics" className="text-sm font-medium text-foreground">Analytics</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={async () => { await logout(); navigate("/login"); }}>
              <LogOut className="w-4 h-4 mr-1.5" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Dashboard
        </Button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Analytics</h1>
              <p className="text-muted-foreground">Platform-wide insights and performance metrics.</p>
            </div>
          </div>
        </motion.div>

        {fetching ? (
          <p className="text-center text-muted-foreground py-16">Loading analytics...</p>
        ) : !data ? (
          <p className="text-center text-muted-foreground py-16">Failed to load analytics</p>
        ) : (
          <div className="space-y-8">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { title: "Total Revenue", value: `₹${data.totalRevenue.toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-emerald-600", bg: "bg-emerald-50" },
                { title: "Total Bookings", value: totalBookings, icon: Calendar, color: "text-blue-500", bg: "bg-blue-50" },
                { title: "Customers", value: data.totalCustomers, icon: Users, color: "text-indigo-500", bg: "bg-indigo-50" },
                { title: "Vendors", value: data.totalVendors, icon: Store, color: "text-orange-500", bg: "bg-orange-50" },
              ].map((s, i) => (
                <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                  <Card>
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                          <s.icon className={`w-5 h-5 ${s.color}`} />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{s.title}</p>
                          <p className="text-xl font-bold">{s.value}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bookings by Status */}
              <Card>
                <CardHeader><CardTitle className="text-base">Bookings by Status</CardTitle></CardHeader>
                <CardContent>
                  {Object.keys(data.bookingsByStatus).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No bookings yet</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(data.bookingsByStatus).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-xs ${statusColors[status] || "bg-gray-100 text-gray-800"}`}>
                              {status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-32 bg-muted rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${(count / totalBookings) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold tabular-nums w-8 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Monthly Bookings Trend */}
              <Card>
                <CardHeader><CardTitle className="text-base">Monthly Bookings (last 6 months)</CardTitle></CardHeader>
                <CardContent>
                  {data.monthlyBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No data yet</p>
                  ) : (
                    <div className="flex items-end gap-2 h-40">
                      {data.monthlyBookings.map(m => (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs font-semibold tabular-nums">{m.count}</span>
                          <div
                            className="w-full bg-primary/80 rounded-t transition-all min-h-[4px]"
                            style={{ height: `${(m.count / maxMonthly) * 120}px` }}
                          />
                          <span className="text-[10px] text-muted-foreground">{formatMonth(m.month)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Vendors */}
              <Card>
                <CardHeader><CardTitle className="text-base">Top Vendors</CardTitle></CardHeader>
                <CardContent>
                  {data.topVendors.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No vendor data yet</p>
                  ) : (
                    <div className="space-y-3">
                      {data.topVendors.map((v, i) => (
                        <div key={v.vendorId} className="flex items-center justify-between py-1.5 border-b last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                            <div>
                              <p className="text-sm font-medium">{v.businessName || "Unnamed"}</p>
                              <p className="text-xs text-muted-foreground">{v.bookings} booking{v.bookings !== 1 ? "s" : ""}</p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold">₹{v.revenue.toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Growth Trends */}
              <Card>
                <CardHeader><CardTitle className="text-base">User Growth (last 6 months)</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Users className="w-3 h-3" /> Customer signups</p>
                      <div className="flex items-end gap-1.5 h-16">
                        {data.customerGrowth.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No data</p>
                        ) : data.customerGrowth.map(m => {
                          const max = Math.max(...data.customerGrowth.map(g => g.count), 1);
                          return (
                            <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                              <span className="text-[10px] font-semibold tabular-nums">{m.count}</span>
                              <div className="w-full bg-indigo-400 rounded-t min-h-[2px]" style={{ height: `${(m.count / max) * 48}px` }} />
                              <span className="text-[9px] text-muted-foreground">{formatMonth(m.month)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Store className="w-3 h-3" /> Vendor signups</p>
                      <div className="flex items-end gap-1.5 h-16">
                        {data.vendorGrowth.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No data</p>
                        ) : data.vendorGrowth.map(m => {
                          const max = Math.max(...data.vendorGrowth.map(g => g.count), 1);
                          return (
                            <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                              <span className="text-[10px] font-semibold tabular-nums">{m.count}</span>
                              <div className="w-full bg-orange-400 rounded-t min-h-[2px]" style={{ height: `${(m.count / max) * 48}px` }} />
                              <span className="text-[9px] text-muted-foreground">{formatMonth(m.month)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAnalytics;
