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
    // Check if any user with this email exists
    const existing = await pool.query(
      "SELECT id, role, password_hash FROM users WHERE email = $1 LIMIT 1",
      [adminEmail]
    );

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      // Ensure role is admin and password is current
      await pool.query(
        "UPDATE users SET role = 'admin', password_hash = $1, verified = true, suspended = false WHERE id = $2",
        [passwordHash, user.id]
      );
      await pool.query(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT (user_id, role) DO NOTHING",
        [user.id]
      );
      console.log(`[admin-seed] ensured admin user: ${adminEmail} (id: ${user.id})`);
      return;
    }

    // Create new admin
    const result = await pool.query(
      `INSERT INTO users (email, role, password_hash, name, verified)
       VALUES ($1, 'admin', $2, 'Platform Admin', true)
       RETURNING id`,
      [adminEmail, passwordHash]
    );
    await pool.query(
      "INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT (user_id, role) DO NOTHING",
      [result.rows[0].id]
    );
    console.log(`[admin-seed] created admin user: ${adminEmail}`);
  } catch (err) {
    console.error(`[admin-seed] failed:`, (err as Error).message);
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

  const server = app.listen(env.port, "0.0.0.0", () => {
    console.log(`[${env.appName}] backend listening on port ${env.port}`);
  });

  // Graceful shutdown for Railway/Docker SIGTERM
  const shutdown = async (signal: string) => {
    console.log(`[shutdown] ${signal} received, closing server...`);
    server.close(() => {
      console.log('[shutdown] HTTP server closed');
      pool.end().then(() => {
        console.log('[shutdown] DB pool drained');
        process.exit(0);
      }).catch(() => process.exit(1));
    });
    // Force exit after 10s if graceful shutdown stalls
    setTimeout(() => { console.error('[shutdown] forced exit'); process.exit(1); }, 10000);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

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
