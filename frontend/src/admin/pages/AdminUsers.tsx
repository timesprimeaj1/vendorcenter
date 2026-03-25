import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, LogOut, Users, ArrowLeft, Search, Mail, Phone, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { adminApi } from "../lib/adminApi";

interface UserItem {
  id: string;
  email: string;
  role: string;
  name: string | null;
  phone: string | null;
  verified: boolean;
  created_at: string;
}

const roleColors: Record<string, string> = {
  customer: "bg-blue-100 text-blue-800",
  vendor: "bg-orange-100 text-orange-800",
  admin: "bg-slate-900 text-white",
  employee: "bg-teal-100 text-teal-800",
};

const AdminUsers = () => {
  const { user, logout, loading } = useAdminAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      setFetching(true);
      adminApi.getUsers(filter === "all" ? undefined : filter)
        .then(res => { if (res.data) setUsers(res.data); })
        .catch(() => {})
        .finally(() => setFetching(false));
    }
  }, [user, filter]);

  if (loading || !user) return null;

  const filtered = search.trim()
    ? users.filter(u =>
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.name && u.name.toLowerCase().includes(search.toLowerCase())) ||
        (u.phone && u.phone.includes(search))
      )
    : users;

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
            <Link to="/users" className="text-sm font-medium text-foreground">Users</Link>
            <Link to="/bookings" className="text-sm font-medium text-muted-foreground hover:text-foreground">Bookings</Link>
            <Link to="/zones" className="text-sm font-medium text-muted-foreground hover:text-foreground">Zones</Link>
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
          <h1 className="text-2xl md:text-3xl font-bold mb-2">User Management</h1>
          <p className="text-muted-foreground mb-6">View and manage all registered users.</p>
        </motion.div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex gap-2 flex-wrap">
            {["all", "customer", "vendor", "admin", "employee"].map(r => (
              <Button
                key={r}
                variant={filter === r ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(r)}
                className="capitalize"
              >
                {r}
              </Button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name, email, phone..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</p>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Phone</th>
                    <th className="text-left p-3 font-medium">Role</th>
                    <th className="text-left p-3 font-medium">Verified</th>
                    <th className="text-left p-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {fetching ? (
                    <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No users found</td></tr>
                  ) : (
                    filtered.map(u => (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 font-medium">{u.name || "—"}</td>
                        <td className="p-3">
                          <span className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                            {u.email}
                          </span>
                        </td>
                        <td className="p-3">
                          {u.phone ? (
                            <span className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                              {u.phone}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary" className={`text-xs ${roleColors[u.role] || ""}`}>
                            {u.role}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {u.verified
                            ? <CheckCircle className="w-4 h-4 text-green-500" />
                            : <XCircle className="w-4 h-4 text-red-400" />
                          }
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
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

export default AdminUsers;
