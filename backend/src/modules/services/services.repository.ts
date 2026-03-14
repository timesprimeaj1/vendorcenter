import { pool } from "../../db/pool.js";

export interface ServiceInput {
  vendorId: string;
  name: string;
  price: number;
  availability: "available" | "unavailable";
  locations: string[];
  images: string[];
}

export interface ServiceRow {
  id: string;
  vendorId: string;
  name: string;
  price: number;
  availability: "available" | "unavailable";
  locations: string[];
  images: string[];
  pendingPrice: number | null;
  pendingPriceEffectiveAt: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function applyDueServicePriceUpdates(vendorId?: string) {
  const params: unknown[] = [];
  let whereVendor = "";
  if (vendorId) {
    params.push(vendorId);
    whereVendor = `AND vendor_id = $${params.length}`;
  }

  const due = await pool.query<{
    id: string;
    vendor_id: string;
    price: string;
    pending_price: string;
    pending_price_effective_at: string;
  }>(
    `SELECT id, vendor_id, price::text, pending_price::text, pending_price_effective_at::text
     FROM vendor_services
     WHERE is_deleted = false
       AND pending_price IS NOT NULL
       AND pending_price_effective_at IS NOT NULL
       AND pending_price_effective_at <= NOW()
       ${whereVendor}`,
    params
  );

  if (due.rowCount === 0) return;

  for (const row of due.rows) {
    await pool.query(
      `INSERT INTO vendor_service_history (service_id, vendor_id, action, old_price, new_price, effective_at)
       VALUES ($1, $2, 'price_update_applied', $3, $4, $5)`,
      [row.id, row.vendor_id, Number(row.price), Number(row.pending_price), row.pending_price_effective_at]
    );
  }

  await pool.query(
    `UPDATE vendor_services
     SET price = pending_price,
         pending_price = NULL,
         pending_price_effective_at = NULL,
         updated_at = NOW()
     WHERE is_deleted = false
       AND pending_price IS NOT NULL
       AND pending_price_effective_at IS NOT NULL
       AND pending_price_effective_at <= NOW()
       ${whereVendor}`,
    params
  );
}

export async function createService(input: ServiceInput) {
  const result = await pool.query<ServiceRow>(
    `INSERT INTO vendor_services (vendor_id, name, price, availability, locations, images)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
     RETURNING id, vendor_id as "vendorId", name, price, availability, locations, images,
               pending_price as "pendingPrice", pending_price_effective_at as "pendingPriceEffectiveAt",
               is_deleted as "isDeleted", deleted_at as "deletedAt", deleted_reason as "deletedReason",
               created_at as "createdAt", updated_at as "updatedAt"`,
    [input.vendorId, input.name, input.price, input.availability, JSON.stringify(input.locations), JSON.stringify(input.images)]
  );
  return result.rows[0];
}

export async function listServices() {
  await applyDueServicePriceUpdates();
  const result = await pool.query<ServiceRow>(
    `SELECT id, vendor_id as "vendorId", name, price, availability, locations, images,
            pending_price as "pendingPrice", pending_price_effective_at as "pendingPriceEffectiveAt",
            is_deleted as "isDeleted", deleted_at as "deletedAt", deleted_reason as "deletedReason",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM vendor_services
     WHERE is_deleted = false
     ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function listServicesByVendor(vendorId: string) {
  await applyDueServicePriceUpdates(vendorId);
  const result = await pool.query<ServiceRow>(
    `SELECT id, vendor_id as "vendorId", name, price, availability, locations, images,
            pending_price as "pendingPrice", pending_price_effective_at as "pendingPriceEffectiveAt",
            is_deleted as "isDeleted", deleted_at as "deletedAt", deleted_reason as "deletedReason",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM vendor_services
     WHERE vendor_id = $1 AND is_deleted = false
     ORDER BY created_at DESC`,
    [vendorId]
  );
  return result.rows;
}

export async function listDeletedServicesByVendor(vendorId: string) {
  const result = await pool.query<ServiceRow>(
    `SELECT id, vendor_id as "vendorId", name, price, availability, locations, images,
            pending_price as "pendingPrice", pending_price_effective_at as "pendingPriceEffectiveAt",
            is_deleted as "isDeleted", deleted_at as "deletedAt", deleted_reason as "deletedReason",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM vendor_services
     WHERE vendor_id = $1 AND is_deleted = true
     ORDER BY deleted_at DESC NULLS LAST, updated_at DESC`,
    [vendorId]
  );
  return result.rows;
}

export async function scheduleServicePriceUpdate(input: {
  serviceId: string;
  vendorId: string;
  newPrice: number;
  daysDelay: 1 | 2;
}) {
  const existing = await pool.query<{ id: string; price: string }>(
    `SELECT id, price::text FROM vendor_services WHERE id = $1 AND vendor_id = $2 AND is_deleted = false LIMIT 1`,
    [input.serviceId, input.vendorId]
  );
  if (!existing.rows[0]) return null;

  const effectiveAt = new Date(Date.now() + input.daysDelay * 24 * 60 * 60 * 1000);
  await pool.query(
    `UPDATE vendor_services
     SET pending_price = $3,
         pending_price_effective_at = $4,
         updated_at = NOW()
     WHERE id = $1 AND vendor_id = $2 AND is_deleted = false`,
    [input.serviceId, input.vendorId, input.newPrice, effectiveAt]
  );

  await pool.query(
    `INSERT INTO vendor_service_history (service_id, vendor_id, action, old_price, new_price, effective_at)
     VALUES ($1, $2, 'price_update_scheduled', $3, $4, $5)`,
    [input.serviceId, input.vendorId, Number(existing.rows[0].price), input.newPrice, effectiveAt]
  );

  const result = await pool.query<ServiceRow>(
    `SELECT id, vendor_id as "vendorId", name, price, availability, locations, images,
            pending_price as "pendingPrice", pending_price_effective_at as "pendingPriceEffectiveAt",
            is_deleted as "isDeleted", deleted_at as "deletedAt", deleted_reason as "deletedReason",
            created_at as "createdAt", updated_at as "updatedAt"
     FROM vendor_services WHERE id = $1 LIMIT 1`,
    [input.serviceId]
  );
  return result.rows[0] ?? null;
}

export async function softDeleteService(input: { serviceId: string; vendorId: string; reason?: string }) {
  const result = await pool.query<ServiceRow>(
    `UPDATE vendor_services
     SET is_deleted = true,
         deleted_at = NOW(),
         deleted_reason = $3,
         updated_at = NOW()
     WHERE id = $1 AND vendor_id = $2 AND is_deleted = false
     RETURNING id, vendor_id as "vendorId", name, price, availability, locations, images,
               pending_price as "pendingPrice", pending_price_effective_at as "pendingPriceEffectiveAt",
               is_deleted as "isDeleted", deleted_at as "deletedAt", deleted_reason as "deletedReason",
               created_at as "createdAt", updated_at as "updatedAt"`,
    [input.serviceId, input.vendorId, input.reason ?? null]
  );

  const deleted = result.rows[0] ?? null;
  if (!deleted) return null;

  await pool.query(
    `INSERT INTO vendor_service_history (service_id, vendor_id, action, old_price, new_price, reason)
     VALUES ($1, $2, 'deleted', $3, $3, $4)`,
    [deleted.id, deleted.vendorId, deleted.price, input.reason ?? null]
  );

  return deleted;
}

export async function listServiceHistory(serviceId: string, vendorId: string) {
  const result = await pool.query<{
    id: string;
    action: string;
    oldPrice: number | null;
    newPrice: number | null;
    effectiveAt: string | null;
    reason: string | null;
    createdAt: string;
  }>(
    `SELECT id, action,
            old_price as "oldPrice",
            new_price as "newPrice",
            effective_at as "effectiveAt",
            reason,
            created_at as "createdAt"
     FROM vendor_service_history
     WHERE service_id = $1 AND vendor_id = $2
     ORDER BY created_at DESC`,
    [serviceId, vendorId]
  );
  return result.rows;
}
