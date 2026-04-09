import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { trackActivity } from "../activity/activity.service.js";
import { createSession, createUser, createPhoneUser, findUserByEmail, findUserById, findUserByPhone, findUserByFirebaseUid, linkFirebaseUid, updatePassword, updateUserProfile, getUserRoles } from "./auth.repository.js";
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from "./token.service.js";
import { requireRole, type AuthRequest } from "../../middleware/auth.js";
import { findActiveSessionByTokenHash, revokeSessionById } from "./session.service.js";
import { verifyFirebaseToken, isFirebaseConfigured } from "../../services/firebaseService.js";
import { AppRole } from "../../shared/types.js";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

// Serialize Zod validation errors to a human-readable string
function zodErrorString(error: z.ZodError): string {
  const flat = error.flatten();
  const fieldMsgs = Object.entries(flat.fieldErrors)
    .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
    .join("; ");
  return fieldMsgs || flat.formErrors.join("; ") || "Invalid input";
}

const signupSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  role: z.enum(["customer", "vendor"]),
  name: z.string().min(1).max(100).optional(),
  phone: z.string().regex(/^\d{10}$/, "Phone must be 10 digits").optional(),
  businessName: z.string().max(150).optional(),
});

export const authRouter = Router();

authRouter.post("/signup", async (req, res) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: zodErrorString(parsed.error) });
      return;
    }

    const existing = await findUserByEmail(parsed.data.email, parsed.data.role);
    if (existing) {
      res.status(409).json({ success: false, error: "User already exists" });
      return;
    }

    // Check phone uniqueness per role
    if (parsed.data.phone) {
      const phoneExists = await findUserByPhone(parsed.data.phone, parsed.data.role);
      if (phoneExists) {
        res.status(409).json({ success: false, error: "This phone number is already registered for this role" });
        return;
      }
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await createUser({
      email: parsed.data.email,
      role: parsed.data.role,
      passwordHash,
      name: parsed.data.name,
      phone: parsed.data.phone,
      businessName: parsed.data.businessName,
    });

    trackActivity({
      actorId: user.id,
      role: parsed.data.role,
      action: "auth.signup",
      entity: "user",
      metadata: { email: parsed.data.email }
    });

    res.status(201).json({ success: true, data: { userId: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error("[auth] signup error", err);
    res.status(500).json({ success: false, error: "Signup failed" });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const parsed = z
      .object({ email: z.string().email(), password: z.string().min(8), role: z.enum(["customer", "vendor", "admin", "employee"]).optional() })
      .safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: zodErrorString(parsed.error) });
      return;
    }

    const user = await findUserByEmail(parsed.data.email, parsed.data.role as any);

    if (!user) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    if (user.suspended) {
      res.status(403).json({ success: false, error: "Your account has been suspended. Contact support." });
      return;
    }

    if (user.role === "employee" && !user.verified) {
      res.status(403).json({ success: false, error: "Your account is pending admin approval. Please contact your administrator." });
      return;
    }

    if (!user.password_hash) {
      res.status(401).json({ success: false, error: "This account uses phone login. Please sign in with your phone number." });
      return;
    }

    const passwordOk = await bcrypt.compare(parsed.data.password, user.password_hash);
    if (!passwordOk) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role, email: user.email ?? "" });
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role, email: user.email ?? "" });

    await createSession({
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: req.header("user-agent") ?? undefined,
      ipAddress: req.ip
    });

    trackActivity({ actorId: user.id, role: user.role, action: "auth.login", entity: "user" });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        actor: { id: user.id, role: user.role, email: user.email, verified: user.verified, name: user.name, phone: user.phone, businessName: user.business_name }
      }
    });
  } catch (err) {
    console.error("[auth] login error", err);
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

authRouter.post("/refresh", async (req, res) => {
  try {
    const parsed = z.object({ refreshToken: z.string().min(20) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: zodErrorString(parsed.error) });
      return;
    }

    let payload: { userId: string; role: "customer" | "vendor" | "admin" | "employee"; email: string };
    try {
      payload = verifyRefreshToken(parsed.data.refreshToken) as typeof payload;
    } catch {
      res.status(401).json({ success: false, error: "Invalid refresh token" });
      return;
    }

    const tokenHash = hashToken(parsed.data.refreshToken);
    const session = await findActiveSessionByTokenHash(tokenHash);
    if (!session || session.userId !== payload.userId) {
      res.status(401).json({ success: false, error: "Session expired or revoked" });
      return;
    }

    await revokeSessionById(session.id);

    const accessToken = signAccessToken({ userId: payload.userId, role: payload.role, email: payload.email });
    const refreshToken = signRefreshToken({ userId: payload.userId, role: payload.role, email: payload.email });

    await createSession({
      userId: payload.userId,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: req.header("user-agent") ?? undefined,
      ipAddress: req.ip
    });

    trackActivity({ actorId: payload.userId, role: payload.role, action: "auth.refresh", entity: "session" });

    res.json({ success: true, data: { accessToken, refreshToken } });
  } catch (err) {
    console.error("[auth] refresh error", err);
    res.status(500).json({ success: false, error: "Token refresh failed" });
  }
});

authRouter.post("/logout", async (req, res) => {
  try {
    const parsed = z.object({ refreshToken: z.string().min(20) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: zodErrorString(parsed.error) });
      return;
    }

    let payload: { userId: string; role: "customer" | "vendor" | "admin" | "employee"; email: string };
    try {
      payload = verifyRefreshToken(parsed.data.refreshToken) as typeof payload;
    } catch {
      res.status(401).json({ success: false, error: "Invalid refresh token" });
      return;
    }

    const tokenHash = hashToken(parsed.data.refreshToken);
    const session = await findActiveSessionByTokenHash(tokenHash);
    if (!session) {
      res.status(404).json({ success: false, error: "Session not found" });
      return;
    }

    await revokeSessionById(session.id);
    trackActivity({ actorId: payload.userId, role: payload.role, action: "auth.logout", entity: "session" });

    res.json({ success: true, data: { loggedOut: true } });
  } catch (err) {
    console.error("[auth] logout error", err);
    res.status(500).json({ success: false, error: "Logout failed" });
  }
});

// ─── Forgot Password (sends OTP email) ──
authRouter.post("/forgot-password", async (req, res) => {
  try {
    const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Valid email required" });
      return;
    }

    const user = await findUserByEmail(parsed.data.email);
    if (!user) {
      res.status(404).json({ success: false, error: "No account found with this email" });
      return;
    }

    // Generate OTP and store in otp_events
    const crypto = await import("node:crypto");
    const { pool } = await import("../../db/pool.js");
    const { env } = await import("../../config/env.js");
    const { sendOtpEmail } = await import("../../services/emailService.js");

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const result = await pool.query<{ id: string }>(
      "INSERT INTO otp_events (email, purpose, code_hash, expires_at, max_attempts) VALUES ($1, 'password_reset', $2, NOW() + ($3 * INTERVAL '1 minute'), $4) RETURNING id",
      [parsed.data.email, codeHash, env.otpExpiryMinutes ?? 10, env.otpMaxAttempts ?? 5]
    );
    const otpId = result.rows[0].id;

    await sendOtpEmail({
      recipientEmail: parsed.data.email,
      code,
      purpose: "password_reset",
      expiryMinutes: env.otpExpiryMinutes ?? 10,
    });

    trackActivity({ actorId: user.id, role: user.role, action: "auth.forgot_password", entity: "user" });

    res.json({ success: true, data: { otpId, expiresInMinutes: env.otpExpiryMinutes ?? 10 } });
  } catch (err) {
    console.error("[auth] forgot-password error", err);
    res.status(500).json({ success: false, error: "Failed to send reset email" });
  }
});

authRouter.post("/reset-password", async (req, res) => {
  try {
    const parsed = z.object({
      email: z.string().email(),
      otpId: z.string().min(3),
      code: z.string().min(6),
      newPassword: z.string().min(8)
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: zodErrorString(parsed.error) });
      return;
    }

    const user = await findUserByEmail(parsed.data.email);
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    // Verify OTP inline (purpose: password_reset)
    const { pool } = await import("../../db/pool.js");
    const crypto = await import("node:crypto");
    const otpResult = await pool.query<{
      id: string; email: string; purpose: string; code_hash: string;
      expires_at: string; used_at: string | null; attempts: number; max_attempts: number;
    }>("SELECT id, email, purpose, code_hash, expires_at, used_at, attempts, max_attempts FROM otp_events WHERE id = $1 LIMIT 1", [parsed.data.otpId]);

    const otp = otpResult.rows[0];
    if (!otp || otp.email !== parsed.data.email || otp.purpose !== "password_reset") {
      res.status(400).json({ success: false, error: "Invalid OTP" });
      return;
    }
    if (otp.used_at) {
      res.status(409).json({ success: false, error: "OTP already used" });
      return;
    }
    if (Date.now() > new Date(otp.expires_at).getTime()) {
      res.status(410).json({ success: false, error: "OTP expired" });
      return;
    }
    const codeHash = crypto.createHash("sha256").update(parsed.data.code).digest("hex");
    if (otp.code_hash !== codeHash) {
      res.status(401).json({ success: false, error: "Invalid OTP code" });
      return;
    }

    await pool.query("UPDATE otp_events SET used_at = NOW() WHERE id = $1", [otp.id]);

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await updatePassword(parsed.data.email, passwordHash);

    trackActivity({ actorId: user.id, role: user.role, action: "auth.password_reset", entity: "user" });

    res.json({ success: true, data: { reset: true } });
  } catch (err) {
    console.error("[auth] reset-password error", err);
    res.status(500).json({ success: false, error: "Password reset failed" });
  }
});

// ─── Profile ──────────────────────────────────────
authRouter.get("/profile", requireRole(["customer", "vendor", "admin", "employee"]), async (req: AuthRequest, res) => {
  try {
    const user = await findUserById(req.actor!.id);
    if (!user) { res.status(404).json({ success: false, error: "User not found" }); return; }
    res.json({ success: true, data: { id: user.id, email: user.email, name: user.name, phone: user.phone, businessName: user.business_name, role: user.role, profilePictureUrl: user.profile_picture_url } });
  } catch (err) {
    console.error("[auth] profile get error", err);
    res.status(500).json({ success: false, error: "Failed to fetch profile" });
  }
});

authRouter.put("/profile", requireRole(["customer", "vendor", "admin", "employee"]), async (req: AuthRequest, res) => {
  try {
    const parsed = z.object({
      name: z.string().min(1).optional(),
      phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits").optional(),
      profilePictureUrl: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, error: zodErrorString(parsed.error) }); return; }

    // Check phone uniqueness per role before update
    if (parsed.data.phone) {
      const existing = await findUserByPhone(parsed.data.phone, req.actor!.role as AppRole);
      if (existing && existing.id !== req.actor!.id) {
        res.status(409).json({ success: false, error: "This phone number is already registered" });
        return;
      }
    }

    const user = await updateUserProfile(req.actor!.id, parsed.data);
    if (!user) { res.status(404).json({ success: false, error: "User not found" }); return; }

    trackActivity({ actorId: user.id, role: user.role, action: "auth.profile_updated", entity: "user" });
    res.json({ success: true, data: { id: user.id, email: user.email, name: user.name, phone: user.phone, businessName: user.business_name, role: user.role, profilePictureUrl: user.profile_picture_url } });
  } catch (err) {
    console.error("[auth] profile update error", err);
    res.status(500).json({ success: false, error: "Failed to update profile" });
  }
});

// ─── Phone OTP Platform Gate (hard 9/day limit) ──
// Firebase Blaze plan charges per SMS beyond 10/day free tier.
// Platform-wide safety cap + per-phone limit.
// Quota resets at midnight Pacific Time (when Firebase resets).
const DAILY_PLATFORM_OTP_LIMIT = 9;
const DAILY_PER_PHONE_OTP_LIMIT = 3;

/** Rolling 24-hour window for OTP counting.
 *  More conservative than midnight-reset (better billing protection)
 *  and eliminates fragile Pacific timezone calculations. */
function getOtpWindowStart(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

authRouter.post("/phone-otp-gate", async (req, res) => {
  try {
    const { pool } = await import("../../db/pool.js");
    const windowStart = getOtpWindowStart();

    const phone = typeof req.body?.phone === "string" ? req.body.phone.replace(/\D/g, "").slice(-10) : "";
    const role = typeof req.body?.role === "string" && ["customer", "vendor"].includes(req.body.role) ? req.body.role : "customer";

    if (!phone || phone.length !== 10) {
      res.status(400).json({ success: false, error: "Valid 10-digit phone number required." });
      return;
    }

    // Check if phone is registered for this role — if not, ask to register first
    const userCheck = await pool.query(
      "SELECT id, suspended FROM users WHERE phone = $1 AND role = $2 LIMIT 1",
      [phone, role]
    );
    if (userCheck.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: "No account found with this phone number. Please register first.",
        code: "USER_NOT_FOUND",
      });
      return;
    }
    if (userCheck.rows[0].suspended) {
      res.status(403).json({ success: false, error: "Your account has been suspended. Contact support." });
      return;
    }

    // Per-phone daily limit — only count confirmed SMS sends
    const phoneResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM otp_events
       WHERE channel = 'phone_sms' AND code_hash = 'phone_sms_sent' AND phone = $1 AND created_at >= $2`,
      [phone, windowStart]
    );
    const phoneUsed = parseInt(phoneResult.rows[0]?.count ?? "0", 10);
    if (phoneUsed >= DAILY_PER_PHONE_OTP_LIMIT) {
      console.warn(`[otp-gate] BLOCKED — per-phone limit for ${phone} (${phoneUsed}/${DAILY_PER_PHONE_OTP_LIMIT})`);
      res.status(429).json({
        success: false,
        error: `OTP limit reached for this number (${DAILY_PER_PHONE_OTP_LIMIT}/day). Try again later.`,
        remaining: 0,
      });
      return;
    }

    // Platform-wide daily safety cap — only count confirmed SMS sends
    const platformResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM otp_events
       WHERE channel = 'phone_sms' AND code_hash = 'phone_sms_sent' AND created_at >= $1`,
      [windowStart]
    );
    const platformUsed = parseInt(platformResult.rows[0]?.count ?? "0", 10);
    if (platformUsed >= DAILY_PLATFORM_OTP_LIMIT) {
      console.warn(`[otp-gate] BLOCKED — platform limit reached (${platformUsed}/${DAILY_PLATFORM_OTP_LIMIT})`);
      res.status(429).json({
        success: false,
        error: "SMS service temporarily unavailable. Please try again later.",
        remaining: 0,
      });
      return;
    }

    // Don't insert here — quota is tracked when frontend confirms SMS was sent
    // This prevents burning quota on reCAPTCHA/Firebase failures

    const remaining = Math.min(
      DAILY_PER_PHONE_OTP_LIMIT - phoneUsed,
      DAILY_PLATFORM_OTP_LIMIT - platformUsed
    );
    console.log(`[otp-gate] approved — phone ${phone}: ${phoneUsed}/${DAILY_PER_PHONE_OTP_LIMIT}, platform: ${platformUsed}/${DAILY_PLATFORM_OTP_LIMIT}`);
    res.json({ success: true, data: { allowed: true }, remaining });
  } catch (err) {
    console.error("[otp-gate] error", err);
    // FAIL CLOSED — if the gate errors, block the OTP to prevent billing
    res.status(503).json({ success: false, error: "OTP service temporarily unavailable. Try again shortly." });
  }
});

// Track actual SMS send — called by frontend after Firebase sends OTP successfully
authRouter.post("/phone-otp-track", async (req, res) => {
  try {
    const { pool } = await import("../../db/pool.js");
    const phone = typeof req.body?.phone === "string" ? req.body.phone.replace(/\D/g, "").slice(-10) : "";
    const role = typeof req.body?.role === "string" && ["customer", "vendor"].includes(req.body.role) ? req.body.role : "customer";

    if (!phone || phone.length !== 10) {
      res.status(400).json({ success: false, error: "Valid phone required." });
      return;
    }

    await pool.query(
      `INSERT INTO otp_events (email, phone, purpose, code_hash, channel, expires_at, max_attempts)
       VALUES ($1, $2, 'login', 'phone_sms_sent', 'phone_sms', NOW() + INTERVAL '10 minutes', 1)`,
      [`phone_${phone}@${role}`, phone]
    );

    console.log(`[otp-track] SMS sent recorded — phone ${phone}, role ${role}`);
    res.json({ success: true });
  } catch (err) {
    console.error("[otp-track] error", err);
    res.json({ success: true }); // Non-critical — don't block user flow
  }
});

// ─── Phone Auth (Firebase) ────────────────────────
const phoneLoginSchema = z.object({
  idToken: z.string().min(20, "Firebase ID token required"),
  role: z.enum(["customer", "vendor"]).default("customer"),
});

authRouter.post("/phone-login", async (req, res) => {
  try {
    if (!isFirebaseConfigured()) {
      res.status(503).json({ success: false, error: "Phone authentication is not configured" });
      return;
    }

    const parsed = phoneLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: zodErrorString(parsed.error) });
      return;
    }

    // Verify Firebase ID token
    let decoded;
    try {
      decoded = await verifyFirebaseToken(parsed.data.idToken);
    } catch (err: any) {
      const errMsg = err?.message || "Unknown error";
      console.error("[auth] Firebase token verification failed:", errMsg);
      res.status(401).json({ success: false, error: `Phone verification failed: ${errMsg}` });
      return;
    }

    const firebaseUid = decoded.uid;
    const phoneNumber = decoded.phone_number;

    if (!phoneNumber) {
      res.status(400).json({ success: false, error: "No phone number in token" });
      return;
    }

    // Normalize phone: Firebase returns "+919876543210", store as "9876543210"
    const normalizedPhone = phoneNumber.replace(/^\+91/, "");
    const requestedRole = parsed.data.role;

    // Find existing user by Firebase UID (role-scoped), then by phone+role
    let user = await findUserByFirebaseUid(firebaseUid, requestedRole);

    if (!user) {
      user = await findUserByPhone(normalizedPhone, requestedRole);

      if (user) {
        // Existing user with this phone+role but no Firebase UID — link them
        await linkFirebaseUid(user.id, firebaseUid);
      } else {
        // Check if phone is already taken for this role (prevent duplicates)
        const existingForRole = await findUserByPhone(normalizedPhone, requestedRole);
        if (existingForRole) {
          res.status(409).json({ success: false, error: "An account with this phone number already exists for this role" });
          return;
        }

        // New user — create with phone auth
        user = await createPhoneUser({
          phone: normalizedPhone,
          firebaseUid,
          role: requestedRole,
        });

        trackActivity({
          actorId: user.id,
          role: requestedRole,
          action: "auth.phone_signup",
          entity: "user",
          metadata: { phone: normalizedPhone, provider: "firebase" },
        });
      }
    }

    if (user.suspended) {
      res.status(403).json({ success: false, error: "Your account has been suspended. Contact support." });
      return;
    }

    if (user.role === "employee" && !user.verified) {
      res.status(403).json({ success: false, error: "Your account is pending admin approval. Please contact your administrator." });
      return;
    }

    // Issue our JWT tokens
    const accessToken = signAccessToken({ userId: user.id, role: user.role, email: user.email ?? "" });
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role, email: user.email ?? "" });

    await createSession({
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: req.header("user-agent") ?? undefined,
      ipAddress: req.ip,
    });

    const roles = await getUserRoles(user.id);

    trackActivity({ actorId: user.id, role: user.role, action: "auth.phone_login", entity: "user" });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        actor: {
          id: user.id,
          role: user.role,
          roles,
          email: user.email,
          verified: user.verified,
          name: user.name,
          phone: user.phone,
          businessName: user.business_name,
        },
      },
    });
  } catch (err) {
    console.error("[auth] phone-login error", err);
    res.status(500).json({ success: false, error: "Phone login failed" });
  }
});
