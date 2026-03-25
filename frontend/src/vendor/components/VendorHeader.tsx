import { Link, useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth } from "@/vendor/hooks/useVendorAuth";

interface VendorHeaderProps {
  showProfile?: boolean;
  profilePicUrl?: string | null;
}

const VendorHeader = ({ showProfile = false, profilePicUrl }: VendorHeaderProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("vendor");

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
            <span translate="no" className="notranslate text-white font-bold text-sm">V</span>
          </div>
          <span translate="no" className="notranslate font-bold text-lg hidden sm:block">
            Vendor<span className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">Portal</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {user?.email && (
            <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
          )}
          {user && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              {user.verified ? t("common.verified", { defaultValue: "Verified" }) : t("common.pendingVerification", { defaultValue: "Pending Verification" })}
            </span>
          )}
          <LanguageSwitcher compact />
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-1.5" />
            {t("common.logout", { defaultValue: "Logout" })}
          </Button>
          {showProfile && (
            <button
              onClick={() => navigate("/edit-profile")}
              className="w-9 h-9 rounded-full overflow-hidden border-2 border-orange-300 flex items-center justify-center bg-muted hover:ring-2 hover:ring-orange-400 transition"
            >
              {profilePicUrl ? (
                <img src={profilePicUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default VendorHeader;
