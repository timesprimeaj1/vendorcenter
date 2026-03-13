type VendorProfileLike = {
  businessName?: string;
  serviceCategories?: unknown;
  latitude?: number | string | null;
  longitude?: number | string | null;
  zone?: string;
  serviceRadiusKm?: number | string | null;
  workingHours?: string;
};

export function isVendorProfileComplete(profile: VendorProfileLike | null | undefined): boolean {
  if (!profile) return false;

  const categories = Array.isArray(profile.serviceCategories) ? profile.serviceCategories : [];
  const lat = Number(profile.latitude ?? 0);
  const lng = Number(profile.longitude ?? 0);
  const radius = Number(profile.serviceRadiusKm ?? 0);

  return (
    typeof profile.businessName === "string" &&
    profile.businessName.trim().length >= 2 &&
    categories.length > 0 &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0) &&
    typeof profile.zone === "string" &&
    profile.zone.trim().length >= 2 &&
    Number.isFinite(radius) &&
    radius > 0 &&
    typeof profile.workingHours === "string" &&
    profile.workingHours.trim().length >= 3
  );
}
