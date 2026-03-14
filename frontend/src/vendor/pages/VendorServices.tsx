import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2, LogOut, Plus, Wrench, IndianRupee, Trash2, Clock4 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/vendor/hooks/useVendorAuth";
import { vendorApi as api } from "@/vendor/lib/vendorApi";
import { toast } from "sonner";

const VendorServices = () => {
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [refreshingDeleted, setRefreshingDeleted] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [pendingPrices, setPendingPrices] = useState<Record<string, string>>({});
  const [pendingDays, setPendingDays] = useState<Record<string, 1 | 2>>({});
  const [scheduling, setScheduling] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [deletedServices, setDeletedServices] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([api.getVendorServices(), api.getDeletedVendorServices()])
      .then(([activeRes, deletedRes]) => {
        setServices(activeRes.data || []);
        setDeletedServices(deletedRes.data || []);
      })
      .catch(() => toast.error("Failed to load services"))
      .finally(() => setLoading(false));
  }, [user]);

  const handleAdd = async () => {
    if (!newName.trim()) { toast.error("Enter service name"); return; }
    if (!newPrice || parseFloat(newPrice) < 0) { toast.error("Enter a valid price"); return; }
    setAddLoading(true);
    try {
      const res = await api.createService({ name: newName.trim(), price: parseFloat(newPrice), availability: "available" });
      if (res.data) setServices(prev => [res.data!, ...prev]);
      setNewName("");
      setNewPrice("");
      setShowAdd(false);
      toast.success("Service added!");
    } catch (err: any) {
      toast.error(err.message || "Failed to add service");
    } finally {
      setAddLoading(false);
    }
  };

  const refreshDeleted = async () => {
    setRefreshingDeleted(true);
    try {
      const res = await api.getDeletedVendorServices();
      setDeletedServices(res.data || []);
    } finally {
      setRefreshingDeleted(false);
    }
  };

  const schedulePriceUpdate = async (serviceId: string) => {
    const price = parseFloat(pendingPrices[serviceId] ?? "");
    const days = pendingDays[serviceId] ?? 1;
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Enter a valid new price");
      return;
    }

    setScheduling(prev => ({ ...prev, [serviceId]: true }));
    try {
      const res = await api.scheduleServicePriceUpdate(serviceId, { newPrice: price, effectiveInDays: days });
      if (res.data) {
        setServices(prev => prev.map(s => s.id === serviceId ? res.data : s));
      }
      toast.success(`Price update scheduled. It will go live in ${days} day${days === 1 ? "" : "s"}.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to schedule price update");
    } finally {
      setScheduling(prev => ({ ...prev, [serviceId]: false }));
    }
  };

  const deleteService = async (serviceId: string) => {
    const reason = window.prompt("Reason for deleting this service (optional):", "No longer offered");
    setDeleting(prev => ({ ...prev, [serviceId]: true }));
    try {
      await api.deleteService(serviceId, reason?.trim() || undefined);
      setServices(prev => prev.filter(s => s.id !== serviceId));
      await refreshDeleted();
      toast.success("Service deleted and added to history");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete service");
    } finally {
      setDeleting(prev => ({ ...prev, [serviceId]: false }));
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
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
          <Button variant="ghost" size="sm" onClick={async () => { await logout(); navigate("/login"); }}>
            <LogOut className="w-4 h-4 mr-1.5" />
            Logout
          </Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Dashboard
        </Button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="w-6 h-6 text-orange-500" />
            Your Services
          </h1>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowDeleted(v => !v)}>
              {showDeleted ? "Hide Deleted" : "Deleted History"}
            </Button>
            <Button size="sm" className="bg-gradient-to-r from-orange-500 to-pink-500 text-white border-0" onClick={() => setShowAdd(!showAdd)}>
              <Plus className="w-4 h-4 mr-1" />
              Add Service
            </Button>
          </div>
        </div>

        {showAdd && (
          <Card className="mb-6 border-orange-200">
            <CardHeader>
              <CardTitle className="text-base">Add New Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Service name (e.g. Deep Cleaning)" className="h-11 rounded-xl" value={newName} onChange={e => setNewName(e.target.value)} />
              <Input placeholder="Price (₹)" className="h-11 rounded-xl" type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" disabled={addLoading} onClick={handleAdd} className="bg-green-600 hover:bg-green-700 text-white">
                  {addLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : services.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <Wrench className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No services yet</p>
              <p className="text-sm mt-1">Add your first service to start receiving bookings.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {services.map((s) => (
              <Card key={s.id}>
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <IndianRupee className="w-3 h-3" />
                        {s.price}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.availability === "available" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                        {s.availability}
                      </span>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={deleting[s.id]}
                        onClick={() => deleteService(s.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        {deleting[s.id] ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>

                  {s.pendingPrice != null && s.pendingPriceEffectiveAt && (
                    <p className="text-xs text-orange-700 flex items-center gap-1">
                      <Clock4 className="w-3.5 h-3.5" />
                      Scheduled price ₹{s.pendingPrice} effective on {new Date(s.pendingPriceEffectiveAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                    <div className="sm:col-span-2">
                      <label className="text-xs text-muted-foreground">New Price</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Enter new price"
                        value={pendingPrices[s.id] ?? ""}
                        onChange={(e) => setPendingPrices(prev => ({ ...prev, [s.id]: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Apply In</label>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        value={pendingDays[s.id] ?? 1}
                        onChange={(e) => setPendingDays(prev => ({ ...prev, [s.id]: Number(e.target.value) as 1 | 2 }))}
                      >
                        <option value={1}>1 day</option>
                        <option value={2}>2 days</option>
                      </select>
                    </div>
                    <Button
                      size="sm"
                      disabled={scheduling[s.id]}
                      onClick={() => schedulePriceUpdate(s.id)}
                    >
                      {scheduling[s.id] ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                      Schedule
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {showDeleted && (
          <Card className="mt-6 border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Deleted Services History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {refreshingDeleted ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : deletedServices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deleted services yet.</p>
              ) : (
                deletedServices.map((s) => (
                  <div key={s.id} className="rounded-lg border p-3">
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground">Last price: ₹{s.price}</p>
                    <p className="text-xs text-muted-foreground">Deleted on: {s.deletedAt ? new Date(s.deletedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-"}</p>
                    {s.deletedReason && <p className="text-xs text-muted-foreground">Reason: {s.deletedReason}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default VendorServices;
