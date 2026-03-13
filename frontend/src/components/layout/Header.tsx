import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation as useRouterLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Compass, Menu, X, ChevronDown, User, LogOut, ClipboardList, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "@/hooks/useLocation";
import { api } from "@/lib/api";
import LocationPicker from "@/components/LocationPicker";
import { useQuery } from "@tanstack/react-query";

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [topCategoriesOpen, setTopCategoriesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const topCategoriesRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const isServicesPage = routerLocation.pathname === "/services";
  const { user, logout } = useAuth();
  const { cityName, location, loading: locationLoading } = useLocation();

  // Fetch profile pic for logged-in users
  const { data: headerProfile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await api.getProfile();
      return res.data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const avatarUrl = headerProfile?.profilePictureUrl
    ? (headerProfile.profilePictureUrl.startsWith("http") || headerProfile.profilePictureUrl.startsWith("/api/")
        ? headerProfile.profilePictureUrl
        : `/api/uploads/files/${headerProfile.profilePictureUrl}`)
    : null;

  // Fetch live categories from vendor data
  const [navCategories, setNavCategories] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;

    const load = async () => {
      // Prefer location-aware top categories (Amazon-like personalization).
      if (location?.latitude && location?.longitude) {
        try {
          const topRes = await api.getTopCategoriesByLocation(location.latitude, location.longitude, 25, 6);
          if (alive && topRes.data && topRes.data.length > 0) {
            setNavCategories(topRes.data.map((row) => row.category));
            return;
          }
        } catch {
          // Fallback to global categories below.
        }
      }

      try {
        const res = await api.getCategories();
        if (alive && res.data && res.data.length > 0) {
          // Don't show "Other" in the top nav — it's a catch-all for the services page.
          setNavCategories(res.data.filter((c) => c.cat !== "Other").map((c) => c.cat).slice(0, 6));
        }
      } catch {
        if (alive) setNavCategories([]);
      }
    };

    void load();
    return () => { alive = false; };
  }, [location?.latitude, location?.longitude]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (topCategoriesRef.current && !topCategoriesRef.current.contains(e.target as Node)) {
        setTopCategoriesOpen(false);
      }
    };
    if (profileDropdownOpen || topCategoriesOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileDropdownOpen, topCategoriesOpen]);

  return (
    <header className="sticky top-0 z-50 glass">
      {/* Top bar */}
      <div className="border-b border-border/50">
        <div className="container flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-lg gradient-bg flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-lg">V</span>
            </div>
            <span className="font-display font-bold text-xl hidden sm:block">
              Vendor<span className="gradient-text">Center</span>
            </span>
          </Link>

          {/* Location selector */}
          <button
            onClick={() => setLocationPickerOpen(true)}
            className="hidden md:flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg hover:bg-secondary transition-colors shrink-0"
          >
            <MapPin className="w-4 h-4 text-primary" />
            <span className="font-medium">{locationLoading ? "Detecting..." : cityName || "Set location"}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>

          {/* Explore button */}
          <div className="flex-1 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl font-medium gap-2 px-5"
              onClick={() => navigate("/explore")}
            >
              <Compass className="w-4 h-4 text-primary" />
              Explore
            </Button>
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-sm font-medium"
              onClick={() => { window.location.href = "/vendor/register"; }}
            >
              Become a Vendor
            </Button>
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="w-9 h-9 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-primary" />
                  )}
                </button>
                {profileDropdownOpen && (
                  <div className="absolute right-0 top-12 w-52 bg-card rounded-xl border border-border shadow-lg py-2 z-50">
                    <button
                      onClick={() => { navigate("/account"); setProfileDropdownOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary transition-colors flex items-center gap-3"
                    >
                      <User className="w-4 h-4 text-muted-foreground" />
                      Profile
                    </button>
                    <button
                      onClick={() => { navigate("/account?tab=bookings"); setProfileDropdownOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary transition-colors flex items-center gap-3"
                    >
                      <ClipboardList className="w-4 h-4 text-muted-foreground" />
                      Bookings
                    </button>
                    <button
                      onClick={() => { navigate("/account?tab=settings"); setProfileDropdownOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary transition-colors flex items-center gap-3"
                    >
                      <Settings className="w-4 h-4 text-muted-foreground" />
                      Settings
                    </button>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => { handleLogout(); setProfileDropdownOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-secondary transition-colors flex items-center gap-3"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Button
                size="sm"
                className="gradient-bg text-primary-foreground border-0 rounded-xl font-medium"
                onClick={() => navigate("/login")}
              >
                <User className="w-4 h-4 mr-1.5" />
                Login
              </Button>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Category nav — hidden on /services page which has its own filter */}
      {!isServicesPage && <div className="hidden md:block border-b border-border/30">
        <div className="container">
          <nav className="flex items-center gap-6 h-10 overflow-visible">
            <Link
              to="/services"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
            >
              All Services
            </Link>
            <div className="relative" ref={topCategoriesRef}>
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-wide text-primary/80 hover:text-primary transition-colors whitespace-nowrap flex items-center gap-1"
                title="Top categories near your selected location"
                onClick={() => setTopCategoriesOpen((prev) => !prev)}
              >
                Top Categories
                <ChevronDown className={`w-3 h-3 transition-transform ${topCategoriesOpen ? "rotate-180" : ""}`} />
              </button>

              {topCategoriesOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-card border border-border rounded-xl shadow-lg py-2 z-50">
                  {navCategories.length > 0 ? (
                    navCategories.map((cat) => (
                      <Link
                        key={cat}
                        to={`/services?category=${encodeURIComponent(cat)}`}
                        className="block px-4 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
                        onClick={() => setTopCategoriesOpen(false)}
                      >
                        {cat}
                      </Link>
                    ))
                  ) : (
                    <p className="px-4 py-2 text-sm text-muted-foreground">Top categories are not available for this location right now. Please try nearby locations.</p>
                  )}
                </div>
              )}
            </div>
          </nav>
        </div>
      </div>}

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden overflow-hidden border-b border-border"
          >
            <div className="container py-4 flex flex-col gap-3">
              <button
                onClick={() => { setLocationPickerOpen(true); setMobileMenuOpen(false); }}
                className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors"
              >
                <MapPin className="w-4 h-4 text-primary" />
                <span>{locationLoading ? "Detecting..." : cityName || "Set location"}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>
              <div className="flex flex-wrap gap-2">
                {navCategories.slice(0, 5).map((cat) => (
                  <Link
                    key={cat}
                    to={`/services?category=${encodeURIComponent(cat)}`}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {cat}
                  </Link>
                ))}
              </div>
              <div className="flex flex-col gap-1 pt-2">
                <Button variant="outline" size="sm" className="rounded-xl justify-start" onClick={() => { window.location.href = "/vendor/register"; setMobileMenuOpen(false); }}>
                  Become a Vendor
                </Button>
                {user ? (
                  <>
                    <Button size="sm" variant="ghost" className="rounded-xl justify-start" onClick={() => { navigate("/account"); setMobileMenuOpen(false); }}>
                      <User className="w-4 h-4 mr-1.5" />
                      Profile
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-xl justify-start" onClick={() => { navigate("/account?tab=bookings"); setMobileMenuOpen(false); }}>
                      <ClipboardList className="w-4 h-4 mr-1.5" />
                      Bookings
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl justify-start text-destructive" onClick={() => { handleLogout(); setMobileMenuOpen(false); }}>
                      <LogOut className="w-4 h-4 mr-1.5" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <Button size="sm" className="flex-1 gradient-bg text-primary-foreground border-0 rounded-xl" onClick={() => { navigate("/login"); setMobileMenuOpen(false); }}>
                    <User className="w-4 h-4 mr-1.5" />
                    Login
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location picker panel */}
      <LocationPicker open={locationPickerOpen} onClose={() => setLocationPickerOpen(false)} />
    </header>
  );
};

export default Header;
