import { Pool } from "pg";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env"), override: true });

const isProduction = process.env.NODE_ENV === "production";

// Strip sslmode from DATABASE_URL — we handle SSL explicitly below
function cleanConnectionString(url: string): string {
  return url.replace(/[?&]sslmode=[^&]*/g, "").replace(/\?$/, "");
}

const poolTimeouts = {
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  query_timeout: 10_000,
  statement_timeout: 10_000,
};

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: cleanConnectionString(process.env.DATABASE_URL),
      ssl: { rejectUnauthorized: false },
      ...poolTimeouts,
    })
  : new Pool({
      host: process.env.DB_HOST ?? "localhost",
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME ?? "vendorcenter",
      user: process.env.DB_USER ?? "vendorcenter",
      password: process.env.DB_PASSWORD ?? "change_me",
      ...(isProduction ? { ssl: { rejectUnauthorized: false } } : {}),
      ...poolTimeouts,
    });
