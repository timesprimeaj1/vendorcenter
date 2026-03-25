import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2, LogOut, Plus, Wrench, IndianRupee, Trash2, Clock4 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/vendor/hooks/useVendorAuth";
import { vendorApi as api } from "@/vendor/lib/vendorApi";
import { toast } from "sonner";
import VendorHeader from "@/vendor/components/VendorHeader";

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
  const { t } = useTranslation("vendor");

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
      .catch(() => toast.error(t("services.failedToLoad", { defaultValue: "Failed to load services" })))
      .finally(() => setLoading(false));
  }, [user]);

  const handleAdd = async () => {
    if (!newName.trim()) { toast.error(t("services.enterServiceName")); return; }
    if (!newPrice || parseFloat(newPrice) < 0) { toast.error(t("services.enterValidPrice")); return; }
    setAddLoading(true);
    try {
      const res = await api.createService({ name: newName.trim(), price: parseFloat(newPrice), availability: "available" });
      if (res.data) setServices(prev => [res.data!, ...prev]);
      setNewName("");
      setNewPrice("");
      setShowAdd(false);
      toast.success(t("services.serviceAdded"));
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
      toast.error(t("services.enterValidNewPrice"));
      return;
    }

    setScheduling(prev => ({ ...prev, [serviceId]: true }));
    try {
      const res = await api.scheduleServicePriceUpdate(serviceId, { newPrice: price, effectiveInDays: days });
      if (res.data) {
        setServices(prev => prev.map(s => s.id === serviceId ? res.data : s));
      }
      toast.success(t("services.priceUpdateScheduled") + ` ${days} ` + t(days === 1 ? "services.day" : "services.days") + ".");
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
      toast.success(t("services.serviceDeleted"));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete service");
    } finally {
      setDeleting(prev => ({ ...prev, [serviceId]: false }));
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <VendorHeader />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          {t("bookings.backToDashboard")}
        </Button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="w-6 h-6 text-orange-500" />
            {t("services.title")}
          </h1>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowDeleted(v => !v)}>
              {showDeleted ? t("services.hideDeleted", { defaultValue: "Hide Deleted" }) : t("services.deletedHistory")}
            </Button>
            <Button size="sm" className="bg-gradient-to-r from-orange-500 to-pink-500 text-white border-0" onClick={() => setShowAdd(!showAdd)}>
              <Plus className="w-4 h-4 mr-1" />
              {t("services.addService")}
            </Button>
          </div>
        </div>

        {showAdd && (
          <Card className="mb-6 border-orange-200">
            <CardHeader>
              <CardTitle className="text-base">{t("services.addNewService")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder={t("services.serviceNamePlaceholder")} className="h-11 rounded-xl" value={newName} onChange={e => setNewName(e.target.value)} />
              <Input placeholder={t("services.pricePlaceholder")} className="h-11 rounded-xl" type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
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
              <p className="font-medium">{t("services.noServices")}</p>
              <p className="text-sm mt-1">{t("services.noServicesDesc")}</p>
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
                      {t("services.scheduledPrice", { price: s.pendingPrice })} {t("services.effectiveOn")} {new Date(s.pendingPriceEffectiveAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                    <div className="sm:col-span-2">
                      <label className="text-xs text-muted-foreground">{t("services.newPrice")}</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={t("services.enterNewPrice")}
                        value={pendingPrices[s.id] ?? ""}
                        onChange={(e) => setPendingPrices(prev => ({ ...prev, [s.id]: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{t("services.applyIn")}</label>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        value={pendingDays[s.id] ?? 1}
                        onChange={(e) => setPendingDays(prev => ({ ...prev, [s.id]: Number(e.target.value) as 1 | 2 }))}
                      >
                        <option value={1}>{t("services.oneDay")}</option>
                        <option value={2}>{t("services.twoDays")}</option>
                      </select>
                    </div>
                    <Button
                      size="sm"
                      disabled={scheduling[s.id]}
                      onClick={() => schedulePriceUpdate(s.id)}
                    >
                      {scheduling[s.id] ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                      {t("services.schedule")}
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
              <CardTitle className="text-base">{t("services.deletedServicesHistory")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {refreshingDeleted ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : deletedServices.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("services.noDeletedServices")}</p>
              ) : (
                deletedServices.map((s) => (
                  <div key={s.id} className="rounded-lg border p-3">
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{t("services.lastPrice", { price: s.price })}</p>
                    <p className="text-xs text-muted-foreground">{t("services.deletedOn")} {s.deletedAt ? new Date(s.deletedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-"}</p>
                    {s.deletedReason && <p className="text-xs text-muted-foreground">{t("services.reason")} {s.deletedReason}</p>}
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
