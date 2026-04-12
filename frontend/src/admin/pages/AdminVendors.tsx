import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, LogOut, Store, CheckCircle2, XCircle, Clock, ArrowLeft, MapPin, Phone, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { adminApi } from "../lib/adminApi";
import { toast } from "sonner";

interface VendorItem {
  id: string;
  vendorId: string;
  businessName: string;
  serviceCategories: string[];
  zone: string;
  verificationStatus: string;
  createdAt: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  profilePictureUrl?: string;
  primaryPincode?: string;
  workingHours?: string;
}

const AdminVendors = () => {
  const { user, logout, loading, hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [filter, setFilter] = useState<string>("under_review");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  if (!loading && user && !hasPermission("vendors.view")) {
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
      setVendors([]);
      adminApi.getVendorQueue(filter).then(res => {
        if (res.data) setVendors(res.data);
      }).catch(() => {}).finally(() => setFetching(false));
    }
  }, [user, filter]);

  if (loading || !user) return null;

  const handleVerification = async (vendorId: string, status: string) => {
    setActionLoading(vendorId);
    try {
      await adminApi.updateVendorVerification(vendorId, status);
      toast.success(`Vendor ${status === "approved" ? "approved" : "rejected"}`);
      setVendors(prev => prev.filter(v => v.vendorId !== vendorId));
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const statusColor: Record<string, string> = {
    under_review: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
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
            <Link to="/vendors" className="text-sm font-medium text-foreground">Vendors</Link>
            {hasPermission("users.view") && <Link to="/users" className="text-sm font-medium text-muted-foreground hover:text-foreground">Users</Link>}
            {hasPermission("bookings.view") && <Link to="/bookings" className="text-sm font-medium text-muted-foreground hover:text-foreground">Bookings</Link>}
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
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Vendor Management</h1>
          <p className="text-muted-foreground mb-6">Review and manage vendor applications.</p>
        </motion.div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { label: "Pending Review", value: "under_review" },
            { label: "Approved", value: "approved" },
            { label: "Rejected", value: "rejected" },
          ].map(tab => (
            <Button
              key={tab.value}
              variant={filter === tab.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(tab.value)}
              className={filter === tab.value ? "bg-slate-900" : ""}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Vendor list */}
        {fetching ? (
          <p className="text-center text-muted-foreground py-12">Loading vendors...</p>
        ) : vendors.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Store className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No vendors in this category.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {vendors.map((v, i) => (
              <motion.div key={v.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex gap-3 flex-1">
                        {v.profilePictureUrl ? (
                          <img
                            src={v.profilePictureUrl.startsWith("http") ? v.profilePictureUrl : `/api/uploads/files/${v.profilePictureUrl}`}
                            alt=""
                            className="w-14 h-14 rounded-full object-cover border-2 border-border shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center shrink-0">
                            <User className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-lg">{v.businessName}</h3>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[v.verificationStatus] || "bg-gray-100 text-gray-800"}`}>
                              {v.verificationStatus?.replace("_", " ")}
                            </span>
                          </div>
                          {v.ownerName && (
                            <p className="text-sm text-muted-foreground">
                              <User className="w-3.5 h-3.5 inline mr-1" />{v.ownerName}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-0.5 text-sm text-muted-foreground">
                            {v.ownerPhone && (
                              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{v.ownerPhone}</span>
                            )}
                            {v.ownerEmail && (
                              <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{v.ownerEmail}</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            <MapPin className="w-3.5 h-3.5 inline mr-1" />{v.zone}{v.primaryPincode ? ` — ${v.primaryPincode}` : ""}
                          </p>
                          {v.workingHours && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              <Clock className="w-3 h-3 inline mr-1" />{v.workingHours}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {(v.serviceCategories || []).map((cat: string) => (
                              <Badge key={cat} variant="secondary" className="text-xs">{cat}</Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Registered: {new Date(v.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      </div>

                      {filter === "under_review" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            disabled={actionLoading === v.vendorId}
                            onClick={() => handleVerification(v.vendorId, "approved")}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={actionLoading === v.vendorId}
                            onClick={() => handleVerification(v.vendorId, "rejected")}
                          >
                            <XCircle className="w-4 h-4 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminVendors;
