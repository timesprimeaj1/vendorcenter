import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { pool } from "./pool.js";

// Lightweight migrations — add missing columns that were introduced after initial schema
const MIGRATIONS = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS work_started_at TIMESTAMPTZ`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completion_requested_at TIMESTAMPTZ`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rejection_reason TEXT`,
  `ALTER TABLE vendor_services ADD COLUMN IF NOT EXISTS pending_price NUMERIC(12,2)`,
  `ALTER TABLE vendor_services ADD COLUMN IF NOT EXISTS pending_price_effective_at TIMESTAMPTZ`,
  `ALTER TABLE vendor_services ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE vendor_services ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
  `ALTER TABLE vendor_services ADD COLUMN IF NOT EXISTS deleted_reason TEXT`,
  `CREATE TABLE IF NOT EXISTS vendor_service_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL,
    vendor_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('price_update_scheduled', 'price_update_applied', 'deleted')),
    old_price NUMERIC(12,2),
    new_price NUMERIC(12,2),
    effective_at TIMESTAMPTZ,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];

export async function initializeDatabase() {
  // Try multiple possible schema paths (monorepo root vs Docker container)
  const possiblePaths = [
    path.resolve(process.cwd(), "src", "db", "schema.sql"),
    path.resolve(process.cwd(), "database", "schema.sql"),
    path.resolve(process.cwd(), "..", "database", "schema.sql"),
    path.resolve(process.cwd(), "..", "backend", "src", "db", "schema.sql"),
  ];

  const schemaPath = possiblePaths.find((p) => existsSync(p));

  if (!schemaPath) {
    console.log("[db] schema.sql not found — skipping table creation (tables should already exist)");
    // Verify connection still works
    await pool.query("SELECT 1");
  } else {
    const sql = readFileSync(schemaPath, "utf8");
    await pool.query(sql);
  }

  // Run lightweight migrations
  for (const migration of MIGRATIONS) {
    try {
      await pool.query(migration);
    } catch (err) {
      console.warn(`[db] migration skipped: ${(err as Error).message}`);
    }
  }
  console.log("[db] migrations applied");
}
