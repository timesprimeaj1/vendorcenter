import { app } from "./app.js";
import { env } from "./config/env.js";
import { getSecurityConfigStatus } from "./config/env.js";
import { initializeDatabase } from "./db/init.js";
import { dbState } from "./db/state.js";
import { processQueuedEmailJobs } from "./modules/notifications/notifications.repository.js";
import { pool } from "./db/pool.js";
import bcrypt from "bcryptjs";

// Prevent process crash on unhandled async errors (Express 4 doesn't catch them)
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

const EMAIL_WORKER_INTERVAL = Number(process.env.EMAIL_WORKER_INTERVAL_MS ?? 15000);

function validateSecurityConfiguration() {
  const status = getSecurityConfigStatus();

  if (status.usingDefaultAccessSecret || status.usingDefaultRefreshSecret) {
    const message = "JWT secrets are using insecure defaults; configure JWT_ACCESS_SECRET and JWT_REFRESH_SECRET";

    if (env.nodeEnv === "production" && status.strictModeEnabled) {
      throw new Error(`[security] ${message}`);
    }

    console.warn(`[security] ${message}`);
    if (env.nodeEnv === "production") {
      console.warn("[security] Set SECURITY_STRICT_MODE=true after env rollout to enforce fail-fast startup.");
    }
  }

  if (status.corsWildcard) {
    console.warn("[security] CORS_ORIGINS is set to wildcard; use explicit origins for production.");
  }
}

async function autoSeedAdmin() {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return;

  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@vendorcenter.in";
  try {
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1 AND role = 'admin'",
      [adminEmail]
    );
    if (existing.rows.length > 0) return;

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const result = await pool.query(
      `INSERT INTO users (email, role, password_hash, name, verified)
       VALUES ($1, 'admin', $2, 'Platform Admin', true)
       RETURNING id`,
      [adminEmail, passwordHash]
    );
    // Also insert into user_roles
    await pool.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT (user_id, role) DO NOTHING`,
      [result.rows[0].id]
    );
    console.log(`[admin-seed] created admin user: ${adminEmail}`);
  } catch (err) {
    console.warn(`[admin-seed] failed:`, (err as Error).message);
  }
}

async function bootstrap() {
  validateSecurityConfiguration();

  try {
    await initializeDatabase();
    dbState.connected = true;
    dbState.lastError = "";
    await autoSeedAdmin();
  } catch (error) {
    dbState.connected = false;
    dbState.lastError = error instanceof Error ? error.message : "Database initialization failed";
    console.error("Database init failed, starting in degraded mode", error);
  }

  app.listen(env.port, "0.0.0.0", () => {
    console.log(`[${env.appName}] backend listening on port ${env.port}`);
  });

  // Start embedded email worker
  if (dbState.connected) {
    console.log(`[email-worker] started (interval ${EMAIL_WORKER_INTERVAL}ms)`);
    setInterval(async () => {
      try {
        const processed = await processQueuedEmailJobs(50);
        if (processed > 0) {
          console.log(`[email-worker] processed ${processed} queued email(s)`);
        }
      } catch (err) {
        console.error("[email-worker] cycle failed", err);
      }
    }, EMAIL_WORKER_INTERVAL);
  }
}

bootstrap().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
