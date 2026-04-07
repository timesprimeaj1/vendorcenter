import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { pool } from "./pool.js";

// Lightweight migrations — add missing columns that were introduced after initial schema
const MIGRATIONS = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS work_started_at TIMESTAMPTZ`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completion_requested_at TIMESTAMPTZ`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_request_token_hash TEXT`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_request_expires TIMESTAMPTZ`,
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
  // Phase 0+1: pgvector + AI query logging + embedding tables
  `CREATE EXTENSION IF NOT EXISTS vector`,
  `CREATE TABLE IF NOT EXISTS ai_query_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    user_id TEXT,
    user_message TEXT NOT NULL,
    detected_intent TEXT,
    detected_service TEXT,
    detected_action TEXT,
    provider TEXT,
    response_message TEXT,
    response_json JSONB,
    confidence DOUBLE PRECISION,
    latency_ms INTEGER,
    lang TEXT,
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS service_category_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT UNIQUE NOT NULL,
    keywords TEXT,
    description TEXT,
    embedding vector(384),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS faq_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    embedding vector(384),
    lang TEXT NOT NULL DEFAULT 'en',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS embedding vector(384)`,
  `ALTER TABLE vendor_services ADD COLUMN IF NOT EXISTS embedding vector(384)`,
  // RLS: enable on all tables (backend connects as postgres superuser, bypasses RLS;
  // this blocks Supabase anon/authenticated roles from direct table access)
  `ALTER TABLE users ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE otp_events ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE bookings ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE zones ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE vendor_profiles ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE vendor_services ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE vendor_service_history ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE employee_zone_assignments ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE reviews ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE vendor_rating_aggregates ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE notifications ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE email_jobs ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE employee_support_tasks ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE ai_query_logs ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE service_category_embeddings ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE faq_embeddings ENABLE ROW LEVEL SECURITY`,
  // Phone auth: make email/password nullable, add Firebase columns
  `ALTER TABLE users ALTER COLUMN email DROP NOT NULL`,
  `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'email'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid) WHERE firebase_uid IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL`,
  // Multi-role support
  `CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('customer', 'vendor', 'admin', 'employee')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, role)
  )`,
  `INSERT INTO user_roles (user_id, role) SELECT id, role FROM users ON CONFLICT (user_id, role) DO NOTHING`,
  // Device tokens for push notifications (FCM)
  `CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('web', 'android', 'ios')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, token)
  )`,
  // OTP phone channel support
  `ALTER TABLE otp_events ADD COLUMN IF NOT EXISTS phone TEXT`,
  `ALTER TABLE otp_events ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email'`,
  `ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY`,
  // Admin: suspended column and employee permissions
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT false`,
  `CREATE TABLE IF NOT EXISTS employee_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, permission)
  )`,
  `ALTER TABLE employee_permissions ENABLE ROW LEVEL SECURITY`,
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
