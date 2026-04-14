import { pool } from "../../db/pool.js";

// ─── Weighted Ranking ────────────────────────────────────────
// Score = (rating × 20) + log2(reviews + 1) × 5 + (completedBookings × 0.5) - (distance × 0.3)

function computeRankScore(
  rating: number,
  reviews: number,
  completedBookings: number,
  distanceKm?: number
): number {
  const ratingScore = rating * 20;
  const reviewScore = Math.log2(reviews + 1) * 5;
  const bookingScore = completedBookings * 0.5;
  const distancePenalty = distanceKm != null ? distanceKm * 0.3 : 0;
  return Math.round((ratingScore + reviewScore + bookingScore - distancePenalty) * 100) / 100;
}

// ─── Core vendor data builder ────────────────────────────────

function buildVendorSelectQuery(lat?: number, lng?: number) {
  let select = `
    SELECT
      vp.vendor_id AS "vendorId",
      vp.business_name AS "businessName",
      vp.service_categories AS "serviceCategories",
      vp.latitude, vp.longitude,
      vp.zone,
      vp.working_hours AS "workingHours",
      COALESCE(vra.average_rating, 0)::float AS rating,
      COALESCE(vra.total_reviews, 0)::int AS reviews,
      COALESCE(bc.completed_count, 0)::int AS "completedBookings"`;
  const params: (string | number)[] = [];
  let idx = 1;

  if (lat != null && lng != null) {
    select += `,
      ROUND((
        6371 * acos(
          LEAST(GREATEST(
            cos(radians($${idx})) * cos(radians(vp.latitude))
            * cos(radians(vp.longitude) - radians($${idx + 1}))
            + sin(radians($${idx})) * sin(radians(vp.latitude)),
          -1), 1)
        )
      )::numeric, 1) AS distance_km`;
    params.push(lat, lng);
    idx += 2;
  }

  select += `
    FROM vendor_profiles vp
    LEFT JOIN vendor_rating_aggregates vra ON vra.vendor_id = vp.vendor_id
    LEFT JOIN (
      SELECT vendor_id, COUNT(*)::int AS completed_count
      FROM bookings WHERE status = 'completed'
      GROUP BY vendor_id
    ) bc ON bc.vendor_id = vp.vendor_id
    WHERE vp.verification_status = 'approved'`;

  return { select, params, idx };
}

function addGeoFilter(query: string, idx: number, params: (string | number)[], lat: number, lng: number, radiusKm: number) {
  query += `
    AND (
      6371 * acos(
        LEAST(GREATEST(
          cos(radians($${idx})) * cos(radians(vp.latitude))
          * cos(radians(vp.longitude) - radians($${idx + 1}))
          + sin(radians($${idx})) * sin(radians(vp.latitude)),
        -1), 1)
      )
    ) <= $${idx + 2}
    AND (
      6371 * acos(
        LEAST(GREATEST(
          cos(radians($${idx})) * cos(radians(vp.latitude))
          * cos(radians(vp.longitude) - radians($${idx + 1}))
          + sin(radians($${idx})) * sin(radians(vp.latitude)),
        -1), 1)
      )
    ) <= vp.service_radius_km`;
  params.push(lat, lng, radiusKm);
  return { query, idx: idx + 3 };
}

function rankVendors(rows: any[]): any[] {
  return rows
    .map((r) => ({
      ...r,
      rankScore: computeRankScore(r.rating, r.reviews, r.completedBookings, r.distance_km),
    }))
    .sort((a, b) => b.rankScore - a.rankScore);
}

// ─── Public API ──────────────────────────────────────────────

export async function searchVendorsByCategory(
  category: string,
  lat?: number,
  lng?: number,
  radiusKm = 50,
  limit = 5
) {
  let { select: query, params, idx } = buildVendorSelectQuery(lat, lng);

  query += `
    AND vp.service_categories @> $${idx}::jsonb`;
  params.push(JSON.stringify([category]));
  idx++;

  if (lat != null && lng != null) {
    const geo = addGeoFilter(query, idx, params, lat, lng, radiusKm);
    query = geo.query;
    idx = geo.idx;
  }

  query += ` ORDER BY rating DESC, reviews DESC LIMIT $${idx}`;
  params.push(limit);

  const result = await pool.query(query, params);
  return rankVendors(result.rows);
}

export async function searchVendorsByKeyword(
  keyword: string,
  lat?: number,
  lng?: number,
  radiusKm = 50,
  limit = 5
) {
  const pattern = `%${keyword}%`;
  let { select: query, params, idx } = buildVendorSelectQuery(lat, lng);

  query += `
    AND (
      LOWER(vp.business_name) LIKE LOWER($${idx})
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(vp.service_categories) AS cat
        WHERE LOWER(cat) LIKE LOWER($${idx})
      )
      OR EXISTS (
        SELECT 1 FROM vendor_services vs
        WHERE vs.vendor_id = vp.vendor_id
          AND vs.is_deleted = false
          AND LOWER(vs.name) LIKE LOWER($${idx})
      )
    )`;
  params.push(pattern);
  idx++;

  if (lat != null && lng != null) {
    const geo = addGeoFilter(query, idx, params, lat, lng, radiusKm);
    query = geo.query;
    idx = geo.idx;
  }

  query += ` ORDER BY rating DESC, reviews DESC LIMIT $${idx}`;
  params.push(limit);

  const result = await pool.query(query, params);
  return rankVendors(result.rows);
}

export async function getTopRatedVendors(
  lat?: number,
  lng?: number,
  radiusKm = 50,
  limit = 5
) {
  let { select: query, params, idx } = buildVendorSelectQuery(lat, lng);

  query += ` AND COALESCE(vra.average_rating, 0) > 0`;

  if (lat != null && lng != null) {
    const geo = addGeoFilter(query, idx, params, lat, lng, radiusKm);
    query = geo.query;
    idx = geo.idx;
  }

  query += ` ORDER BY rating DESC, reviews DESC LIMIT $${idx}`;
  params.push(limit);

  const result = await pool.query(query, params);
  return rankVendors(result.rows);
}

export async function getVendorDetailForAI(vendorId: string) {
  const profileResult = await pool.query(
    `SELECT
      vp.vendor_id AS "vendorId",
      vp.business_name AS "businessName",
      vp.service_categories AS "serviceCategories",
      vp.zone,
      vp.working_hours AS "workingHours",
      vp.verification_status AS "verificationStatus",
      COALESCE(vra.average_rating, 0)::float AS rating,
      COALESCE(vra.total_reviews, 0)::int AS reviews
    FROM vendor_profiles vp
    LEFT JOIN vendor_rating_aggregates vra ON vra.vendor_id = vp.vendor_id
    WHERE vp.vendor_id = $1`,
    [vendorId]
  );

  if (profileResult.rows.length === 0) return null;

  const servicesResult = await pool.query(
    `SELECT name, price::float, availability
     FROM vendor_services
     WHERE vendor_id = $1 AND is_deleted = false AND deleted_at IS NULL
     ORDER BY price ASC`,
    [vendorId]
  );

  return { ...profileResult.rows[0], services: servicesResult.rows };
}

export async function getServiceCategories(lat?: number, lng?: number, radiusKm = 25) {
  if (lat != null && lng != null) {
    const result = await pool.query(
      `SELECT cat, COUNT(DISTINCT vp.vendor_id)::int AS vendor_count
       FROM vendor_profiles vp,
            jsonb_array_elements_text(vp.service_categories) AS cat
       WHERE vp.verification_status = 'approved'
         AND (
           6371 * acos(
             LEAST(GREATEST(
               cos(radians($1)) * cos(radians(vp.latitude))
               * cos(radians(vp.longitude) - radians($2))
               + sin(radians($1)) * sin(radians(vp.latitude)),
             -1), 1)
           )
         ) <= $3
       GROUP BY cat ORDER BY vendor_count DESC`,
      [lat, lng, radiusKm]
    );
    return result.rows;
  }

  const result = await pool.query(
    `SELECT cat, COUNT(DISTINCT vendor_id)::int AS vendor_count
     FROM vendor_profiles, jsonb_array_elements_text(service_categories) AS cat
     WHERE verification_status = 'approved'
     GROUP BY cat ORDER BY vendor_count DESC`
  );
  return result.rows;
}

export async function getVendorServicePriceRange(vendorId: string): Promise<string> {
  const result = await pool.query(
    `SELECT MIN(price)::int AS min_price, MAX(price)::int AS max_price
     FROM vendor_services
     WHERE vendor_id = $1 AND is_deleted = false AND deleted_at IS NULL`,
    [vendorId]
  );
  const row = result.rows[0];
  if (!row || row.min_price == null) return "Contact for pricing";
  if (row.min_price === row.max_price) return `₹${row.min_price}`;
  return `₹${row.min_price} – ₹${row.max_price}`;
}

export async function getPlatformStats() {
  const vendors = await pool.query(
    `SELECT COUNT(*)::int AS count FROM vendor_profiles WHERE verification_status = 'approved'`
  );
  const bookings = await pool.query(
    `SELECT COUNT(*)::int AS count FROM bookings WHERE status = 'completed'`
  );
  const categories = await pool.query(
    `SELECT COUNT(DISTINCT cat)::int AS count
     FROM vendor_profiles, jsonb_array_elements_text(service_categories) AS cat
     WHERE verification_status = 'approved'`
  );
  return {
    activeVendors: vendors.rows[0]?.count ?? 0,
    completedBookings: bookings.rows[0]?.count ?? 0,
    serviceCategories: categories.rows[0]?.count ?? 0,
  };
}

// ─── User-Aware Queries (for authenticated chat) ─────────────

export async function getCustomerBookingsForAI(customerId: string, limit = 10) {
  const result = await pool.query(
    `SELECT
       b.id,
       b.service_name AS "serviceName",
       b.status,
       b.payment_status AS "paymentStatus",
       b.scheduled_date AS "scheduledDate",
       b.scheduled_time AS "scheduledTime",
       b.final_amount AS "finalAmount",
       b.notes,
       b.created_at AS "createdAt",
       b.work_started_at AS "workStartedAt",
       b.completion_requested_at AS "completionRequestedAt",
       vp.business_name AS "vendorName"
     FROM bookings b
     LEFT JOIN vendor_profiles vp ON vp.vendor_id = b.vendor_id
     WHERE b.customer_id = $1
     ORDER BY b.created_at DESC
     LIMIT $2`,
    [customerId, limit]
  );
  return result.rows;
}

export async function getCustomerProfileForAI(customerId: string) {
  const result = await pool.query(
    `SELECT id, email, name, phone, created_at AS "createdAt"
     FROM users WHERE id = $1`,
    [customerId]
  );
  return result.rows[0] ?? null;
}
