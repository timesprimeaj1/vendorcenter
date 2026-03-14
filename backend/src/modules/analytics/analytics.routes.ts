import { Router } from "express";
import { requireRole } from "../../middleware/auth.js";
import { AuthRequest } from "../../middleware/auth.js";
import { getBookingStats, getVendorBookingStats } from "../bookings/bookings.repository.js";
import { countZones } from "../zones/zones.repository.js";
import { pool } from "../../db/pool.js";

export const analyticsRouter = Router();

function normalizeCityFromZone(zone: string): string {
  const parts = zone.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return "";

  const cleaned = parts.filter((part) => {
    const lower = part.toLowerCase();
    if (lower === "india") return false;
    if (lower.includes("district") || lower.includes("state")) return false;
    if (/^\d+$/.test(part)) return false;
    return true;
  });

  if (cleaned.length === 0) return "";

  // Our zone format is usually: locality, city, state.
  // Prefer the city token (second meaningful token) when available.
  if (cleaned.length >= 2) return cleaned[1];
  return cleaned[0];
}

// Public homepage counters (no auth)
analyticsRouter.get("/public", async (_req, res, next) => {
  try {
    const [vendorsR, customersR, completedR, vendorZonesR] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS total FROM vendor_profiles WHERE verification_status = 'approved'"),
      pool.query("SELECT COUNT(*)::int AS total FROM users WHERE role = 'customer'"),
      pool.query("SELECT COUNT(*)::int AS total FROM bookings WHERE status = 'completed'"),
      pool.query<{ zone: string }>("SELECT zone FROM vendor_profiles WHERE verification_status = 'approved' AND zone IS NOT NULL"),
    ]);

    const coveredCities = new Set<string>();
    for (const row of vendorZonesR.rows) {
      const city = normalizeCityFromZone(row.zone || "");
      if (city) coveredCities.add(city.toLowerCase());
    }

    res.json({
      success: true,
      data: {
        activeVendors: vendorsR.rows[0]?.total ?? 0,
        happyCustomers: customersR.rows[0]?.total ?? 0,
        servicesCompleted: completedR.rows[0]?.total ?? 0,
        citiesCovered: coveredCities.size,
      },
    });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get("/vendor", requireRole(["vendor"]), async (req: AuthRequest, res) => {
  const ownBookings = await getVendorBookingStats(req.actor!.id);
  res.json({
    success: true,
    data: {
      bookings: ownBookings,
      earningsEstimate: ownBookings * 1000,
      ratings: { average: 4.6, count: 24 },
      popularServices: ["Home Cleaning", "Appliance Repair"]
    }
  });
});

analyticsRouter.get("/admin", requireRole(["admin"]), async (_req, res) => {
  const totalBookings = await getBookingStats();
  const activeZones = await countZones();
  res.json({
    success: true,
    data: {
      platformRevenueEstimate: totalBookings * 100,
      topVendors: [],
      activeZones,
      bookingTrends: {
        today: totalBookings,
        weekly: totalBookings
      }
    }
  });
});
