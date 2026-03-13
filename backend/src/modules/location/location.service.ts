import { pool } from "../../db/pool.js";

export interface NearbyVendor {
  vendorId: string;
  businessName: string;
  zone: string;
  latitude: number;
  longitude: number;
  serviceRadiusKm: number;
  serviceCategories: string[];
  distanceKm: number;
  averageRating: number;
  totalReviews: number;
}

/**
 * Find vendors near a point using bounding-box pre-filter + Haversine.
 * Joins vendor_rating_aggregates for rating data.
 * Ready for PostGIS upgrade: replace the distance calculation with ST_DWithin.
 */
export async function findNearbyVendors(
  lat: number,
  lng: number,
  radiusKm: number,
  limit = 100
): Promise<NearbyVendor[]> {
  // Bounding box pre-filter for performance
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));

  const result = await pool.query<NearbyVendor>(
    `SELECT * FROM (
      SELECT
        vp.vendor_id AS "vendorId",
        vp.business_name AS "businessName",
        vp.zone,
        vp.latitude,
        vp.longitude,
        vp.service_radius_km AS "serviceRadiusKm",
        vp.service_categories AS "serviceCategories",
        COALESCE(vra.average_rating, 0)::float AS "averageRating",
        COALESCE(vra.total_reviews, 0)::int AS "totalReviews",
        (6371 * acos(
          LEAST(1, cos(radians($1)) * cos(radians(vp.latitude)) * cos(radians(vp.longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(vp.latitude)))
        )) AS "distanceKm"
      FROM vendor_profiles vp
      LEFT JOIN vendor_rating_aggregates vra ON vra.vendor_id = vp.vendor_id
      WHERE vp.verification_status = 'approved'
        AND vp.latitude BETWEEN $3 AND $4
        AND vp.longitude BETWEEN $5 AND $6
    ) t
    WHERE t."distanceKm" <= $7
      AND t."distanceKm" <= t."serviceRadiusKm"
    ORDER BY t."distanceKm" ASC
    LIMIT $8`,
    [lat, lng, lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta, radiusKm, limit]
  );
  return result.rows;
}

export interface ZoneWithPolygon {
  id: string;
  country: string;
  state: string;
  city: string;
  zone: string;
  polygonCoordinates: [number, number][] | null;
  active: boolean;
}

/**
 * Get all zones with polygon data for map rendering.
 */
export async function getZonesWithPolygons(): Promise<ZoneWithPolygon[]> {
  const result = await pool.query<ZoneWithPolygon>(
    `SELECT
      id, country, state, city, zone,
      polygon_coordinates AS "polygonCoordinates",
      active
    FROM zones
    ORDER BY active DESC, city ASC`
  );
  return result.rows;
}

/**
 * Update a zone's polygon coordinates (admin only).
 */
export async function updateZonePolygon(
  zoneId: string,
  polygonCoordinates: [number, number][],
  active?: boolean
) {
  const params: any[] = [JSON.stringify(polygonCoordinates), zoneId];
  let sql = `UPDATE zones SET polygon_coordinates = $1`;
  if (active !== undefined) {
    sql += `, active = $3`;
    params.push(active);
  }
  sql += ` WHERE id = $2 RETURNING id`;
  const result = await pool.query(sql, params);
  return result.rowCount! > 0;
}

/**
 * Find which zone(s) contain a given point.
 * Uses server-side ray-casting. Ready for PostGIS ST_Contains upgrade.
 */
export async function findZonesContainingPoint(lat: number, lng: number): Promise<ZoneWithPolygon[]> {
  const allZones = await getZonesWithPolygons();
  // Filter in application code for now (PostGIS would do this in SQL)
  return allZones.filter((z) => {
    if (!z.polygonCoordinates || z.polygonCoordinates.length < 3) return false;
    return isPointInPolygonServer([lat, lng], z.polygonCoordinates);
  });
}

function isPointInPolygonServer(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
