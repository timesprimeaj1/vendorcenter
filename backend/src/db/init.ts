import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { pool } from "./pool.js";

export async function initializeDatabase() {
  // Try multiple possible schema paths (monorepo root vs Docker container)
  const possiblePaths = [
    path.resolve(process.cwd(), "database", "schema.sql"),
    path.resolve(process.cwd(), "..", "database", "schema.sql"),
  ];

  const schemaPath = possiblePaths.find((p) => existsSync(p));

  if (!schemaPath) {
    console.log("[db] schema.sql not found — skipping table creation (tables should already exist)");
    // Verify connection still works
    await pool.query("SELECT 1");
    return;
  }

  const sql = readFileSync(schemaPath, "utf8");
  await pool.query(sql);
}
