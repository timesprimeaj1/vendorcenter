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
  const token = localStorage.getItem("vendor_accessToken");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && localStorage.getItem("vendor_refreshToken")) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${localStorage.getItem("vendor_accessToken")}`;
        const retry = await fetch(`${API_BASE}${path}`, { ...options, headers });
        return retry.json().catch(() => ({}));
      }
    }
    const errorMsg = typeof body.error === "string" ? body.error : `Request failed (${res.status})`;
    throw new Error(errorMsg);
  }
  return body;
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem("vendor_refreshToken");
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      localStorage.removeItem("vendor_accessToken");
      localStorage.removeItem("vendor_refreshToken");
      localStorage.removeItem("vendor_user");
      localStorage.removeItem("vendor_onboarding_status");
      return false;
    }
    const body = await res.json();
    localStorage.setItem("vendor_accessToken", body.data.accessToken);
    localStorage.setItem("vendor_refreshToken", body.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export interface LoginPayload {
  email: string;
  password: string;
  role?: "customer" | "vendor" | "admin";
}

export interface SignupPayload {
  email: string;
  password: string;
  role: "vendor";
  name?: string;
  phone?: string;
  businessName?: string;
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

export const vendorApi = {
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
    const refreshToken = localStorage.getItem("vendor_refreshToken");
    return request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  },

  requestOtp: (email: string, purpose: string) =>
    request<{ otpId: string; expiresInMinutes: number }>("/otp/request", {
      method: "POST",
      body: JSON.stringify({ email, purpose }),
    }),

  verifyOtp: (otpId: string, code: string, purpose: string) =>
    request<{ verified: boolean; accessToken?: string; refreshToken?: string; actor?: Actor }>("/otp/verify", {
      method: "POST",
      body: JSON.stringify({ otpId, code, purpose }),
    }),

  phoneLogin: (idToken: string) =>
    request<AuthResult & { actor: Actor & { roles?: string[] } }>("/auth/phone-login", {
      method: "POST",
      body: JSON.stringify({ idToken, role: "vendor" }),
    }),

  checkPhoneOtpGate: (phone: string) =>
    request<{ allowed: boolean }>("/auth/phone-otp-gate", {
      method: "POST",
      body: JSON.stringify({ phone, role: "vendor" }),
    }),

  resetPassword: (payload: { email: string; otpId: string; code: string; newPassword: string }) =>
    request<{ reset: boolean }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  submitOnboarding: (payload: {
    businessName: string;
    serviceCategories: string[];
    latitude: number;
    longitude: number;
    zone: string;
    serviceRadiusKm: number;
    workingHours: string;
    documentUrls?: string[];
    portfolioUrls?: string[];
  }) =>
    request("/vendors/onboarding", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getVendorProfile: () => request<any>("/vendors/me"),

  updateVendorProfile: (payload: {
    businessName: string;
    serviceCategories: string[];
    latitude: number;
    longitude: number;
    zone: string;
    serviceRadiusKm: number;
    workingHours: string;
  }) =>
    request<any>("/vendors/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  updateVendorPortfolio: (portfolioUrls: string[]) =>
    request<any>("/vendors/me/portfolio", {
      method: "PATCH",
      body: JSON.stringify({ portfolioUrls }),
    }),

  getProfile: () => request<any>("/auth/profile"),

  updateProfile: (data: { name?: string; phone?: string; profilePictureUrl?: string }) =>
    request<any>("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getBookings: () => request<any[]>("/bookings"),

  getVendorServices: () => request<any[]>("/services/mine"),

  getDeletedVendorServices: () => request<any[]>("/services/mine/deleted"),

  getServiceHistory: (serviceId: string) => request<any[]>(`/services/${encodeURIComponent(serviceId)}/history`),

  createService: (payload: { name: string; price: number; availability: string }) =>
    request("/services", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  scheduleServicePriceUpdate: (serviceId: string, payload: { newPrice: number; effectiveInDays: 1 | 2 }) =>
    request(`/services/${encodeURIComponent(serviceId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteService: (serviceId: string, reason?: string) =>
    request(`/services/${encodeURIComponent(serviceId)}`, {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    }),

  updateBookingStatus: (bookingId: string, status: string) =>
    request("/bookings/" + encodeURIComponent(bookingId) + "/status", {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  rejectBooking: (bookingId: string, reason: string) =>
    request("/bookings/" + encodeURIComponent(bookingId) + "/reject", {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  updateBookingFinalAmount: (bookingId: string, amount: number) =>
    request("/bookings/" + encodeURIComponent(bookingId) + "/final-amount", {
      method: "PATCH",
      body: JSON.stringify({ amount }),
    }),

  requestCompletion: (bookingId: string) =>
    request<{ message: string; bookingId: string }>("/bookings/" + encodeURIComponent(bookingId) + "/complete", {
      method: "POST",
    }),

  verifyCompletion: (bookingId: string, code: string) =>
    request<any>("/bookings/" + encodeURIComponent(bookingId) + "/verify-completion", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  uploadFile: async (file: File): Promise<{ url: string }> => {
    const token = localStorage.getItem("vendor_accessToken");
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
    const token = localStorage.getItem("vendor_accessToken");
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
};
