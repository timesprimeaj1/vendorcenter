import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VendorAuthProvider } from "./hooks/useVendorAuth";
import VendorLogin from "./pages/VendorLogin";
import VendorRegister from "./pages/VendorRegister";
import VendorForgotPassword from "./pages/VendorForgotPassword";
import VendorDashboard from "./pages/VendorDashboard";
import VendorOnboarding from "./pages/VendorOnboarding";
import VendorEditProfile from "./pages/VendorEditProfile";
import VendorBookings from "./pages/VendorBookings";
import VendorServices from "./pages/VendorServices";
import NotFound from "./pages/NotFound";
import RequireVendorOnboardingComplete from "./components/RequireVendorOnboardingComplete";

const queryClient = new QueryClient();

const VendorApp = () => (
  <QueryClientProvider client={queryClient}>
    <VendorAuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename="/vendor">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<VendorLogin />} />
            <Route path="/register" element={<VendorRegister />} />
            <Route path="/forgot-password" element={<VendorForgotPassword />} />
            <Route
              path="/dashboard"
              element={
                <RequireVendorOnboardingComplete>
                  <VendorDashboard />
                </RequireVendorOnboardingComplete>
              }
            />
            <Route path="/onboarding" element={<VendorOnboarding />} />
            <Route
              path="/edit-profile"
              element={
                <RequireVendorOnboardingComplete>
                  <VendorEditProfile />
                </RequireVendorOnboardingComplete>
              }
            />
            <Route
              path="/bookings"
              element={
                <RequireVendorOnboardingComplete>
                  <VendorBookings />
                </RequireVendorOnboardingComplete>
              }
            />
            <Route
              path="/services"
              element={
                <RequireVendorOnboardingComplete>
                  <VendorServices />
                </RequireVendorOnboardingComplete>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </VendorAuthProvider>
  </QueryClientProvider>
);

export default VendorApp;
