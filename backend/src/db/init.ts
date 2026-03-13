import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { pool } from "./pool.js";

// Lightweight migrations — add missing columns that were introduced after initial schema
const MIGRATIONS = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url TEXT`,
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
