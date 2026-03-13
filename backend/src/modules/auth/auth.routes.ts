import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { trackActivity } from "../activity/activity.service.js";
import { createSession, createUser, findUserByEmail, findUserById, updatePassword, updateUserProfile } from "./auth.repository.js";
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from "./token.service.js";
import { requireRole, type AuthRequest } from "../../middleware/auth.js";
import { findActiveSessionByTokenHash, revokeSessionById } from "./session.service.js";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

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
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }

    const existing = await findUserByEmail(parsed.data.email);
    if (existing) {
      res.status(409).json({ success: false, error: "User already exists" });
      return;
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
      .object({ email: z.string().email(), password: z.string().min(8) })
      .safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }

    const user = await findUserByEmail(parsed.data.email);

    if (!user) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    const passwordOk = await bcrypt.compare(parsed.data.password, user.password_hash);
    if (!passwordOk) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role, email: user.email });
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role, email: user.email });

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
      res.status(400).json({ success: false, error: parsed.error.flatten() });
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
      res.status(400).json({ success: false, error: parsed.error.flatten() });
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

authRouter.post("/reset-password", async (req, res) => {
  try {
    const parsed = z.object({
      email: z.string().email(),
      otpId: z.string().min(3),
      code: z.string().min(6),
      newPassword: z.string().min(8)
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
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
    if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.flatten() }); return; }

    const user = await updateUserProfile(req.actor!.id, parsed.data);
    if (!user) { res.status(404).json({ success: false, error: "User not found" }); return; }

    trackActivity({ actorId: user.id, role: user.role, action: "auth.profile_updated", entity: "user" });
    res.json({ success: true, data: { id: user.id, email: user.email, name: user.name, phone: user.phone, businessName: user.business_name, role: user.role, profilePictureUrl: user.profile_picture_url } });
  } catch (err) {
    console.error("[auth] profile update error", err);
    res.status(500).json({ success: false, error: "Failed to update profile" });
  }
});
