import { pool } from "../../db/pool.js";

export interface VendorOnboardingInput {
  vendorId: string;
  businessName: string;
  serviceCategories: string[];
  latitude: number;
  longitude: number;
  zone: string;
  serviceRadiusKm: number;
  workingHours: string;
  documentUrls: string[];
  portfolioUrls: string[];
}

export async function createVendorProfile(input: VendorOnboardingInput) {
  const result = await pool.query(
    `INSERT INTO vendor_profiles
      (vendor_id, business_name, service_categories, latitude, longitude, zone, service_radius_km, working_hours, document_urls, portfolio_urls, verification_status)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, 'approved')
     RETURNING id, vendor_id as "vendorId", business_name as "businessName", service_categories as "serviceCategories", latitude, longitude, zone, service_radius_km as "serviceRadiusKm", working_hours as "workingHours", document_urls as "documentUrls", portfolio_urls as "portfolioUrls", verification_status as "verificationStatus", created_at as "createdAt"`,
    [
      input.vendorId,
      input.businessName,
      JSON.stringify(input.serviceCategories),
      input.latitude,
      input.longitude,
      input.zone,
      input.serviceRadiusKm,
      input.workingHours,
      JSON.stringify(input.documentUrls),
      JSON.stringify(input.portfolioUrls || []),
    ]
  );

  return result.rows[0];
}

export async function listVendorProfiles() {
  const result = await pool.query(
    `SELECT id, vendor_id as "vendorId", business_name as "businessName", service_categories as "serviceCategories", latitude, longitude, zone, service_radius_km as "serviceRadiusKm", working_hours as "workingHours", document_urls as "documentUrls", verification_status as "verificationStatus", created_at as "createdAt"
     FROM vendor_profiles ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function listVendorProfilesByStatus(status: "under_review" | "approved" | "rejected") {
  const result = await pool.query(
    `SELECT id, vendor_id as "vendorId", business_name as "businessName", service_categories as "serviceCategories", latitude, longitude, zone, service_radius_km as "serviceRadiusKm", working_hours as "workingHours", document_urls as "documentUrls", verification_status as "verificationStatus", created_at as "createdAt"
     FROM vendor_profiles WHERE verification_status = $1 ORDER BY created_at DESC`,
    [status]
  );
  return result.rows;
}

// Standard categories vendors can choose during onboarding
const STANDARD_CATEGORIES = [
  "Cleaning", "Plumbing", "Electrical", "Painting",
  "Carpentry", "Pest Control", "AC Repair", "Salon",
  "Appliance Repair", "Moving", "Photography", "Catering"
];

export async function getActiveCategories() {
  // Standard category counts
  const result = await pool.query(
    `SELECT cat, COUNT(DISTINCT vendor_id)::int AS vendor_count
     FROM vendor_profiles, jsonb_array_elements_text(service_categories) AS cat
     WHERE verification_status = 'approved'
     GROUP BY cat
     ORDER BY vendor_count DESC`
  );
  const raw = result.rows as { cat: string; vendor_count: number }[];

  const standardSet = new Set(STANDARD_CATEGORIES);
  const grouped: { cat: string; vendor_count: number }[] = [];
  const hasNonStandard = raw.some((r) => !standardSet.has(r.cat));

  for (const row of raw) {
    if (standardSet.has(row.cat)) {
      grouped.push(row);
    }
  }

  // Count distinct vendors with at least one non-standard category
  if (hasNonStandard) {
    const otherResult = await pool.query(
      `SELECT COUNT(DISTINCT vp.vendor_id)::int AS vendor_count
       FROM vendor_profiles vp
       WHERE vp.verification_status = 'approved'
         AND EXISTS (
           SELECT 1 FROM jsonb_array_elements_text(vp.service_categories) AS cat
           WHERE cat NOT IN (${STANDARD_CATEGORIES.map((_, i) => `$${i + 1}`).join(", ")})
         )`,
      STANDARD_CATEGORIES
    );
    const otherCount = otherResult.rows[0]?.vendor_count ?? 0;
    if (otherCount > 0) {
      grouped.push({ cat: "Other", vendor_count: otherCount });
    }
  }
  return grouped;
}

export async function listApprovedVendors(lat?: number, lng?: number, radiusKm = 50, minRating = 0) {
  let query = `
    SELECT vp.id, vp.vendor_id AS "vendorId", vp.business_name AS "businessName",
           vp.service_categories AS "serviceCategories", vp.latitude, vp.longitude,
           vp.zone, vp.service_radius_km AS "serviceRadiusKm",
           vp.working_hours AS "workingHours",
           vp.verification_status AS "verificationStatus",
           COALESCE(vra.average_rating, 0)::float AS rating,
           COALESCE(vra.total_reviews, 0)::int AS reviews
    FROM vendor_profiles vp
    LEFT JOIN vendor_rating_aggregates vra ON vra.vendor_id = vp.vendor_id
    WHERE vp.verification_status = 'approved'`;
  const params: any[] = [];
  let paramIdx = 1;

  if (minRating > 0) {
    query += ` AND COALESCE(vra.average_rating, 0) >= $${paramIdx}`;
    params.push(minRating);
    paramIdx++;
  }

  if (lat != null && lng != null) {
    query += `
      AND (
        6371 * acos(
          cos(radians($${paramIdx})) * cos(radians(vp.latitude))
          * cos(radians(vp.longitude) - radians($${paramIdx + 1}))
          + sin(radians($${paramIdx})) * sin(radians(vp.latitude))
        )
      ) <= $${paramIdx + 2}`;
    query += `
      AND (
        6371 * acos(
          cos(radians($${paramIdx})) * cos(radians(vp.latitude))
          * cos(radians(vp.longitude) - radians($${paramIdx + 1}))
          + sin(radians($${paramIdx})) * sin(radians(vp.latitude))
        )
      ) <= vp.service_radius_km`;
    params.push(lat, lng, radiusKm);
  }

  query += ` ORDER BY rating DESC`;
  const result = await pool.query(query, params);
  return result.rows;
}

export async function getVendorsByCategory(category: string, lat?: number, lng?: number, radiusKm = 50, minRating = 0) {
  const isOther = category === "Other";
  let query = `
    SELECT vp.id, vp.vendor_id AS "vendorId", vp.business_name AS "businessName",
           vp.service_categories AS "serviceCategories", vp.latitude, vp.longitude,
           vp.zone, vp.service_radius_km AS "serviceRadiusKm",
           vp.working_hours AS "workingHours",
           vp.verification_status AS "verificationStatus",
           COALESCE(vra.average_rating, 0)::float AS rating,
           COALESCE(vra.total_reviews, 0)::int AS reviews
    FROM vendor_profiles vp
    LEFT JOIN vendor_rating_aggregates vra ON vra.vendor_id = vp.vendor_id
    WHERE vp.verification_status = 'approved'`;
  const params: any[] = [];
  let paramIdx = 1;

  if (minRating > 0) {
    query += ` AND COALESCE(vra.average_rating, 0) >= $${paramIdx}`;
    params.push(minRating);
    paramIdx++;
  }

  if (isOther) {
    // Find vendors with at least one category NOT in the standard list
    query += `
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(vp.service_categories) AS cat
        WHERE cat NOT IN (${STANDARD_CATEGORIES.map((_, i) => `$${paramIdx + i}`).join(", ")})
      )`;
    params.push(...STANDARD_CATEGORIES);
    paramIdx += STANDARD_CATEGORIES.length;
  } else {
    query += `
      AND vp.service_categories @> $${paramIdx}::jsonb`;
    params.push(JSON.stringify([category]));
    paramIdx += 1;
  }

  if (lat != null && lng != null) {
    query += `
      AND (
        6371 * acos(
          cos(radians($${paramIdx})) * cos(radians(vp.latitude))
          * cos(radians(vp.longitude) - radians($${paramIdx + 1}))
          + sin(radians($${paramIdx})) * sin(radians(vp.latitude))
        )
      ) <= $${paramIdx + 2}`;
    query += `
      AND (
        6371 * acos(
          cos(radians($${paramIdx})) * cos(radians(vp.latitude))
          * cos(radians(vp.longitude) - radians($${paramIdx + 1}))
          + sin(radians($${paramIdx})) * sin(radians(vp.latitude))
        )
      ) <= vp.service_radius_km`;
    params.push(lat, lng, radiusKm);
  }

  query += ` ORDER BY rating DESC`;
  const result = await pool.query(query, params);
  return result.rows;
}

export async function getVendorProfile(vendorId: string) {
  const result = await pool.query(
    `SELECT id, vendor_id as "vendorId", business_name as "businessName", service_categories as "serviceCategories",
            latitude, longitude, zone, service_radius_km as "serviceRadiusKm",
            working_hours as "workingHours", document_urls as "documentUrls",
            portfolio_urls as "portfolioUrls",
            verification_status as "verificationStatus",
            COALESCE(profile_edited, false) as "profileEdited",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM vendor_profiles WHERE vendor_id = $1`,
    [vendorId]
  );
  return result.rows[0] ?? null;
}

export async function updateVendorProfile(vendorId: string, input: Omit<VendorOnboardingInput, "vendorId" | "documentUrls" | "portfolioUrls">) {
  const result = await pool.query(
    `UPDATE vendor_profiles
     SET business_name = $2, service_categories = $3::jsonb,
         latitude = $4, longitude = $5, zone = $6,
         service_radius_km = $7, working_hours = $8,
         profile_edited = true, updated_at = NOW()
     WHERE vendor_id = $1 AND COALESCE(profile_edited, false) = false
     RETURNING id, vendor_id as "vendorId", business_name as "businessName",
              service_categories as "serviceCategories", latitude, longitude, zone,
              service_radius_km as "serviceRadiusKm", working_hours as "workingHours",
              document_urls as "documentUrls", verification_status as "verificationStatus",
              profile_edited as "profileEdited", created_at as "createdAt"`,
    [
      vendorId,
      input.businessName,
      JSON.stringify(input.serviceCategories),
      input.latitude,
      input.longitude,
      input.zone,
      input.serviceRadiusKm,
      input.workingHours,
    ]
  );
  return result.rows[0] ?? null;
}

export async function updateVendorPortfolioUrls(vendorId: string, portfolioUrls: string[]) {
  const result = await pool.query(
    `UPDATE vendor_profiles
     SET portfolio_urls = $2::jsonb, updated_at = NOW()
     WHERE vendor_id = $1
     RETURNING id, vendor_id as "vendorId", business_name as "businessName", service_categories as "serviceCategories", latitude, longitude, zone, service_radius_km as "serviceRadiusKm", working_hours as "workingHours", document_urls as "documentUrls", portfolio_urls as "portfolioUrls", verification_status as "verificationStatus", created_at as "createdAt"`,
    [vendorId, JSON.stringify(portfolioUrls)]
  );
  return result.rows[0] ?? null;
}

export async function updateVendorVerificationStatus(vendorId: string, status: "under_review" | "approved" | "rejected") {
  const result = await pool.query(
    `UPDATE vendor_profiles
     SET verification_status = $2, updated_at = NOW()
     WHERE vendor_id = $1
     RETURNING id, vendor_id as "vendorId", business_name as "businessName", service_categories as "serviceCategories", latitude, longitude, zone, service_radius_km as "serviceRadiusKm", working_hours as "workingHours", document_urls as "documentUrls", verification_status as "verificationStatus", created_at as "createdAt"`,
    [vendorId, status]
  );
  return result.rows[0] ?? null;
}
