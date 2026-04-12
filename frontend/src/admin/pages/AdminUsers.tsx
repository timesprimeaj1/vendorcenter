import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, LogOut, ArrowLeft, Search, Mail, Phone, CheckCircle, XCircle, Trash2, Ban, UserPlus, MoreHorizontal, ShieldAlert, ShieldCheck, KeyRound, Clock } from "lucide-react";
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
  suspended: boolean;
  created_at: string;
}

const roleColors: Record<string, string> = {
  customer: "bg-blue-100 text-blue-800",
  vendor: "bg-orange-100 text-orange-800",
  admin: "bg-slate-900 text-white",
  employee: "bg-teal-100 text-teal-800",
};

const PERMISSIONS = [
  { id: "vendors.view", label: "View Vendors" },
  { id: "vendors.verify", label: "Verify Vendors" },
  { id: "bookings.view", label: "View Bookings" },
  { id: "users.view", label: "View Users" },
  { id: "zones.manage", label: "Manage Zones" },
  { id: "support.manage", label: "Manage Support Tasks" },
];

const AdminUsers = () => {
  const { user, logout, loading, hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreateEmployee, setShowCreateEmployee] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({ email: "", password: "", name: "", phone: "", role: "employee" as string, permissions: [] as string[] });
  const [createError, setCreateError] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editPermUser, setEditPermUser] = useState<UserItem | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [permLoading, setPermLoading] = useState(false);
  const [myPermissions, setMyPermissions] = useState<string[]>([]);
  const [myRole, setMyRole] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    adminApi.getMyPermissions()
      .then(res => {
        if (res.data) {
          setMyPermissions(res.data.permissions);
          setMyRole(res.data.role);
        }
      })
      .catch(() => {});
  }, [user]);

  if (!loading && user && !hasPermission("users.view")) {
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

  const loadUsers = () => {
    if (!user) return;
    setFetching(true);
    adminApi.getUsers(filter === "all" ? undefined : filter)
      .then(res => { if (res.data) setUsers(res.data); })
      .catch(() => {})
      .finally(() => setFetching(false));
  };

  useEffect(() => { loadUsers(); }, [user, filter]);

  const handleDelete = async (u: UserItem) => {
    if (!confirm(`Delete ${u.email || u.name || u.id}? This cannot be undone.`)) return;
    setActionLoading(u.id);
    try {
      await adminApi.deleteUser(u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
    } catch (e: any) {
      alert(e.message || "Failed to delete user");
    } finally {
      setActionLoading(null);
      setOpenMenuId(null);
    }
  };

  const handleSuspend = async (u: UserItem) => {
    const action = u.suspended ? "unsuspend" : "suspend";
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${u.email || u.name}?`)) return;
    setActionLoading(u.id);
    try {
      await adminApi.suspendUser(u.id, !u.suspended);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, suspended: !x.suspended } : x));
    } catch (e: any) {
      alert(e.message || `Failed to ${action} user`);
    } finally {
      setActionLoading(null);
      setOpenMenuId(null);
    }
  };

  const handleRoleChange = async (u: UserItem, newRole: string) => {
    if (!confirm(`Change ${u.email || u.name} role to ${newRole}?`)) return;
    setActionLoading(u.id);
    try {
      await adminApi.updateUserRole(u.id, newRole);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x));
    } catch (e: any) {
      alert(e.message || "Failed to change role");
    } finally {
      setActionLoading(null);
      setOpenMenuId(null);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setActionLoading("create");
    try {
      await adminApi.createEmployee(employeeForm);
      setShowCreateEmployee(false);
      setEmployeeForm({ email: "", password: "", name: "", phone: "", role: "employee", permissions: [] });
      loadUsers();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create employee");
    } finally {
      setActionLoading(null);
    }
  };

  const togglePermission = (perm: string) => {
    setEmployeeForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const isAdmin = myRole === "admin" || myPermissions.includes("*");

  const handleVerifyEmployee = async (u: UserItem) => {
    if (!confirm(`Approve ${u.email || u.name || u.id} to access the admin portal?`)) return;
    setActionLoading(u.id);
    try {
      await adminApi.verifyEmployee(u.id);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, verified: true } : x));
    } catch (e: any) {
      alert(e.message || "Failed to verify employee");
    } finally {
      setActionLoading(null);
      setOpenMenuId(null);
    }
  };

  const handleOpenEditPerms = async (u: UserItem) => {
    setPermLoading(true);
    setEditPermUser(u);
    try {
      const res = await adminApi.getEmployeePermissions(u.id);
      setEditPerms(res.data?.permissions || []);
    } catch {
      setEditPerms([]);
    } finally {
      setPermLoading(false);
    }
  };

  const toggleEditPerm = (perm: string) => {
    setEditPerms(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const handleSavePerms = async () => {
    if (!editPermUser) return;
    setPermLoading(true);
    try {
      await adminApi.updateEmployeePermissions(editPermUser.id, editPerms);
      setEditPermUser(null);
    } catch (e: any) {
      alert(e.message || "Failed to update permissions");
    } finally {
      setPermLoading(false);
    }
  };

  if (loading || !user) return null;

  const filtered = search.trim()
    ? users.filter(u =>
        (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
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
            {hasPermission("vendors.view") && <Link to="/vendors" className="text-sm font-medium text-muted-foreground hover:text-foreground">Vendors</Link>}
            <Link to="/users" className="text-sm font-medium text-foreground">Users</Link>
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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">User Management</h1>
              <p className="text-muted-foreground">View and manage all registered users.</p>
            </div>
            <Button onClick={() => setShowCreateEmployee(true)} className="gap-1.5">
              <UserPlus className="w-4 h-4" /> Create Employee
            </Button>
          </div>
        </motion.div>

        {/* Create Employee Modal */}
        {showCreateEmployee && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateEmployee(false)}>
            <Card className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
              <CardContent className="p-6">
                <h2 className="text-lg font-bold mb-4">{isAdmin ? "Create Employee / Sub-Admin" : "Create Employee"}</h2>
                <form onSubmit={handleCreateEmployee} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Name *</label>
                      <Input value={employeeForm.name} onChange={e => setEmployeeForm(p => ({ ...p, name: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Email *</label>
                      <Input type="email" value={employeeForm.email} onChange={e => setEmployeeForm(p => ({ ...p, email: e.target.value }))} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Password *</label>
                      <Input type="password" value={employeeForm.password} onChange={e => setEmployeeForm(p => ({ ...p, password: e.target.value }))} required minLength={8} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Phone</label>
                      <Input value={employeeForm.phone} onChange={e => setEmployeeForm(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="text-sm font-medium mb-1 block">Role</label>
                      <div className="flex gap-3">
                        {["employee", "admin"].map(r => (
                          <label key={r} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="role" value={r} checked={employeeForm.role === r} onChange={() => setEmployeeForm(p => ({ ...p, role: r }))} />
                            <span className="text-sm capitalize">{r === "admin" ? "Sub-Admin" : "Employee"}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {employeeForm.role === "employee" && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Permissions</label>
                      <div className="grid grid-cols-2 gap-2">
                        {PERMISSIONS.map(p => (
                          <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={employeeForm.permissions.includes(p.id)}
                              onChange={() => togglePermission(p.id)}
                              className="rounded"
                            />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {createError && <p className="text-sm text-red-500">{createError}</p>}
                  <div className="flex gap-3 justify-end">
                    <Button type="button" variant="outline" onClick={() => setShowCreateEmployee(false)}>Cancel</Button>
                    <Button type="submit" disabled={actionLoading === "create"}>
                      {actionLoading === "create" ? "Creating..." : "Create"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

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
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Joined</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fetching ? (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No users found</td></tr>
                  ) : (
                    filtered.map(u => (
                      <tr key={u.id} className={`border-b last:border-0 hover:bg-muted/30 ${u.suspended ? "opacity-60" : ""}`}>
                        <td className="p-3 font-medium">{u.name || "—"}</td>
                        <td className="p-3">
                          <span className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                            {u.email || "—"}
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
                          {u.suspended ? (
                            <Badge variant="destructive" className="text-xs">Suspended</Badge>
                          ) : !u.verified && (u.role === "employee" || u.role === "admin") ? (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50 gap-1">
                              <Clock className="w-3 h-3" />
                              Pending Approval
                            </Badge>
                          ) : u.verified ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="p-3">
                          {u.id !== user.id ? (
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                                disabled={actionLoading === u.id}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                              {openMenuId === u.id && (
                                <div className="absolute right-0 top-9 z-20 bg-card border rounded-lg shadow-lg py-1 min-w-[180px]">
                                  {isAdmin && !u.verified && (u.role === "employee" || u.role === "admin") && (
                                    <button
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 text-green-600"
                                      onClick={() => handleVerifyEmployee(u)}
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5" />
                                      Approve Account
                                    </button>
                                  )}
                                  {isAdmin && u.role === "employee" && (
                                    <button
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                                      onClick={() => { handleOpenEditPerms(u); setOpenMenuId(null); }}
                                    >
                                      <KeyRound className="w-3.5 h-3.5" />
                                      Edit Permissions
                                    </button>
                                  )}
                                  {(isAdmin || (u.role !== 'admin' && u.role !== 'employee')) && (
                                    <button
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                                      onClick={() => handleSuspend(u)}
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                      {u.suspended ? "Unsuspend" : "Suspend"}
                                    </button>
                                  )}
                                  {isAdmin && u.role !== "admin" && (
                                    <button
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                                      onClick={() => handleRoleChange(u, u.role === "employee" ? "admin" : "employee")}
                                    >
                                      <ShieldAlert className="w-3.5 h-3.5" />
                                      {u.role === "employee" ? "Promote to Admin" : "Make Employee"}
                                    </button>
                                  )}
                                  {isAdmin && (
                                    <button
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-red-600 flex items-center gap-2"
                                      onClick={() => handleDelete(u)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Delete User
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">You</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Edit Permissions Modal */}
        {editPermUser && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditPermUser(null)}>
            <Card className="w-full max-w-md" onClick={e => e.stopPropagation()}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                    <KeyRound className="w-5 h-5 text-teal-700" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Edit Permissions</h2>
                    <p className="text-sm text-muted-foreground">{editPermUser.name || editPermUser.email}</p>
                  </div>
                </div>
                {permLoading ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Loading permissions...</p>
                ) : (
                  <>
                    <div className="space-y-2 mb-6">
                      {PERMISSIONS.map(p => (
                        <label key={p.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={editPerms.includes(p.id)}
                            onChange={() => toggleEditPerm(p.id)}
                            className="rounded"
                          />
                          <span className="text-sm font-medium">{p.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-3 justify-end">
                      <Button variant="outline" onClick={() => setEditPermUser(null)}>Cancel</Button>
                      <Button onClick={handleSavePerms} disabled={permLoading}>
                        {permLoading ? "Saving..." : "Save Permissions"}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;
