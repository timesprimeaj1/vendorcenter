import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../../middleware/auth.js";
import { AuthRequest } from "../../middleware/auth.js";
import { trackActivity } from "../activity/activity.service.js";
import {
  createNotification,
  listNotifications,
  markAllAsRead,
  getUnreadCount,
  listEmailJobs,
  processQueuedEmailJobs,
  queueEmailJob
} from "./notifications.repository.js";
import { sendOtpEmail, sendBookingConfirmation, sendPaymentReceipt } from "../../services/emailService.js";
import { generateBookingReceipt } from "../../services/pdfService.js";

export const notificationsRouter = Router();

notificationsRouter.get("/templates", requireRole(["admin", "employee"]), (_req, res) => {
  res.json({
    success: true,
    data: {
      emailProvider: "Brevo SMTP",
      identities: [
        "noreply@vendorcenter.in",
        "otp@vendorcenter.in",
        "payments@vendorcenter.in",
        "bookings@vendorcenter.in",
        "support@vendorcenter.in",
        "vendors@vendorcenter.in",
        "admin@vendorcenter.in"
      ],
      triggers: {
        otp_verification: "otp@vendorcenter.in",
        booking_confirmations: "bookings@vendorcenter.in",
        payment_receipts: "payments@vendorcenter.in",
        system_notifications: "noreply@vendorcenter.in",
        vendor_communication: "vendors@vendorcenter.in",
        customer_support: "support@vendorcenter.in",
        admin_alerts: "admin@vendorcenter.in"
      }
    }
  });
});

notificationsRouter.post("/emit", requireRole(["admin", "employee", "vendor", "customer"]), async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      recipientId: z.string().min(2),
      recipientRole: z.enum(["customer", "vendor", "admin", "employee"]),
      category: z.string().min(2),
      title: z.string().min(2),
      message: z.string().min(2),
      payload: z.record(z.unknown()).optional(),
      email: z
        .object({
          recipientEmail: z.string().email(),
          senderEmail: z.string().email(),
          subject: z.string().min(2),
          bodyHtml: z.string().min(2)
        })
        .optional()
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }

  const notification = await createNotification(parsed.data);

  let emailJob = null;
  if (parsed.data.email) {
    emailJob = await queueEmailJob(parsed.data.email);
  }

  trackActivity({
    actorId: req.actor!.id,
    role: req.actor!.role,
    action: "notification.emitted",
    entity: "notification",
    metadata: { category: parsed.data.category, recipientId: parsed.data.recipientId }
  });

  res.status(201).json({ success: true, data: { notification, emailJob } });
});

notificationsRouter.get("/my", requireRole(["customer", "vendor", "admin", "employee"]), async (req: AuthRequest, res) => {
  res.json({ success: true, data: await listNotifications(req.actor!.id) });
});

notificationsRouter.get("/my/unread-count", requireRole(["customer", "vendor", "admin", "employee"]), async (req: AuthRequest, res) => {
  const count = await getUnreadCount(req.actor!.id);
  res.json({ success: true, data: { count } });
});

notificationsRouter.patch("/my/read-all", requireRole(["customer", "vendor", "admin", "employee"]), async (req: AuthRequest, res) => {
  const updated = await markAllAsRead(req.actor!.id);
  res.json({ success: true, data: { updated } });
});

notificationsRouter.get("/email-jobs", requireRole(["admin", "employee"]), async (_req, res) => {
  res.json({ success: true, data: await listEmailJobs() });
});

notificationsRouter.post("/email-jobs/process", requireRole(["admin"]), async (_req, res) => {
  const processed = await processQueuedEmailJobs();
  res.json({ success: true, data: { processed } });
});

// ── Test email endpoints (admin only, dev/staging) ──

notificationsRouter.post("/test/otp-email", requireRole(["admin"]), async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }
  const job = await sendOtpEmail({
    recipientEmail: parsed.data.email,
    code: "123456",
    purpose: "signup",
    expiryMinutes: 5,
  });
  res.status(201).json({ success: true, data: { emailJob: job, note: "Test OTP email queued with code 123456" } });
});

notificationsRouter.post("/test/booking-email", requireRole(["admin"]), async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }
  const job = await sendBookingConfirmation({
    recipientEmail: parsed.data.email,
    bookingId: "00000000-test-booking",
    serviceName: "Test AC Repair Service",
    vendorName: "Demo Vendor",
    transactionId: "txn_test12345",
    status: "pending",
    createdAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
  });
  res.status(201).json({ success: true, data: { emailJob: job, note: "Test booking confirmation email queued" } });
});

notificationsRouter.post("/test/receipt-email", requireRole(["admin"]), async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.flatten() });
    return;
  }
  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const pdfBuffer = await generateBookingReceipt({
    bookingId: "00000000-test-receipt",
    transactionId: "txn_test12345",
    serviceName: "Test AC Repair Service",
    customerEmail: parsed.data.email,
    vendorName: "Demo Vendor",
    amount: "1,500.00",
    paymentStatus: "success",
    date: now,
  });
  const job = await sendPaymentReceipt({
    recipientEmail: parsed.data.email,
    bookingId: "00000000-test-receipt",
    transactionId: "txn_test12345",
    serviceName: "Test AC Repair Service",
    amount: "1,500.00",
    paymentStatus: "success",
    paidAt: now,
    vendorName: "Demo Vendor",
    pdfBuffer,
  });
  res.status(201).json({ success: true, data: { emailJob: job, note: "Test payment receipt email with PDF attachment queued" } });
});

// ── Broadcast push notification to all users (admin only) ──
notificationsRouter.post("/broadcast-push", requireRole(["admin"]), async (req: AuthRequest, res) => {
  try {
    const parsed = z.object({
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(500),
      targetRole: z.enum(["all", "customer", "vendor"]).default("all"),
      data: z.record(z.string()).optional(),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten() });
      return;
    }

    const { isFirebaseConfigured, getFirebaseMessaging } = await import("../../services/firebaseService.js");
    if (!isFirebaseConfigured()) {
      res.status(503).json({ success: false, error: "Firebase not configured — push notifications unavailable" });
      return;
    }

    const { pool } = await import("../../db/pool.js");

    // Get all device tokens (optionally filtered by role)
    let query = "SELECT DISTINCT dt.token FROM device_tokens dt JOIN users u ON dt.user_id = u.id";
    const params: string[] = [];
    if (parsed.data.targetRole !== "all") {
      query += " WHERE u.role = $1";
      params.push(parsed.data.targetRole);
    }

    const tokensResult = await pool.query<{ token: string }>(query, params);
    const tokens = tokensResult.rows.map(r => r.token);

    if (tokens.length === 0) {
      res.json({ success: true, data: { sent: 0, total: 0, message: "No device tokens found" } });
      return;
    }

    const messaging = getFirebaseMessaging();

    // FCM sendEachForMulticast supports max 500 tokens per call
    let successCount = 0;
    let failureCount = 0;
    const invalidTokens: string[] = [];

    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title: parsed.data.title, body: parsed.data.body },
        data: {
          ...(parsed.data.data ?? {}),
          channelId: "vendorcenter_updates",
          url: "https://vendorcenter.in/download",
        },
        android: {
          priority: "high",
          notification: {
            channelId: "vendorcenter_updates",
            priority: "high",
            defaultSound: true,
          },
        },
      });
      successCount += response.successCount;
      failureCount += response.failureCount;

      // Collect invalid tokens for cleanup
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error?.code &&
          ["messaging/invalid-registration-token", "messaging/registration-token-not-registered"].includes(resp.error.code)) {
          invalidTokens.push(batch[idx]);
        }
      });
    }

    // Clean up invalid tokens
    if (invalidTokens.length > 0) {
      await pool.query("DELETE FROM device_tokens WHERE token = ANY($1)", [invalidTokens]);
    }

    // Also create in-app notifications for all targeted users
    const usersQuery = parsed.data.targetRole === "all"
      ? "SELECT id, role FROM users WHERE suspended = false"
      : "SELECT id, role FROM users WHERE role = $1 AND suspended = false";
    const usersResult = await pool.query<{ id: string; role: string }>(
      usersQuery,
      parsed.data.targetRole === "all" ? [] : [parsed.data.targetRole]
    );

    for (const user of usersResult.rows) {
      await createNotification({
        recipientId: user.id,
        recipientRole: user.role,
        category: "app_update",
        title: parsed.data.title,
        message: parsed.data.body,
      });
    }

    trackActivity({
      actorId: req.actor!.id,
      role: req.actor!.role,
      action: "notification.broadcast_push",
      entity: "notification",
      metadata: { title: parsed.data.title, targetRole: parsed.data.targetRole, sent: successCount, failed: failureCount, inApp: usersResult.rows.length },
    });

    res.json({
      success: true,
      data: {
        pushSent: successCount,
        pushFailed: failureCount,
        invalidTokensCleaned: invalidTokens.length,
        inAppCreated: usersResult.rows.length,
        totalDevices: tokens.length,
      },
    });
  } catch (err) {
    console.error("[notifications] broadcast-push error", err);
    res.status(500).json({ success: false, error: "Failed to send broadcast notification" });
  }
});
