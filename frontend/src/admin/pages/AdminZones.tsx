import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, LogOut, ArrowLeft, Search, Plus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { adminApi } from "../lib/adminApi";

interface Zone {
  id: string;
  country: string;
  state: string;
  city: string;
  zone: string;
  active?: boolean;
  createdAt: string;
}

const AdminZones = () => {
  const { user, logout, loading } = useAdminAuth();
  const navigate = useNavigate();
  const [zones, setZones] = useState<Zone[]>([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ country: "India", state: "", city: "", zone: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  const fetchZones = () => {
    setFetching(true);
    adminApi.getZones()
      .then(res => { if (res.data) setZones(res.data); })
      .catch(() => {})
      .finally(() => setFetching(false));
  };

  useEffect(() => {
    if (user) fetchZones();
  }, [user]);

  const handleAdd = async () => {
    if (!form.state.trim() || !form.city.trim() || !form.zone.trim()) return;
    setSubmitting(true);
    try {
      const res = await adminApi.createZone(form);
      if (res.data) {
        setZones(prev => [...prev, res.data!]);
        setForm({ country: "India", state: "", city: "", zone: "" });
        setShowForm(false);
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) return null;

  const filtered = zones.filter(z => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return z.zone.toLowerCase().includes(q) || z.city.toLowerCase().includes(q) || z.state.toLowerCase().includes(q);
  });

  const grouped = filtered.reduce<Record<string, Zone[]>>((acc, z) => {
    const key = `${z.city}, ${z.state}`;
    (acc[key] = acc[key] || []).push(z);
    return acc;
  }, {});

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
            <Link to="/vendors" className="text-sm font-medium text-muted-foreground hover:text-foreground">Vendors</Link>
            <Link to="/users" className="text-sm font-medium text-muted-foreground hover:text-foreground">Users</Link>
            <Link to="/bookings" className="text-sm font-medium text-muted-foreground hover:text-foreground">Bookings</Link>
            <Link to="/zones" className="text-sm font-medium text-foreground">Zones</Link>
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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">Zones</h1>
              <p className="text-muted-foreground">Manage service coverage areas.</p>
            </div>
            <Button size="sm" onClick={() => setShowForm(prev => !prev)}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Zone
            </Button>
          </div>
        </motion.div>

        {showForm && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">New Zone</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <Input placeholder="Country" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
                <Input placeholder="State" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} />
                <Input placeholder="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                <Input placeholder="Zone name" value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))} />
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" onClick={handleAdd} disabled={submitting}>
                  {submitting ? "Adding..." : "Add"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="relative max-w-xs mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search zone, city, state..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <p className="text-sm text-muted-foreground mb-4">{filtered.length} zone{filtered.length !== 1 ? "s" : ""}</p>

        {fetching ? (
          <p className="text-center text-muted-foreground py-12">Loading...</p>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No zones found</p>
        ) : (
          Object.entries(grouped).map(([city, cityZones]) => (
            <div key={city} className="mb-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> {city}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {cityZones.map(z => (
                  <Card key={z.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{z.zone}</span>
                        {z.active !== undefined && (
                          <Badge variant={z.active ? "default" : "secondary"} className="text-xs">
                            {z.active ? "Active" : "Inactive"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{z.country}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Added {new Date(z.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminZones;
