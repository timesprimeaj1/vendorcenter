import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, LogOut, ArrowLeft, Search, Calendar, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { adminApi } from "../lib/adminApi";

interface Booking {
  id: string;
  customer_id: string;
  vendor_id: string;
  service_name: string;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  final_amount: number | null;
  notes: string | null;
  created_at: string;
  customer_email: string;
  customer_name: string | null;
  vendor_email: string;
  business_name: string | null;
  service_pincode: string | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const AdminBookings = () => {
  const { user, logout, loading, hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pincodeFilter, setPincodeFilter] = useState("");
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  if (!loading && user && !hasPermission("bookings.view")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">You don't have permission to view this page.</p>
          <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (user) {
      setFetching(true);
      adminApi.getBookings()
        .then(res => { if (res.data) setBookings(res.data); })
        .catch(() => {})
        .finally(() => setFetching(false));
    }
  }, [user]);

  if (loading || !user) return null;

  const filtered = bookings.filter(b => {
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (pincodeFilter.trim() && b.service_pincode !== pincodeFilter.trim()) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        b.service_name.toLowerCase().includes(q) ||
        (b.customer_email && b.customer_email.toLowerCase().includes(q)) ||
        (b.customer_name && b.customer_name.toLowerCase().includes(q)) ||
        (b.business_name && b.business_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const uniquePincodes = [...new Set(bookings.map(b => b.service_pincode).filter(Boolean))] as string[];

  const statuses = ["all", "pending", "confirmed", "in_progress", "completed", "cancelled"];

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
            <Link to="/bookings" className="text-sm font-medium text-foreground">Bookings</Link>
            {hasPermission("zones.manage") && <Link to="/zones" className="text-sm font-medium text-muted-foreground hover:text-foreground">Zones</Link>}
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
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Bookings</h1>
          <p className="text-muted-foreground mb-6">View all platform bookings and disputes.</p>
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex gap-2 flex-wrap">
            {statuses.map(s => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(s)}
                className="capitalize"
              >
                {s.replace("_", " ")}
              </Button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search service, customer, vendor..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {uniquePincodes.length > 0 && (
            <div className="relative max-w-[180px]">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select
                className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-sm"
                value={pincodeFilter}
                onChange={e => setPincodeFilter(e.target.value)}
              >
                <option value="">All Zones</option>
                {uniquePincodes.sort().map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-4">{filtered.length} booking{filtered.length !== 1 ? "s" : ""}</p>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Service</th>
                    <th className="text-left p-3 font-medium">Customer</th>
                    <th className="text-left p-3 font-medium">Vendor</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Amount</th>
                    <th className="text-left p-3 font-medium">Scheduled</th>
                    <th className="text-left p-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {fetching ? (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No bookings found</td></tr>
                  ) : (
                    filtered.map(b => (
                      <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 font-medium">{b.service_name}</td>
                        <td className="p-3">{b.customer_name || b.customer_email || "—"}</td>
                        <td className="p-3">{b.business_name || b.vendor_email || "—"}</td>
                        <td className="p-3">
                          <Badge variant="secondary" className={`text-xs ${statusColors[b.status] || ""}`}>
                            {b.status.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="p-3">{b.final_amount != null ? `₹${(b.final_amount / 100).toFixed(0)}` : "—"}</td>
                        <td className="p-3 text-muted-foreground">
                          {b.scheduled_date ? (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(b.scheduled_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              {b.scheduled_time ? ` ${b.scheduled_time}` : ""}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(b.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminBookings;
