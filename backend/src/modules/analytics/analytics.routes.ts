import { Router } from "express";
import { requireRole } from "../../middleware/auth.js";
import { AuthRequest } from "../../middleware/auth.js";
import { getBookingStats, getVendorBookingStats } from "../bookings/bookings.repository.js";
import { countZones } from "../zones/zones.repository.js";
import { pool } from "../../db/pool.js";

export const analyticsRouter = Router();

// Public homepage counters (no auth)
analyticsRouter.get("/public", async (_req, res, next) => {
  try {
    const [vendorsR, customersR, completedR, citiesR] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS total FROM vendor_profiles WHERE verification_status = 'approved'"),
      pool.query("SELECT COUNT(*)::int AS total FROM users WHERE role = 'customer'"),
      pool.query("SELECT COUNT(*)::int AS total FROM bookings WHERE status = 'completed'"),
      pool.query("SELECT COUNT(DISTINCT city)::int AS total FROM zones"),
    ]);

    res.json({
      success: true,
      data: {
        activeVendors: vendorsR.rows[0]?.total ?? 0,
        happyCustomers: customersR.rows[0]?.total ?? 0,
        servicesCompleted: completedR.rows[0]?.total ?? 0,
        citiesCovered: citiesR.rows[0]?.total ?? 0,
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
