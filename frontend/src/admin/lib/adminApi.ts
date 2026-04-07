function resolveApiBase() {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocalHost = host === "localhost" || host === "127.0.0.1";
    if (!isLocalHost) return "/api";
  }

  const raw = import.meta.env.VITE_API_BASE_URL;
  if (!raw) return "/api";
  const base = raw.startsWith("http") ? raw : `https://${raw}`;
  return `${base.replace(/\/+$/, "")}/api`;
}
const API_BASE = resolveApiBase();

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem("adminAccessToken");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && localStorage.getItem("adminRefreshToken")) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${localStorage.getItem("adminAccessToken")}`;
        const retry = await fetch(`${API_BASE}${path}`, { ...options, headers });
        return retry.json().catch(() => ({}));
      }
    }
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem("adminRefreshToken");
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      localStorage.removeItem("adminAccessToken");
      localStorage.removeItem("adminRefreshToken");
      localStorage.removeItem("adminUser");
      return false;
    }
    const body = await res.json();
    localStorage.setItem("adminAccessToken", body.data.accessToken);
    localStorage.setItem("adminRefreshToken", body.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export interface Actor {
  id: string;
  role: string;
  email: string;
  verified: boolean;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  actor: Actor;
}

export const adminApi = {
  login: (payload: { email: string; password: string }) =>
    request<AuthResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ ...payload, role: "admin" }),
    }),

  logout: () => {
    const refreshToken = localStorage.getItem("adminRefreshToken");
    return request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  },

  getDashboard: () => request<{ manage: string[] }>("/admin/dashboard"),

  getStats: () => request<{
    totalCustomers: number;
    totalVendors: number;
    totalBookings: number;
    pendingApprovals: number;
    totalRevenue: number;
  }>("/admin/stats"),

  getUsers: (role?: string) =>
    request<any[]>(`/admin/users${role ? `?role=${role}` : ""}`),

  getBookings: () => request<any[]>("/admin/bookings"),

  getRecentActivity: () => request<any[]>("/admin/recent-activity"),

  getVendors: () => request<any[]>("/vendors"),

  getVendorQueue: (status?: string) =>
    request<any[]>(`/vendors/queue${status ? `?status=${status}` : ""}`),

  updateVendorVerification: (vendorId: string, status: string, note?: string) =>
    request(`/vendors/${vendorId}/verification`, {
      method: "PATCH",
      body: JSON.stringify({ verificationStatus: status, note }),
    }),

  getZones: () => request<any[]>("/zones"),

  createZone: (payload: { country: string; state: string; city: string; zone: string }) =>
    request<any>("/zones", { method: "POST", body: JSON.stringify(payload) }),

  getAnalytics: () => request<any>("/analytics/admin"),

  getActivityLogs: () => request<any[]>("/activity"),

  deleteUser: (userId: string) =>
    request<{ message: string }>(`/admin/users/${userId}`, { method: "DELETE" }),

  updateUserRole: (userId: string, role: string) =>
    request<any>(`/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  suspendUser: (userId: string, suspended: boolean) =>
    request<any>(`/admin/users/${userId}/suspend`, {
      method: "PATCH",
      body: JSON.stringify({ suspended }),
    }),

  createEmployee: (payload: { email: string; password: string; name: string; phone?: string; role?: string; permissions?: string[] }) =>
    request<any>("/admin/employees", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateBookingStatus: (bookingId: string, status: string) =>
    request<any>(`/admin/bookings/${bookingId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};
