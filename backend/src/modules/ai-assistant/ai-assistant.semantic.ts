import { pool } from "../../db/pool.js";
import { generateEmbedding } from "../../services/embeddingService.js";
import type { Intent, VendorResult } from "./ai-assistant.types.js";

// ═══════════════════════════════════════════════════════════════
// Semantic Search — pgvector-powered intent/category/FAQ matching
// Resolves queries without any LLM call when confidence is high
// ═══════════════════════════════════════════════════════════════

const CATEGORY_THRESHOLD = 0.75;
const FAQ_THRESHOLD = 0.80;

interface CategoryMatch {
  category: string;
  similarity: number;
}

interface FaqMatch {
  question: string;
  answer: string;
  similarity: number;
}

/**
 * Find the closest service category using vector similarity.
 * Returns null if no category matches above the threshold.
 */
export async function semanticCategoryMatch(query: string): Promise<CategoryMatch | null> {
  try {
    const embedding = await generateEmbedding(query);
    const vectorStr = `[${embedding.join(",")}]`;

    const result = await pool.query(
      `SELECT category, 1 - (embedding <=> $1::vector) AS similarity
       FROM service_category_embeddings
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT 1`,
      [vectorStr],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const similarity = Number(row.similarity);
    if (similarity < CATEGORY_THRESHOLD) return null;

    return { category: row.category, similarity };
  } catch (err) {
    console.warn("[semantic] Category match failed:", (err as Error).message);
    return null;
  }
}

/**
 * Find the closest FAQ answer using vector similarity.
 */
export async function semanticFaqMatch(query: string, lang?: string): Promise<FaqMatch | null> {
  try {
    const embedding = await generateEmbedding(query);
    const vectorStr = `[${embedding.join(",")}]`;

    const langFilter = lang ? `AND lang = $2` : "";
    const params: (string | number)[] = [vectorStr];
    if (lang) params.push(lang);

    const result = await pool.query(
      `SELECT question, answer, 1 - (embedding <=> $1::vector) AS similarity
       FROM faq_embeddings
       WHERE embedding IS NOT NULL ${langFilter}
       ORDER BY embedding <=> $1::vector
       LIMIT 1`,
      params,
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const similarity = Number(row.similarity);
    if (similarity < FAQ_THRESHOLD) return null;

    return { question: row.question, answer: row.answer, similarity };
  } catch (err) {
    console.warn("[semantic] FAQ match failed:", (err as Error).message);
    return null;
  }
}

/**
 * Search vendors using vector similarity combined with geo-distance filtering.
 * Falls back gracefully if no vendor embeddings exist.
 */
export async function semanticVendorSearch(
  query: string,
  lat?: number,
  lng?: number,
  radiusKm = 50,
  limit = 5,
): Promise<VendorResult[]> {
  try {
    const embedding = await generateEmbedding(query);
    const vectorStr = `[${embedding.join(",")}]`;

    const hasLocation = lat != null && lng != null;

    // Build query with optional geo filter
    const sql = hasLocation
      ? `SELECT
           vp.vendor_id AS "vendorId",
           vp.business_name AS "businessName",
           vp.service_categories AS "serviceCategories",
           vp.working_hours AS "workingHours",
           COALESCE(vra.average_rating, 0) AS rating,
           COALESCE(vra.total_reviews, 0) AS reviews,
           1 - (vp.embedding <=> $1::vector) AS similarity,
           ROUND((6371 * acos(
             LEAST(1, GREATEST(-1,
               cos(radians($2)) * cos(radians(vp.latitude)) *
               cos(radians(vp.longitude) - radians($3)) +
               sin(radians($2)) * sin(radians(vp.latitude))
             ))
           ))::numeric, 1) AS distance_km
         FROM vendor_profiles vp
         LEFT JOIN vendor_rating_aggregates vra ON vra.vendor_id = vp.vendor_id
         WHERE vp.embedding IS NOT NULL
           AND vp.verification_status = 'approved'
           AND (6371 * acos(
             LEAST(1, GREATEST(-1,
               cos(radians($2)) * cos(radians(vp.latitude)) *
               cos(radians(vp.longitude) - radians($3)) +
               sin(radians($2)) * sin(radians(vp.latitude))
             ))
           )) <= $4
         ORDER BY (vp.embedding <=> $1::vector) ASC
         LIMIT $5`
      : `SELECT
           vp.vendor_id AS "vendorId",
           vp.business_name AS "businessName",
           vp.service_categories AS "serviceCategories",
           vp.working_hours AS "workingHours",
           COALESCE(vra.average_rating, 0) AS rating,
           COALESCE(vra.total_reviews, 0) AS reviews,
           1 - (vp.embedding <=> $1::vector) AS similarity,
           NULL AS distance_km
         FROM vendor_profiles vp
         LEFT JOIN vendor_rating_aggregates vra ON vra.vendor_id = vp.vendor_id
         WHERE vp.embedding IS NOT NULL
           AND vp.verification_status = 'approved'
         ORDER BY (vp.embedding <=> $1::vector) ASC
         LIMIT $2`;

    const params = hasLocation
      ? [vectorStr, lat, lng, radiusKm, limit]
      : [vectorStr, limit];

    const result = await pool.query(sql, params);

    return result.rows.map((row: any) => ({
      name: row.businessName,
      vendorId: row.vendorId,
      rating: Number(row.rating) > 0
        ? `${Number(row.rating).toFixed(1)} / 5 (${row.reviews} reviews)`
        : "New vendor",
      distance: row.distance_km != null ? `${row.distance_km} km away` : "Distance unavailable",
      price_range: "",
      availability: row.workingHours || "Contact vendor",
      categories: Array.isArray(row.serviceCategories) ? row.serviceCategories : [],
      completedBookings: 0,
      rankScore: Number(row.similarity) || 0,
    }));
  } catch (err) {
    console.warn("[semantic] Vendor search failed:", (err as Error).message);
    return [];
  }
}

/**
 * Attempt to resolve a user query entirely via embeddings (no LLM needed).
 * Returns null if confidence is too low — caller should fall through to LLM.
 */
export async function trySemanticResolution(
  query: string,
  lang?: string,
): Promise<{
  resolved: true;
  intent: Intent;
  service: string;
  message: string;
  confidence: number;
} | null> {
  // Try FAQ match first (highest precision needed)
  const faq = await semanticFaqMatch(query, lang);
  if (faq) {
    return {
      resolved: true,
      intent: "FAQ",
      service: "",
      message: faq.answer,
      confidence: faq.similarity,
    };
  }

  // Try category match
  const category = await semanticCategoryMatch(query);
  if (category) {
    const isMr = lang === "mr";
    return {
      resolved: true,
      intent: "SERVICE_SEARCH",
      service: category.category,
      message: isMr
        ? `तुमच्या जवळचे सर्वोत्तम ${category.category.toLowerCase()} विक्रेते शोधतो! 🔍`
        : `Let me find the best ${category.category.toLowerCase()} pros near you! 🔍`,
      confidence: category.similarity,
    };
  }

  return null;
}
