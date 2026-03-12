import { app } from "./app.js";
import { env } from "./config/env.js";
import { initializeDatabase } from "./db/init.js";
import { dbState } from "./db/state.js";
import { processQueuedEmailJobs } from "./modules/notifications/notifications.repository.js";

// Prevent process crash on unhandled async errors (Express 4 doesn't catch them)
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

const EMAIL_WORKER_INTERVAL = Number(process.env.EMAIL_WORKER_INTERVAL_MS ?? 15000);

async function bootstrap() {
  try {
    await initializeDatabase();
    dbState.connected = true;
    dbState.lastError = "";
  } catch (error) {
    dbState.connected = false;
    dbState.lastError = error instanceof Error ? error.message : "Database initialization failed";
    console.error("Database init failed, starting in degraded mode", error);
  }

  app.listen(env.port, () => {
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
