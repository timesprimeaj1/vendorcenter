import { Router } from "express";
import { requireRole } from "../../middleware/auth.js";
import { AuthRequest } from "../../middleware/auth.js";
import { getBookingStats, getVendorBookingStats } from "../bookings/bookings.repository.js";
import { countZones, countActiveCities } from "../zones/zones.repository.js";
import { getVendorRating } from "../reviews/reviews.repository.js";
import { pool } from "../../db/pool.js";

export const analyticsRouter = Router();

// Public homepage counters (no auth)
analyticsRouter.get("/public", async (_req, res, next) => {
  try {
    const [vendorsR, customersR, completedR, citiesCount] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS total FROM vendor_profiles WHERE verification_status = 'approved'"),
      pool.query("SELECT COUNT(*)::int AS total FROM users WHERE role = 'customer'"),
      pool.query("SELECT COUNT(*)::int AS total FROM bookings WHERE status = 'completed'"),
      countActiveCities(),
    ]);

    res.json({
      success: true,
      data: {
        activeVendors: vendorsR.rows[0]?.total ?? 0,
        happyCustomers: customersR.rows[0]?.total ?? 0,
        servicesCompleted: completedR.rows[0]?.total ?? 0,
        citiesCovered: citiesCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get("/vendor", requireRole(["vendor"]), async (req: AuthRequest, res) => {
  const vendorId = req.actor!.id;
  const [ownBookings, vendorRating, earningsR] = await Promise.all([
    getVendorBookingStats(vendorId),
    getVendorRating(vendorId),
    pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(final_amount), 0)::text AS total FROM bookings WHERE vendor_id = $1 AND status = 'completed'`,
      [vendorId]
    ),
  ]);

  const earningsPaise = Number(earningsR.rows[0]?.total ?? 0);

  // Get vendor's top services
  const servicesR = await pool.query<{ name: string }>(
    `SELECT name FROM vendor_services WHERE vendor_id = $1 AND is_deleted = false AND availability = 'available' ORDER BY created_at DESC LIMIT 5`,
    [vendorId]
  );
  const popularServices = servicesR.rows.map(r => r.name);

  res.json({
    success: true,
    data: {
      bookings: ownBookings,
      earningsEstimate: Math.round(earningsPaise / 100),
      ratings: {
        average: parseFloat(vendorRating.averageRating) || 0,
        count: vendorRating.totalReviews || 0,
      },
      popularServices
    }
  });
});

analyticsRouter.get("/admin", requireRole(["admin"]), async (_req, res, next) => {
  try {
    const [
      bookingsByStatus,
      revenueR,
      monthlyBookingsR,
      topVendorsR,
      customerGrowthR,
      vendorGrowthR,
      activeZones,
      totalCustomersR,
      totalVendorsR,
    ] = await Promise.all([
      pool.query<{ status: string; count: number }>(
        `SELECT status, COUNT(*)::int as count FROM bookings GROUP BY status`
      ),
      pool.query<{ total: string }>(
        `SELECT COALESCE(SUM(final_amount), 0)::text as total FROM bookings WHERE payment_status = 'success'`
      ),
      pool.query<{ month: string; count: number }>(
        `SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*)::int as count
         FROM bookings WHERE created_at >= NOW() - INTERVAL '6 months'
         GROUP BY month ORDER BY month`
      ),
      pool.query<{ vendor_id: string; business_name: string; bookings: number; revenue: string }>(
        `SELECT vp.vendor_id, vp.business_name,
                COUNT(b.id)::int as bookings,
                COALESCE(SUM(b.final_amount), 0)::text as revenue
         FROM vendor_profiles vp
         LEFT JOIN bookings b ON b.vendor_id = vp.vendor_id AND b.status != 'cancelled'
         GROUP BY vp.vendor_id, vp.business_name
         ORDER BY bookings DESC LIMIT 10`
      ),
      pool.query<{ month: string; count: number }>(
        `SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*)::int as count
         FROM users WHERE role = 'customer' AND created_at >= NOW() - INTERVAL '6 months'
         GROUP BY month ORDER BY month`
      ),
      pool.query<{ month: string; count: number }>(
        `SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*)::int as count
         FROM users WHERE role = 'vendor' AND created_at >= NOW() - INTERVAL '6 months'
         GROUP BY month ORDER BY month`
      ),
      countZones(),
      pool.query<{ total: number }>("SELECT COUNT(*)::int as total FROM users WHERE role = 'customer'"),
      pool.query<{ total: number }>("SELECT COUNT(*)::int as total FROM users WHERE role = 'vendor'"),
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of bookingsByStatus.rows) statusMap[row.status] = row.count;

    res.json({
      success: true,
      data: {
        totalRevenue: Math.round(Number(revenueR.rows[0]?.total ?? 0) / 100),
        totalCustomers: totalCustomersR.rows[0]?.total ?? 0,
        totalVendors: totalVendorsR.rows[0]?.total ?? 0,
        activeZones,
        bookingsByStatus: statusMap,
        monthlyBookings: monthlyBookingsR.rows,
        topVendors: topVendorsR.rows.map(v => ({
          vendorId: v.vendor_id,
          businessName: v.business_name,
          bookings: v.bookings,
          revenue: Math.round(Number(v.revenue) / 100),
        })),
        customerGrowth: customerGrowthR.rows,
        vendorGrowth: vendorGrowthR.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});
