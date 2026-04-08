import cors from "cors";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { authRouter } from "./modules/auth/auth.routes.js";
import { otpRouter } from "./modules/otp/otp.routes.js";
import { zonesRouter } from "./modules/zones/zones.routes.js";
import { vendorsRouter } from "./modules/vendors/vendors.routes.js";
import { servicesRouter } from "./modules/services/services.routes.js";
import { bookingsRouter } from "./modules/bookings/bookings.routes.js";
import { paymentsRouter } from "./modules/payments/payments.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { activityRouter } from "./modules/activity/activity.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { employeeRouter } from "./modules/employee/employee.routes.js";
import { analyticsRouter } from "./modules/analytics/analytics.routes.js";
import { reviewsRouter } from "./modules/reviews/reviews.routes.js";
import { uploadsRouter } from "./modules/uploads/uploads.routes.js";
import { mapsRouter } from "./modules/maps/maps.routes.js";
import { locationRouter } from "./modules/location/location.routes.js";
import { emailTestRouter } from "./modules/email-test/email-test.routes.js";
import { aiAssistantRouter } from "./modules/ai-assistant/ai-assistant.routes.js";

import { dbState } from "./db/state.js";
import { requestContext, requestLogger } from "./middleware/request-context.js";
import { xssSanitize } from "./middleware/xss-sanitize.js";
import { env } from "./config/env.js";

export const app = express();

const allowedCorsOrigins = env.corsOrigins
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);


// Railway / Vercel / Cloudflare proxy
app.set("trust proxy", 1);


// Security headers
app.use(
  helmet({
    contentSecurityPolicy: env.nodeEnv === "production" ? undefined : false,
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
  })
);


// CORS
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser or same-origin server-to-server requests.
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedCorsOrigins.includes("*") || allowedCorsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    // In development, allow any localhost origin (handles Vite port fallback)
    if (env.nodeEnv !== "production" && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));


// Body limits
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// XSS sanitization on all incoming request data
app.use(xssSanitize);


// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests, please try again later",
  },
});

app.use(globalLimiter);


// Auth limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many auth attempts, please try again later",
  },
});

// AI assistant limiter (prevents abuse of LLM API calls)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests. Please wait a moment before trying again.",
  },
});


app.use(requestContext);
app.use(requestLogger);


// Health
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      service: "vendorcenter-backend",
      status: dbState.connected ? "ok" : "degraded",
      database: {
        connected: dbState.connected,
        lastError: dbState.lastError || null,
      },
    },
  });
});

// Firebase Admin SDK health check
app.get("/health/firebase", async (_req: Request, res: Response) => {
  const { env: envConfig } = await import("./config/env.js");
  const { isFirebaseConfigured } = await import("./services/firebaseService.js");

  // Key diagnostics (safe: only PEM header, length — no secret material)
  const rawKey = process.env.FIREBASE_PRIVATE_KEY ?? "";
  const parsedKey = envConfig.firebasePrivateKey;
  const keyDiag = {
    rawLength: rawKey.length,
    parsedLength: parsedKey.length,
    rawFirst35: rawKey.substring(0, 35),
    parsedFirst35: parsedKey.substring(0, 35),
    parsedLast30: parsedKey.substring(Math.max(0, parsedKey.length - 30)),
    hasLiteralBackslashN: rawKey.includes("\\n"),
    hasRealNewlines: parsedKey.includes("\n"),
    newlineCount: (parsedKey.match(/\n/g) || []).length,
    rawStartsWithQuote: rawKey.startsWith('"') || rawKey.startsWith("'"),
  };

  const configured = isFirebaseConfigured();
  if (!configured) {
    res.json({ success: true, data: { configured: false, status: "not_configured", keyDiag } });
    return;
  }

  try {
    const { getFirebaseAuth } = await import("./services/firebaseService.js");
    const auth = getFirebaseAuth();
    await auth.listUsers(1);
    res.json({ success: true, data: { configured: true, status: "ok", keyDiag, message: "Firebase Admin SDK verified" } });
  } catch (err: any) {
    res.json({ success: true, data: { configured: true, status: "error", keyDiag, message: err.message || "Firebase init failed" } });
  }
});

// Root route for platform default health checks (some providers probe "/")
app.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      service: "vendorcenter-backend",
      status: dbState.connected ? "ok" : "degraded",
    },
  });
});


app.get("/api/status", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    server: "VendorCenter Backend",
    port: env.port,
    database: dbState.connected ? "connected" : "disconnected",
  });
});


app.get("/ai/modules", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      supportedFutureModules: [
        "ai_customer_support_chatbot",
        "vendor_performance_analytics",
        "recommendation_engine",
        "demand_prediction",
      ],
    },
  });
});


// Routes
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/otp", authLimiter, otpRouter);
app.use("/api/zones", zonesRouter);
app.use("/api/vendors", vendorsRouter);
app.use("/api/services", servicesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/activity", activityRouter);
app.use("/api/admin", adminRouter);
app.use("/api/employee", employeeRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/maps", mapsRouter);
app.use("/api/location", locationRouter);
app.use("/api/email-test", emailTestRouter);
app.use("/api/ai-assistant", aiLimiter, aiAssistantRouter);

// API v1 aliases — forward-compatible versioned endpoints
app.use("/api/v1/auth", authLimiter, authRouter);
app.use("/api/v1/otp", authLimiter, otpRouter);
app.use("/api/v1/zones", zonesRouter);
app.use("/api/v1/vendors", vendorsRouter);
app.use("/api/v1/services", servicesRouter);
app.use("/api/v1/bookings", bookingsRouter);
app.use("/api/v1/payments", paymentsRouter);
app.use("/api/v1/notifications", notificationsRouter);
app.use("/api/v1/activity", activityRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/employee", employeeRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/reviews", reviewsRouter);
app.use("/api/v1/uploads", uploadsRouter);
app.use("/api/v1/maps", mapsRouter);
app.use("/api/v1/location", locationRouter);
app.use("/api/v1/ai-assistant", aiLimiter, aiAssistantRouter);


// Global error handler
app.use(
  (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[unhandled]", err);

    res.status(500).json({
      success: false,
      error:
        env.nodeEnv === "production"
          ? "Internal server error"
          : err.message,
    });
  }
);