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
  const token = localStorage.getItem("customer_accessToken");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Try token refresh on 401
    if (res.status === 401 && localStorage.getItem("customer_refreshToken")) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${localStorage.getItem("customer_accessToken")}`;
        const retry = await fetch(`${API_BASE}${path}`, { ...options, headers });
        return retry.json().catch(() => ({}));
      }
    }
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
}

// Singleton to prevent concurrent refresh race conditions
let refreshPromise: Promise<boolean> | null = null;

export async function refreshAccessToken(): Promise<boolean> {
  // If a refresh is already in flight, wait for it instead of starting another
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem("customer_refreshToken");
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        localStorage.removeItem("customer_accessToken");
        localStorage.removeItem("customer_refreshToken");
        localStorage.removeItem("customer_user");
        return false;
      }
      const body = await res.json();
      localStorage.setItem("customer_accessToken", body.data.accessToken);
      localStorage.setItem("customer_refreshToken", body.data.refreshToken);
      return true;
    } catch {
      return false;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// ─── Auth ──────────────────────────────────────
export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  email: string;
  password: string;
  role: "customer" | "vendor";
  name?: string;
  phone?: string;
  businessName?: string;
}

export interface PublicStats {
  activeVendors: number;
  happyCustomers: number;
  servicesCompleted: number;
  citiesCovered: number;
}

export interface Actor {
  id: string;
  role: string;
  email: string;
  verified: boolean;
  name?: string;
  phone?: string;
  businessName?: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  actor: Actor;
}

export const api = {
  // Auth
  login: (payload: LoginPayload) =>
    request<AuthResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  signup: (payload: SignupPayload) =>
    request<{ userId: string; email: string; role: string }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  logout: () => {
    const refreshToken = localStorage.getItem("customer_refreshToken");
    return request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  },

  // OTP
  requestOtp: (email: string, purpose: string) =>
    request<{ otpId: string; expiresInMinutes: number; otpCodeForDev?: string }>(
      "/otp/request",
      { method: "POST", body: JSON.stringify({ email, purpose }) }
    ),

  verifyOtp: (otpId: string, code: string, purpose: string) =>
    request<{ verified: boolean; accessToken?: string; refreshToken?: string; actor?: Actor }>("/otp/verify", {
      method: "POST",
      body: JSON.stringify({ otpId, code, purpose }),
    }),

  // Services
  getServices: () => request<any[]>("/services"),

  // Public analytics (homepage counters)
  getPublicStats: () => request<PublicStats>("/analytics/public"),

  // Password reset
  resetPassword: (payload: { email: string; otpId: string; code: string; newPassword: string }) =>
    request<{ reset: boolean }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Vendors
  getVendors: () => request<any[]>("/vendors"),

  getCategories: (lat?: number, lng?: number, radius?: number) => {
    const params = new URLSearchParams();
    if (lat != null) params.set("lat", String(lat));
    if (lng != null) params.set("lng", String(lng));
    if (radius != null) params.set("radius", String(radius));
    const qs = params.toString();
    return request<{ cat: string; vendor_count: number }[]>(`/vendors/categories${qs ? `?${qs}` : ""}`);
  },

  getVendorsByCategory: (category: string, lat?: number, lng?: number, radius?: number, minRating?: number) => {
    const params = new URLSearchParams({ category });
    if (lat != null) params.set("lat", String(lat));
    if (lng != null) params.set("lng", String(lng));
    if (radius != null) params.set("radius", String(radius));
    if (minRating != null && minRating > 0) params.set("minRating", String(minRating));
    return request<any[]>(`/vendors/by-category?${params}`);
  },

  getApprovedVendors: (lat?: number, lng?: number, radius?: number, minRating?: number) => {
    const params = new URLSearchParams();
    if (lat != null) params.set("lat", String(lat));
    if (lng != null) params.set("lng", String(lng));
    if (radius != null) params.set("radius", String(radius));
    if (minRating != null && minRating > 0) params.set("minRating", String(minRating));
    const qs = params.toString();
    return request<any[]>(`/vendors/approved${qs ? `?${qs}` : ""}`);
  },

  // Bookings
  createBooking: (data: { vendorId: string; serviceName: string; scheduledDate?: string; scheduledTime?: string; notes?: string }) =>
    request("/bookings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  payBooking: (bookingId: string) =>
    request<{ bookingId: string; paymentToken: string; otpSent: boolean }>(`/bookings/${encodeURIComponent(bookingId)}/pay`, {
      method: "POST",
    }),

  getBookings: () => request<any[]>("/bookings"),

  downloadReceipt: async (bookingId: string) => {
    const token = localStorage.getItem("customer_accessToken");
    const res = await fetch(`${API_BASE}/bookings/${bookingId}/receipt`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Failed to download receipt");
    return res.blob();
  },

  // Profile
  getProfile: () => request<{ id: string; email: string; name: string | null; phone: string | null; role: string; profilePictureUrl: string | null }>("/auth/profile"),

  updateProfile: (data: { name?: string; phone?: string; profilePictureUrl?: string }) =>
    request<{ id: string; email: string; name: string | null; phone: string | null; role: string; profilePictureUrl: string | null }>("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // File uploads
  uploadFile: async (file: File): Promise<{ url: string }> => {
    const token = localStorage.getItem("customer_accessToken");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/uploads/file`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Upload failed");
    return body.data;
  },

  uploadFiles: async (files: File[]): Promise<{ urls: string[] }> => {
    const token = localStorage.getItem("customer_accessToken");
    const formData = new FormData();
    files.forEach(f => formData.append("files", f));
    const res = await fetch(`${API_BASE}/uploads/files`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Upload failed");
    return body.data;
  },

  // Vendor detail
  getVendorDetail: (vendorId: string) =>
    request<any>(`/vendors/detail/${vendorId}`),

  // Zones
  getZones: () => request<any[]>("/zones"),

  getTopCategoriesByLocation: (lat: number, lng: number, radiusKm = 25, limit = 6) => {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radiusKm: String(radiusKm),
      limit: String(limit),
    });
    return request<{ category: string; vendorCount: number; avgRating: number; totalReviews: number; score: number }[]>(
      `/location/top-categories?${params.toString()}`
    );
  },

  // Reviews
  getVendorRating: (vendorId: string) =>
    request(`/reviews/vendor/${vendorId}/rating`),
  getPublicReviews: (limit = 3) =>
    request<{ id: string; reviewText: string; rating: number; customerName: string | null; serviceName: string | null; createdAt: string }[]>(`/reviews/public?limit=${limit}`),
  createReview: (data: { bookingId: string; rating: number; reviewText?: string }) =>
    request("/reviews", { method: "POST", body: JSON.stringify(data) }),
  getMyReviewedBookings: () =>
    request<string[]>("/reviews/my-reviewed"),
};
