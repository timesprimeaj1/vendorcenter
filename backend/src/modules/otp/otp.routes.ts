import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { markUserVerified, findUserByEmail, createSession } from "../auth/auth.repository.js";
import { trackActivity } from "../activity/activity.service.js";
import { sendOtpEmail } from "../../services/emailService.js";
import { signAccessToken, signRefreshToken, hashToken } from "../auth/token.service.js";

const purposeSchema = z.enum(["signup", "vendor_onboarding", "password_reset", "employee_login", "login"]);

function randomOtp(length: number) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(min + Math.random() * (max - min)));
}

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export const otpRouter = Router();

otpRouter.post("/request", async (req, res) => {
  try {
    const parsed = z.object({ email: z.string().email(), purpose: purposeSchema }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }

    const code = randomOtp(env.otpLength);
    const result = await pool.query<{ id: string }>(
      "INSERT INTO otp_events (email, purpose, code_hash, expires_at, max_attempts) VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 minute'), $5) RETURNING id",
      [parsed.data.email, parsed.data.purpose, hashCode(code), env.otpExpiryMinutes, env.otpMaxAttempts]
    );
    const otpId = result.rows[0].id;

    // Queue OTP email via centralized service
    await sendOtpEmail({
      recipientEmail: parsed.data.email,
      code,
      purpose: parsed.data.purpose,
      expiryMinutes: env.otpExpiryMinutes,
    });

    trackActivity({
      actorId: parsed.data.email,
      role: "customer",
      action: "otp.requested",
      entity: "otp",
      metadata: { otpId, purpose: parsed.data.purpose, from: "otp@vendorcenter.in" }
    });

    res.status(201).json({
      success: true,
      data: {
        otpId,
        expiresInMinutes: env.otpExpiryMinutes,
        sentFrom: "otp@vendorcenter.in",
      }
    });
  } catch (err) {
    console.error("[otp] request error", err);
    res.status(500).json({ success: false, error: "Failed to send OTP" });
  }
});

otpRouter.post("/verify", async (req, res) => {
  try {
    const parsed = z
      .object({ otpId: z.string().min(3), code: z.string().length(env.otpLength), purpose: purposeSchema })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }

    const result = await pool.query<{
      id: string;
      email: string;
      purpose: "signup" | "vendor_onboarding" | "password_reset" | "employee_login" | "login";
      code_hash: string;
      expires_at: string;
      used_at: string | null;
      attempts: number;
      max_attempts: number;
    }>(
      "SELECT id, email, purpose, code_hash, expires_at, used_at, attempts, max_attempts FROM otp_events WHERE id = $1 LIMIT 1",
      [parsed.data.otpId]
    );

    const otp = result.rows[0];
    if (!otp) {
      res.status(404).json({ success: false, error: "OTP not found" });
      return;
    }

    if (otp.used_at) {
      res.status(409).json({ success: false, error: "OTP already used" });
      return;
    }

    if (otp.purpose !== parsed.data.purpose) {
      res.status(400).json({ success: false, error: "OTP purpose mismatch" });
      return;
    }

    if (Date.now() > new Date(otp.expires_at).getTime()) {
      res.status(410).json({ success: false, error: "OTP expired" });
      return;
    }

    if (otp.attempts >= otp.max_attempts) {
      res.status(429).json({ success: false, error: "OTP attempts exceeded" });
      return;
    }

    await pool.query("UPDATE otp_events SET attempts = attempts + 1 WHERE id = $1", [otp.id]);

    if (otp.code_hash !== hashCode(parsed.data.code)) {
      res.status(401).json({ success: false, error: "Invalid OTP code" });
      return;
    }

    await pool.query("UPDATE otp_events SET used_at = NOW() WHERE id = $1", [otp.id]);
    const user = await findUserByEmail(otp.email);
    if (user) {
      await markUserVerified(otp.email);
    }

    trackActivity({
      actorId: otp.email,
      role: user?.role ?? "customer",
      action: "otp.verified",
      entity: "otp",
      metadata: { otpId: otp.id, purpose: otp.purpose }
    });

    // For login purpose: issue tokens and return auth result
    if (otp.purpose === "login" && user) {
      const accessToken = signAccessToken({ userId: user.id, role: user.role, email: user.email });
      const refreshToken = signRefreshToken({ userId: user.id, role: user.role, email: user.email });

      await createSession({
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: req.header("user-agent") ?? undefined,
        ipAddress: req.ip
      });

      trackActivity({ actorId: user.id, role: user.role, action: "auth.otp_login", entity: "user" });

      res.json({
        success: true,
        data: {
          verified: true,
          accessToken,
          refreshToken,
          actor: { id: user.id, role: user.role, email: user.email, verified: user.verified }
        }
      });
      return;
    }

    res.json({ success: true, data: { verified: true } });
  } catch (err) {
    console.error("[otp] verify error", err);
    res.status(500).json({ success: false, error: "OTP verification failed" });
  }
});
